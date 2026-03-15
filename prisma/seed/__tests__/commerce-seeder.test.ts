import { SEED_COUPONS } from "../constants/coupons";
import { SEED_SHIPPING_ADDRESSES } from "../constants/shipping";
import { SEED_ORDERS } from "../constants/orders";
import { SEED_STORES } from "../constants/stores";
import { SEED_USERS } from "../constants/users";
import { SEED_COUNTRIES } from "../constants/countries";

describe("SEED_COUPONS バリデーション", () => {
  it("12個のクーポンが存在すること", () => {
    expect(SEED_COUPONS.length).toBe(12);
  });

  it("全codeが2-50字の英数字であること", () => {
    for (const c of SEED_COUPONS) {
      expect(c.code.length).toBeGreaterThanOrEqual(2);
      expect(c.code.length).toBeLessThanOrEqual(50);
      expect(c.code).toMatch(/^[A-Z0-9]+$/);
    }
  });

  it("全codeが一意であること", () => {
    const codes = SEED_COUPONS.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("全discountが1-99の範囲であること", () => {
    for (const c of SEED_COUPONS) {
      expect(c.discount).toBeGreaterThanOrEqual(1);
      expect(c.discount).toBeLessThanOrEqual(99);
    }
  });

  it("全storeUrlが存在するストアを参照していること", () => {
    const storeUrls = new Set(SEED_STORES.map((s) => s.url));
    for (const c of SEED_COUPONS) {
      expect(storeUrls.has(c.storeUrl)).toBe(true);
    }
  });

  it("各店舗に2個ずつクーポンがあること", () => {
    const grouped = new Map<string, number>();
    for (const c of SEED_COUPONS) {
      grouped.set(c.storeUrl, (grouped.get(c.storeUrl) ?? 0) + 1);
    }
    for (const store of SEED_STORES) {
      expect(grouped.get(store.url)).toBe(2);
    }
  });

  it("startDateとendDateが有効な日付形式でstartDate < endDateであること", () => {
    for (const c of SEED_COUPONS) {
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);
      expect(start.toString()).not.toBe("Invalid Date");
      expect(end.toString()).not.toBe("Invalid Date");
      expect(start.getTime()).toBeLessThan(end.getTime());
    }
  });
});

describe("SEED_SHIPPING_ADDRESSES バリデーション", () => {
  it("6個以上の配送先が存在すること", () => {
    expect(SEED_SHIPPING_ADDRESSES.length).toBeGreaterThanOrEqual(6);
  });

  it("全userEmailが存在するUSERロールユーザーを参照していること", () => {
    const userEmails = new Set(
      SEED_USERS.filter((u) => u.role === "USER").map((u) => u.email)
    );
    for (const s of SEED_SHIPPING_ADDRESSES) {
      expect(userEmails.has(s.userEmail)).toBe(true);
    }
  });

  it("全countryCodeが存在する国を参照していること", () => {
    const countryCodes = new Set(SEED_COUNTRIES.map((c) => c.code));
    for (const s of SEED_SHIPPING_ADDRESSES) {
      expect(countryCodes.has(s.countryCode)).toBe(true);
    }
  });

  it("各ユーザーに少なくとも1つのデフォルト配送先があること", () => {
    const userDefaults = new Map<string, boolean>();
    for (const s of SEED_SHIPPING_ADDRESSES) {
      if (s.default) {
        userDefaults.set(s.userEmail, true);
      }
    }
    const users = Array.from(new Set(SEED_SHIPPING_ADDRESSES.map((s) => s.userEmail)));
    for (const email of users) {
      expect(userDefaults.has(email)).toBe(true);
    }
  });

  it("phone番号が妥当な形式であること", () => {
    for (const s of SEED_SHIPPING_ADDRESSES) {
      expect(s.phone).toMatch(/^\+?[\d-]+$/);
    }
  });
});

describe("SEED_ORDERS バリデーション", () => {
  it("15-20件の注文が存在すること", () => {
    expect(SEED_ORDERS.length).toBeGreaterThanOrEqual(15);
    expect(SEED_ORDERS.length).toBeLessThanOrEqual(20);
  });

  it("全seedKeyが一意であること", () => {
    const keys = SEED_ORDERS.map((o) => o.seedKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("全userEmailが存在するUSERロールユーザーを参照していること", () => {
    const userEmails = new Set(
      SEED_USERS.filter((u) => u.role === "USER").map((u) => u.email)
    );
    for (const o of SEED_ORDERS) {
      expect(userEmails.has(o.userEmail)).toBe(true);
    }
  });

  it("shippingAddressIndexが有効な範囲であること", () => {
    const addressCounts = new Map<string, number>();
    for (const a of SEED_SHIPPING_ADDRESSES) {
      addressCounts.set(a.userEmail, (addressCounts.get(a.userEmail) ?? 0) + 1);
    }
    for (const o of SEED_ORDERS) {
      expect(Number.isInteger(o.shippingAddressIndex)).toBe(true);
      expect(o.shippingAddressIndex).toBeGreaterThanOrEqual(0);
      const count = addressCounts.get(o.userEmail) ?? 0;
      expect(o.shippingAddressIndex).toBeLessThan(count);
    }
  });

  it("全groupsのstoreUrlが存在するストアを参照していること", () => {
    const storeUrls = new Set(SEED_STORES.map((s) => s.url));
    for (const o of SEED_ORDERS) {
      for (const g of o.groups) {
        expect(storeUrls.has(g.storeUrl)).toBe(true);
      }
    }
  });

  it("全OrderStatusが有効な値であること", () => {
    // Prisma enum は PascalCase
    const validStatuses = new Set([
      "Pending",
      "Confirmed",
      "Processing",
      "Shipped",
      "OutForDelivery",
      "Delivered",
      "Canceled",
      "Failed",
      "Returned",
      "Refunded",
    ]);
    for (const o of SEED_ORDERS) {
      expect(validStatuses.has(o.orderStatus)).toBe(true);
      for (const g of o.groups) {
        expect(validStatuses.has(g.status)).toBe(true);
      }
    }
  });

  it("全PaymentStatusが有効な値であること", () => {
    // Prisma enum は PascalCase
    const validStatuses = new Set([
      "Pending",
      "Paid",
      "Failed",
      "Declined",
      "Cancelled",
      "Refunded",
      "PartiallyRefunded",
      "ChargeBack",
    ]);
    for (const o of SEED_ORDERS) {
      expect(validStatuses.has(o.paymentStatus)).toBe(true);
    }
  });

  it("各注文に少なくとも1つのグループがあること", () => {
    for (const o of SEED_ORDERS) {
      expect(o.groups.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("各グループに少なくとも1つのアイテムがあること", () => {
    for (const o of SEED_ORDERS) {
      for (const g of o.groups) {
        expect(g.items.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("全アイテムのquantityが1以上であること", () => {
    for (const o of SEED_ORDERS) {
      for (const g of o.groups) {
        for (const item of g.items) {
          expect(item.quantity).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});
