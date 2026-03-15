/**
 * コマースseeder: Coupon, ShippingAddress, Order (OrderGroup, OrderItem)
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { SEED_COUPONS } from "../constants/coupons";
import { SEED_SHIPPING_ADDRESSES } from "../constants/shipping";
import { SEED_ORDERS } from "../constants/orders";
import type { SeedMaps } from "../types";

/**
 * Seeds commerce-related data (coupons, shipping addresses, orders, order groups, and order items) and removes existing seed data for the mapped users and stores.
 *
 * Processes predefined seed constants to:
 * - delete prior seed Orders, ShippingAddresses, and Coupons for the provided users/stores,
 * - create Coupons for mapped stores,
 * - create ShippingAddress records for mapped users and countries,
 * - create Orders with nested OrderGroups and OrderItems while computing and persisting subtotals and totals.
 *
 * @param maps - A set of lookup maps used to resolve seed references to database IDs:
 *   - `users`: maps user email -> userId
 *   - `stores`: maps storeUrl -> storeId
 *   - `countries`: maps countryCode -> countryId
 *   - `products`: maps productSlug -> productId
 *   - `variants`: maps variantSlug -> variantId
 *   - `sizes`: maps "variantSlug:size" -> sizeId
 *
 * @throws When a required mapping or referenced record is missing (e.g., user, store, country, product, variant, size, or coupon).
 * @throws When a user has no shipping addresses available for an order.
 * @throws When an order's shippingAddressIndex is outside the valid range for the user's addresses.
 * @throws When expected product/variant/size records cannot be retrieved from the database during order item creation.
 */
export async function seedCommerce(
  prisma: PrismaClient,
  maps: Pick<
    SeedMaps,
    "users" | "stores" | "countries" | "products" | "variants" | "sizes"
  >
): Promise<void> {
  // seed データのみ削除（E2E テストやマニュアルデータを保護）
  const seedUserIds = Array.from(maps.users.values());
  const seedStoreIds = Array.from(maps.stores.values());

  // Order 系は userId でフィルタ（OrderGroup, OrderItem は CASCADE DELETE）
  await prisma.order.deleteMany({
    where: { userId: { in: seedUserIds } },
  });

  // ShippingAddress は userId でフィルタ
  await prisma.shippingAddress.deleteMany({
    where: { userId: { in: seedUserIds } },
  });

  // Coupon は storeId でフィルタ
  await prisma.coupon.deleteMany({
    where: { storeId: { in: seedStoreIds } },
  });

  // Coupon
  const coupons = new Map<string, string>(); // code -> id

  for (const c of SEED_COUPONS) {
    const storeId = maps.stores.get(c.storeUrl);
    if (!storeId) {
      throw new Error(`ストアが見つかりません: ${c.storeUrl}（クーポン: ${c.code}）`);
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: c.code,
        storeId,
        startDate: c.startDate,
        endDate: c.endDate,
        discount: c.discount,
      },
    });
    coupons.set(c.code, coupon.id);
  }

  // ShippingAddress
  // userId -> Array of ShippingAddress id
  const userAddresses = new Map<string, string[]>();

  for (const a of SEED_SHIPPING_ADDRESSES) {
    const userId = maps.users.get(a.userEmail);
    if (!userId) {
      throw new Error(`ユーザーが見つかりません: ${a.userEmail}（配送先）`);
    }
    const countryId = maps.countries.get(a.countryCode);
    if (!countryId) {
      throw new Error(`国が見つかりません: ${a.countryCode}（配送先）`);
    }

    const address = await prisma.shippingAddress.create({
      data: {
        firstName: a.firstName,
        lastName: a.lastName,
        phone: a.phone,
        address1: a.address1,
        address2: a.address2,
        state: a.state,
        city: a.city,
        zip_code: a.zip_code,
        default: a.default,
        countryId,
        userId,
      },
    });

    const addresses = userAddresses.get(userId) || [];
    addresses.push(address.id);
    userAddresses.set(userId, addresses);
  }

  // Order
  for (const o of SEED_ORDERS) {
    const userId = maps.users.get(o.userEmail);
    if (!userId) {
      throw new Error(`ユーザーが見つかりません: ${o.userEmail}（注文）`);
    }

    const addresses = userAddresses.get(userId);
    if (!addresses || addresses.length === 0) {
      throw new Error(`配送先が設定されていません: ${o.userEmail}（注文）`);
    }

    // 範囲外の index をエラーとして検出
    if (o.shippingAddressIndex < 0 || o.shippingAddressIndex >= addresses.length) {
      throw new Error(
        `shippingAddressIndex が範囲外です: ${o.shippingAddressIndex}（有効範囲: 0-${addresses.length - 1}、注文: ${o.userEmail}）`
      );
    }
    const shippingAddressId = addresses[o.shippingAddressIndex];

    const order = await prisma.order.create({
      data: {
        userId,
        shippingAddressId,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod || undefined,
        subTotal: 0,
        total: 0,
      },
    });

    let orderSubTotal = new Prisma.Decimal("0");

    for (const g of o.groups) {
      const storeId = maps.stores.get(g.storeUrl);
      if (!storeId) {
        throw new Error(`ストアが見つかりません: ${g.storeUrl}（注文グループ）`);
      }

      let couponId: string | undefined;
      if (g.couponCode) {
        couponId = coupons.get(g.couponCode);
        if (!couponId) {
          throw new Error(
            `クーポンが見つかりません: ${g.couponCode}（注文グループ: ${g.storeUrl}）`
          );
        }
      }

      const orderGroup = await prisma.orderGroup.create({
        data: {
          orderId: order.id,
          storeId,
          status: g.status,
          couponId,
          shippingService: g.shippingService || "Standard Shipping",
          shippingDeliveryMin: g.shippingDeliveryMin ?? 3,
          shippingDeliveryMax: g.shippingDeliveryMax ?? 7,
          shippingFees: 0, // seedデータでは配送料を0に設定
          subTotal: 0,     // 後でOrderItemから計算
          total: 0,        // 後でOrderItemから計算（配送料は含まない）
        },
      });

      let groupSubTotal = new Prisma.Decimal("0");

      // ID集合を事前収集してバッチ取得（N+1回避）
      const itemIds = g.items.map((item) => {
        const productId = maps.products.get(item.productSlug);
        const variantId = maps.variants.get(item.variantSlug);
        if (!productId || !variantId) {
          throw new Error(
            `商品/バリアントが見つかりません: ${item.productSlug}/${item.variantSlug}（注文: ${o.userEmail}, 店舗: ${g.storeUrl}）`
          );
        }
        const sizeKey = `${item.variantSlug}:${item.size}`;
        const sizeId = maps.sizes.get(sizeKey);
        if (!sizeId) {
          throw new Error(
            `サイズが見つかりません: ${sizeKey}（注文: ${o.userEmail}, 店舗: ${g.storeUrl}）`
          );
        }
        return { productId, variantId, sizeId };
      });

      const productIds = Array.from(new Set(itemIds.map((i) => i.productId)));
      const variantIds = Array.from(new Set(itemIds.map((i) => i.variantId)));
      const sizeIds = Array.from(new Set(itemIds.map((i) => i.sizeId)));

      const [products, variants, sizes] = await Promise.all([
        prisma.product.findMany({ where: { id: { in: productIds } } }),
        prisma.productVariant.findMany({ where: { id: { in: variantIds } } }),
        prisma.size.findMany({ where: { id: { in: sizeIds } } }),
      ]);

      const productMap = new Map(products.map((p) => [p.id, p]));
      const variantMap = new Map(variants.map((v) => [v.id, v]));
      const sizeMap = new Map(sizes.map((s) => [s.id, s]));

      for (let idx = 0; idx < g.items.length; idx++) {
        const item = g.items[idx];
        const { productId, variantId, sizeId } = itemIds[idx];

        const product = productMap.get(productId);
        const variant = variantMap.get(variantId);
        const size = sizeMap.get(sizeId);

        if (!product || !variant || !size) {
          throw new Error(
            `DB データ取得失敗: ${item.productSlug}/${item.variantSlug} ` +
            `(product: ${!!product}, variant: ${!!variant}, size: ${!!size})`
          );
        }

        const itemTotal = size.price.mul(item.quantity);

        await prisma.orderItem.create({
          data: {
            orderGroupId: orderGroup.id,
            productId,
            variantId,
            sizeId,
            productSlug: product.slug,
            variantSlug: variant.slug,
            sku: variant.sku,
            name: product.name,
            image: variant.variantImage,
            size: item.size,
            quantity: item.quantity,
            shippingFee: 0,
            price: size.price,
            totalPrice: itemTotal,
            status: item.status,
          },
        });

        groupSubTotal = groupSubTotal.add(itemTotal);
      }

      // OrderGroup の合計を更新
      await prisma.orderGroup.update({
        where: { id: orderGroup.id },
        data: { subTotal: groupSubTotal, total: groupSubTotal },
      });
      orderSubTotal = orderSubTotal.add(groupSubTotal);
    }

    // Order の合計を更新
    await prisma.order.update({
      where: { id: order.id },
      data: { subTotal: orderSubTotal, total: orderSubTotal },
    });
  }
}
