import { SEED_COUNTRIES } from "../constants/countries";
import { SEED_USERS } from "../constants/users";
import { SEED_CATEGORIES, SEED_SUB_CATEGORIES } from "../constants/categories";
import { SEED_OFFER_TAGS } from "../constants/offer-tags";
import { SEED_EMAIL_PREFIX } from "../helpers";

// Zodスキーマの制約値を直接検証（schemas.tsは"use client"のため直接importしない）
const URL_REGEX = /^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_-]+$/;
const CATEGORY_NAME_REGEX = /^[a-zA-Z0-9\s]+$/;

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
        expect(user.email).toMatch(new RegExp(`^${SEED_EMAIL_PREFIX}`));
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
    it("7カテゴリのデータが存在すること", () => {
      expect(SEED_CATEGORIES.length).toBe(7);
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

  describe("SEED_SUB_CATEGORIES", () => {
    it("22個のサブカテゴリが存在すること", () => {
      expect(SEED_SUB_CATEGORIES.length).toBe(22);
    });

    it("全てのnameがZod制約を満たすこと", () => {
      for (const sub of SEED_SUB_CATEGORIES) {
        expect(sub.name.length).toBeGreaterThanOrEqual(2);
        expect(sub.name.length).toBeLessThanOrEqual(50);
        expect(sub.name).toMatch(CATEGORY_NAME_REGEX);
      }
    });

    it("全てのurlがZod制約を満たすこと", () => {
      for (const sub of SEED_SUB_CATEGORIES) {
        expect(sub.url.length).toBeGreaterThanOrEqual(2);
        expect(sub.url.length).toBeLessThanOrEqual(50);
        expect(sub.url).toMatch(URL_REGEX);
      }
    });

    it("urlが一意であること", () => {
      const urls = SEED_SUB_CATEGORIES.map((s) => s.url);
      expect(new Set(urls).size).toBe(urls.length);
    });

    it("全てのcategoryUrlが存在するカテゴリを参照していること", () => {
      const categoryUrls = new Set(SEED_CATEGORIES.map((c) => c.url));
      for (const sub of SEED_SUB_CATEGORIES) {
        expect(categoryUrls.has(sub.categoryUrl)).toBe(true);
      }
    });

    it("各カテゴリに最低2つのサブカテゴリがあること", () => {
      const grouped = new Map<string, number>();
      for (const sub of SEED_SUB_CATEGORIES) {
        grouped.set(sub.categoryUrl, (grouped.get(sub.categoryUrl) ?? 0) + 1);
      }
      for (const [, count] of grouped) {
        expect(count).toBeGreaterThanOrEqual(2);
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
        ...SEED_SUB_CATEGORIES.map((s) => s.url),
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
