import { SEED_COUPONS } from "../constants/coupons";
import { SEED_SHIPPING_ADDRESSES } from "../constants/shipping";
import { SEED_ORDERS } from "../constants/orders";
import { SEED_USERS } from "../constants/users";
import { SEED_STORES } from "../constants/stores";
import { SEED_COUNTRIES } from "../constants/countries";

describe("SEED_COUPONS バリデーション", () => {
  it("クーポン数が12個存在すること", () => {
    expect(SEED_COUPONS.length).toBe(12);
  });

  it("各ストアに2個のクーポンが存在すること", () => {
    const storeCount = new Map<string, number>();
    for (const c of SEED_COUPONS) {
      storeCount.set(c.storeUrl, (storeCount.get(c.storeUrl) || 0) + 1);
    }
    const storeUrls = SEED_STORES.map((s) => s.url);
    for (const url of storeUrls) {
      expect(storeCount.get(url)).toBe(2);
    }
  });
});

describe("SEED_SHIPPING_ADDRESSES バリデーション", () => {
  it("配送先が複数存在すること", () => {
    expect(SEED_SHIPPING_ADDRESSES.length).toBeGreaterThan(0);
  });

  it("国コードがSEED_COUNTRIESに存在すること", () => {
    const countryCodes = new Set(SEED_COUNTRIES.map((c) => c.code));
    for (const addr of SEED_SHIPPING_ADDRESSES) {
      expect(countryCodes.has(addr.countryCode)).toBe(true);
    }
  });

  it("ユーザーemailがSEED_USERSに存在すること", () => {
    const userEmails = new Set(SEED_USERS.map((u) => u.email));
    for (const addr of SEED_SHIPPING_ADDRESSES) {
      expect(userEmails.has(addr.userEmail)).toBe(true);
    }
  });
});

describe("SEED_ORDERS バリデーション", () => {
  it("注文が15件以上存在すること", () => {
    expect(SEED_ORDERS.length).toBeGreaterThanOrEqual(15);
  });

  it("全てのOrderStatusが含まれていること", () => {
    const statuses = new Set(SEED_ORDERS.map((o) => o.orderStatus));
    const expected = new Set([
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Canceled",
      "Refunded",
    ]);
    expect(statuses).toEqual(expected);
  });

  it("全てのPaymentStatusが含まれていること", () => {
    const statuses = new Set(SEED_ORDERS.map((o) => o.paymentStatus));
    const expected = new Set([
      "Pending",
      "Paid",
      "Cancelled",
      "Refunded",
    ]);
    expect(statuses).toEqual(expected);
  });
});
