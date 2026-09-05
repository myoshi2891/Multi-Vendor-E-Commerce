import { SEED_COUNTRIES } from "../constants/countries";
import { SEED_USERS } from "../constants/users";
import { SEED_CATEGORIES } from "../constants/categories";
import { SEED_OFFER_TAGS } from "../constants/offer-tags";
import { SEED_EMAIL_PREFIX, URL_REGEX, CATEGORY_NAME_REGEX } from "../helpers";

describe("seed定数データ バリデーション", () => {
    describe("SEED_COUNTRIES", () => {
        it("10カ国のデータが存在すること", () => {
            expect(SEED_COUNTRIES.length).toBe(10);
        });

        it("全てのcodeが2文字であること", () => {
            for (const country of SEED_COUNTRIES) {
                expect(country.code).toHaveLength(2);
            }
        });

        it("codeが一意であること", () => {
            const codes = SEED_COUNTRIES.map((c) => c.code);
            expect(new Set(codes).size).toBe(codes.length);
        });

        it("nameが一意であること", () => {
            const names = SEED_COUNTRIES.map((c) => c.name);
            expect(new Set(names).size).toBe(names.length);
        });
    });

    describe("SEED_USERS", () => {
        it("12ユーザーのデータが存在すること（ADMIN x1, SELLER x6, USER x5）", () => {
            expect(SEED_USERS.length).toBe(12);
        });

        it("ADMINが1名であること", () => {
            const admins = SEED_USERS.filter((u) => u.role === "ADMIN");
            expect(admins.length).toBe(1);
        });

        it("SELLERが6名であること", () => {
            const sellers = SEED_USERS.filter((u) => u.role === "SELLER");
            expect(sellers.length).toBe(6);
        });

        it("USERが5名であること", () => {
            const customers = SEED_USERS.filter((u) => u.role === "USER");
            expect(customers.length).toBe(5);
        });

        it("全emailがlux-seed-プレフィクスを持つこと", () => {
            for (const user of SEED_USERS) {
                expect(user.email.startsWith(SEED_EMAIL_PREFIX)).toBe(true);
            }
        });

        it("emailが一意であること", () => {
            const emails = SEED_USERS.map((u) => u.email);
            expect(new Set(emails).size).toBe(emails.length);
        });

        it("E2Eシードのe2e-プレフィクスと衝突しないこと", () => {
            for (const user of SEED_USERS) {
                expect(user.email).not.toMatch(/^e2e-/);
            }
        });
    });

    describe("SEED_CATEGORIES", () => {
        it("32ノード（ルート7 + 子25）のカテゴリツリーであること", () => {
            expect(SEED_CATEGORIES.length).toBe(32);
            expect(SEED_CATEGORIES.filter((c) => !c.parentUrl).length).toBe(7);
            expect(SEED_CATEGORIES.filter((c) => c.parentUrl).length).toBe(25);
        });

        it("全てのnameがZod制約を満たすこと（2-50字、英数字スペースのみ）", () => {
            for (const cat of SEED_CATEGORIES) {
                expect(cat.name.length).toBeGreaterThanOrEqual(2);
                expect(cat.name.length).toBeLessThanOrEqual(50);
                expect(cat.name).toMatch(CATEGORY_NAME_REGEX);
            }
        });

        it("全てのurlがZod制約を満たすこと（2-50字、URL安全文字）", () => {
            for (const cat of SEED_CATEGORIES) {
                expect(cat.url.length).toBeGreaterThanOrEqual(2);
                expect(cat.url.length).toBeLessThanOrEqual(50);
                expect(cat.url).toMatch(URL_REGEX);
            }
        });

        it("urlが一意であること", () => {
            const urls = SEED_CATEGORIES.map((c) => c.url);
            expect(new Set(urls).size).toBe(urls.length);
        });

        it("全urlがlux-プレフィクスを持つこと", () => {
            for (const cat of SEED_CATEGORIES) {
                expect(cat.url).toMatch(/^lux-/);
            }
        });
    });

    describe("カテゴリツリーの不変条件", () => {
        it("全てのparentUrlが存在するノードを参照していること", () => {
            const urls = new Set(SEED_CATEGORIES.map((c) => c.url));
            for (const cat of SEED_CATEGORIES) {
                if (cat.parentUrl) expect(urls.has(cat.parentUrl)).toBe(true);
            }
        });

        it("自分自身を親にしているノードが無いこと", () => {
            for (const cat of SEED_CATEGORIES) {
                expect(cat.parentUrl).not.toBe(cat.url);
            }
        });

        it("Phase A の制約どおり depth 1 までに収まっていること", () => {
            // Phase A の Product は subCategoryId（ルート直下しか表現できない）が必須。
            // depth 2 以上を入れると legacy FK に落とせず base-seeder が throw する。
            const byUrl = new Map(SEED_CATEGORIES.map((c) => [c.url, c]));
            for (const cat of SEED_CATEGORIES) {
                let depth = 0;
                let current = cat;
                // 循環を「深さ超過」ではなく循環として検出する。
                // 深さ上限だけでも走査は止まるが、失敗メッセージが
                // 「depth が 1 を超えた」になり原因が循環だと分からない。
                const visited = new Set<string>([current.url]);
                while (current.parentUrl) {
                    const parent = byUrl.get(current.parentUrl);
                    expect(parent).toBeDefined();
                    if (!parent) break;
                    if (visited.has(parent.url)) {
                        throw new Error(
                            `カテゴリツリーに循環があります: ${[...visited].join(" -> ")} -> ${parent.url}`
                        );
                    }
                    visited.add(parent.url);
                    current = parent;
                    depth += 1;
                    expect(depth).toBeLessThanOrEqual(1);
                }
            }
        });

        it("各ルートに最低2つの子があること", () => {
            for (const root of SEED_CATEGORIES.filter((c) => !c.parentUrl)) {
                const children = SEED_CATEGORIES.filter(
                    (c) => c.parentUrl === root.url
                );
                expect(children.length).toBeGreaterThanOrEqual(2);
            }
        });
    });

    describe("SEED_OFFER_TAGS", () => {
        it("5個のオファータグが存在すること", () => {
            expect(SEED_OFFER_TAGS.length).toBe(5);
        });

        it("urlが一意であること", () => {
            const urls = SEED_OFFER_TAGS.map((t) => t.url);
            expect(new Set(urls).size).toBe(urls.length);
        });

        it("全urlがlux-プレフィクスを持つこと", () => {
            for (const tag of SEED_OFFER_TAGS) {
                expect(tag.url).toMatch(/^lux-/);
            }
        });

        it("全urlがURL安全文字のみであること", () => {
            for (const tag of SEED_OFFER_TAGS) {
                expect(tag.url).toMatch(URL_REGEX);
            }
        });
    });

    describe("全体の一意性", () => {
        it("全URLが全データセット通して一意であること", () => {
            const allUrls = [
                ...SEED_CATEGORIES.map((c) => c.url),
                ...SEED_OFFER_TAGS.map((t) => t.url),
            ];
            expect(new Set(allUrls).size).toBe(allUrls.length);
        });

        it("全emailが全データセット通して一意であること", () => {
            const allEmails = SEED_USERS.map((u) => u.email);
            expect(new Set(allEmails).size).toBe(allEmails.length);
        });
    });
});
