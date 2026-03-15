import { SEED_STORES } from "../constants/stores";
import { SEED_USERS } from "../constants/users";
import {
  SEED_EMAIL_PREFIX,
  NAME_REGEX,
  URL_REGEX,
  PHONE_REGEX,
} from "../helpers";

describe("SEED_STORES バリデーション", () => {
  it("6店舗のデータが存在すること", () => {
    expect(SEED_STORES.length).toBe(6);
  });

  it("全てのnameがZod制約を満たすこと（2-50字、StoreFormSchema準拠）", () => {
    for (const store of SEED_STORES) {
      expect(store.name.length).toBeGreaterThanOrEqual(2);
      expect(store.name.length).toBeLessThanOrEqual(50);
      expect(store.name).toMatch(NAME_REGEX);
    }
  });

  it("全てのdescriptionがZod制約を満たすこと（30-500字）", () => {
    for (const store of SEED_STORES) {
      expect(store.description.length).toBeGreaterThanOrEqual(30);
      expect(store.description.length).toBeLessThanOrEqual(500);
    }
  });

  it("全てのurlがZod制約を満たすこと（2-50字、URL安全文字）", () => {
    for (const store of SEED_STORES) {
      expect(store.url.length).toBeGreaterThanOrEqual(2);
      expect(store.url.length).toBeLessThanOrEqual(50);
      expect(store.url).toMatch(URL_REGEX);
    }
  });

  it("全てのphoneがZod制約を満たすこと", () => {
    for (const store of SEED_STORES) {
      expect(store.phone).toMatch(PHONE_REGEX);
    }
  });

  it("urlが一意であること", () => {
    const urls = SEED_STORES.map((s) => s.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("emailが一意であること", () => {
    const emails = SEED_STORES.map((s) => s.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("全urlがlux-プレフィクスを持つこと", () => {
    for (const store of SEED_STORES) {
      expect(store.url).toMatch(/^lux-/);
    }
  });

  it("全ownerEmailがSELLERロールのユーザーと一致すること", () => {
    const sellerEmails = new Set(
      SEED_USERS.filter((u) => u.role === "SELLER").map((u) => u.email)
    );
    for (const store of SEED_STORES) {
      expect(sellerEmails.has(store.ownerEmail)).toBe(true);
    }
  });

  it("全emailがlux-seed-プレフィクスを持つこと", () => {
    for (const store of SEED_STORES) {
      expect(store.email.startsWith(SEED_EMAIL_PREFIX)).toBe(true);
    }
  });

  it("全statusがACTIVEであること（初期データ）", () => {
    for (const store of SEED_STORES) {
      expect(store.status).toBe("ACTIVE");
    }
  });

  it("配送料デフォルト値が正の数であること", () => {
    for (const store of SEED_STORES) {
      expect(store.defaultShippingFeePerItem).toBeGreaterThan(0);
      expect(store.defaultDeliveryTimeMin).toBeGreaterThan(0);
      expect(store.defaultDeliveryTimeMax).toBeGreaterThan(
        store.defaultDeliveryTimeMin
      );
    }
  });
});
