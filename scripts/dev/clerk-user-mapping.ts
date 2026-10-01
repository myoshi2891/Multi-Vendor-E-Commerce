import type { Role } from "@prisma/client";

/** ローカル DB の `User` 行に書き込む値。 */
export type LocalUser = {
    id: string;
    name: string;
    email: string;
    picture: string;
    role: Role;
};

export type MappingResult =
    | { ok: true; user: LocalUser }
    | { ok: false; reason: string };

const ROLES: readonly Role[] = ["USER", "ADMIN", "SELLER"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const asString = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";

const isRole = (value: unknown): value is Role =>
    typeof value === "string" && (ROLES as readonly string[]).includes(value);

/** プライマリ email（`primary_email_address_id` 一致）→ 先頭の email の順で選ぶ。 */
const pickEmail = (raw: Record<string, unknown>): string => {
    const addresses = Array.isArray(raw.email_addresses)
        ? raw.email_addresses.filter(isRecord)
        : [];
    const primary = addresses.find(
        (address) => address.id === raw.primary_email_address_id
    );
    return asString((primary ?? addresses[0])?.email_address);
};

/**
 * Clerk Backend API (`GET /v1/users`) のユーザー JSON をローカル DB の `User` 行へ変換する。
 *
 * - email が無いユーザーは作らない（Webhook `src/app/api/webhooks/route.ts` と同じ扱い）。
 * - 名前は first/last の空でない部分を結合し、無ければ email のローカル部にする
 *   （Webhook の単純結合だと `"null null"` になりうるため）。
 * - role は Clerk の `private_metadata.role`。認可ガード（`src/lib/auth-guards.ts`）は
 *   Clerk 側の値で判定するので、ローカル DB の role もそれに揃える。不正値は USER。
 */
export const toLocalUser = (raw: unknown): MappingResult => {
    if (!isRecord(raw) || typeof raw.id !== "string" || raw.id === "") {
        return { ok: false, reason: "invalid user" };
    }

    const email = pickEmail(raw);
    if (!email) return { ok: false, reason: "missing email" };

    const fullName = [asString(raw.first_name), asString(raw.last_name)]
        .filter((part) => part !== "")
        .join(" ");
    const metadata = isRecord(raw.private_metadata) ? raw.private_metadata : {};

    return {
        ok: true,
        user: {
            id: raw.id,
            name: fullName || email.split("@")[0],
            email,
            picture: asString(raw.image_url),
            role: isRole(metadata.role) ? metadata.role : "USER",
        },
    };
};
