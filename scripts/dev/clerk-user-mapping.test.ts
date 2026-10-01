import { toLocalUser } from "./clerk-user-mapping";

/**
 * Clerk API のユーザー JSON → ローカル DB の User 行への変換。
 * Webhook がローカル Docker DB に届かないため、開発用同期コマンド
 * （scripts/dev/sync-clerk-users.ts）がこの変換で User 行を用意する。
 */
const clerkUser = (overrides: Record<string, unknown> = {}) => ({
    id: "user_abc",
    first_name: "Mitsuru",
    last_name: "Y",
    image_url: "https://img.clerk.com/abc.png",
    primary_email_address_id: "idn_2",
    email_addresses: [
        { id: "idn_1", email_address: "old@example.com" },
        { id: "idn_2", email_address: "primary@example.com" },
    ],
    private_metadata: { role: "SELLER" },
    ...overrides,
});

describe("toLocalUser", () => {
    it("Clerk のユーザーを User 行の値へ変換する", () => {
        // Act
        const result = toLocalUser(clerkUser());

        // Assert
        expect(result).toEqual({
            ok: true,
            user: {
                id: "user_abc",
                name: "Mitsuru Y",
                email: "primary@example.com",
                picture: "https://img.clerk.com/abc.png",
                role: "SELLER",
            },
        });
    });

    it("プライマリ ID が一致しない場合は先頭の email を使う", () => {
        // Arrange
        const raw = clerkUser({ primary_email_address_id: null });

        // Act
        const result = toLocalUser(raw);

        // Assert
        expect(result.ok && result.user.email).toBe("old@example.com");
    });

    it("email が無いユーザーは変換しない", () => {
        // Act
        const result = toLocalUser(clerkUser({ email_addresses: [] }));

        // Assert
        expect(result).toEqual({ ok: false, reason: "missing email" });
    });

    it("名前が無い場合は email のローカル部を名前にする", () => {
        // Act
        const result = toLocalUser(
            clerkUser({ first_name: null, last_name: "" })
        );

        // Assert
        expect(result.ok && result.user.name).toBe("primary");
    });

    it("role が不正・未設定なら USER にする", () => {
        // Act
        const invalid = toLocalUser(
            clerkUser({ private_metadata: { role: "ROOT" } })
        );
        const missing = toLocalUser(clerkUser({ private_metadata: {} }));

        // Assert
        expect(invalid.ok && invalid.user.role).toBe("USER");
        expect(missing.ok && missing.user.role).toBe("USER");
    });

    it("オブジェクトでない入力や id 欠落は変換しない", () => {
        // Act & Assert
        expect(toLocalUser(null)).toEqual({
            ok: false,
            reason: "invalid user",
        });
        expect(toLocalUser(clerkUser({ id: 1 }))).toEqual({
            ok: false,
            reason: "invalid user",
        });
    });
});
