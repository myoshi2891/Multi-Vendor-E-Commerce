/**
 * 開発用: Clerk のユーザーをローカル DB の `User` テーブルへ upsert する。
 *
 * 本番では Clerk Webhook（src/app/api/webhooks/route.ts）が `User` 行を作るが、
 * Webhook はローカル Docker の Postgres に届かない。そのままだと `userId` を参照する
 * 書き込み（お気に入り・カート保存・住所・注文等）が外部キー違反で失敗するため、
 * このコマンドで Clerk 側のユーザーを取り込む。
 *
 * - Clerk へは書き戻さない（共有の dev インスタンスを変更しない）。
 * - 接続先 DB がローカル（localhost / 127.0.0.1 / db）以外なら中止する。
 * - ログにはユーザー ID と件数のみを出す（email 等は出さない）。
 *
 * 実行: `make sync-clerk-users`（コンテナ内で `bun scripts/dev/sync-clerk-users.ts`）
 */
import { PrismaClient } from "@prisma/client";
import { toLocalUser } from "./clerk-user-mapping";

const CLERK_USERS_URL = "https://api.clerk.com/v1/users";
const PAGE_SIZE = 100;
const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "db"]);

const assertLocalDatabase = (): void => {
    const raw = process.env.DATABASE_URL?.trim();
    if (!raw) throw new Error("DATABASE_URL is not set.");
    const host = new URL(raw).hostname;
    if (!LOCAL_DB_HOSTS.has(host)) {
        throw new Error(
            `Refusing to sync into non-local database host: ${host}`
        );
    }
};

const fetchAllClerkUsers = async (secretKey: string): Promise<unknown[]> => {
    const users: unknown[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
        const url = `${CLERK_USERS_URL}?limit=${PAGE_SIZE}&offset=${offset}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${secretKey}` },
        });
        if (!res.ok) {
            throw new Error(`Clerk API responded with status ${res.status}`);
        }
        const page: unknown = await res.json();
        if (!Array.isArray(page)) {
            throw new Error("Unexpected Clerk API response shape.");
        }
        users.push(...page);
        if (page.length < PAGE_SIZE) return users;
    }
};

const main = async (): Promise<number> => {
    assertLocalDatabase();
    const secretKey = process.env.CLERK_SECRET_KEY?.trim();
    if (!secretKey) throw new Error("CLERK_SECRET_KEY is not set.");

    const clerkUsers = await fetchAllClerkUsers(secretKey);
    const prisma = new PrismaClient();
    let synced = 0;
    const failures: { id: string; reason: string }[] = [];

    try {
        for (const raw of clerkUsers) {
            const mapped = toLocalUser(raw);
            if (!mapped.ok) {
                const id =
                    typeof raw === "object" && raw !== null && "id" in raw
                        ? String(raw.id)
                        : "(unknown)";
                failures.push({ id, reason: mapped.reason });
                continue;
            }
            const { id, ...fields } = mapped.user;
            try {
                await prisma.user.upsert({
                    where: { id },
                    update: fields,
                    create: mapped.user,
                });
                synced += 1;
            } catch (error: unknown) {
                // email 重複（シードのユーザーと衝突等）でも他のユーザーの同期は続ける。
                const reason =
                    error instanceof Error ? error.message : String(error);
                failures.push({
                    id,
                    reason: reason.split("\n").at(-1) ?? reason,
                });
            }
        }
    } finally {
        await prisma.$disconnect();
    }

    console.log(
        `[sync-clerk-users] synced ${synced} / ${clerkUsers.length} Clerk users`
    );
    for (const failure of failures) {
        console.error("[sync-clerk-users] skipped", failure);
    }
    return failures.length === 0 ? 0 : 1;
};

main()
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
        if (error instanceof Error) {
            console.error("[sync-clerk-users] failed", {
                error: error.message,
                stack: error.stack,
            });
        } else {
            console.error("[sync-clerk-users] failed", { error });
        }
        process.exit(1);
    });
