/**
 * コマースseeder: Coupon, ShippingAddress, Order (OrderGroup, OrderItem)
 */

import { PrismaClient } from "@prisma/client";
import { SEED_COUPONS } from "../constants/coupons";
import { SEED_SHIPPING_ADDRESSES } from "../constants/shipping";
import { SEED_ORDERS } from "../constants/orders";
import type { SeedMaps } from "../types";

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

    let orderSubTotal = 0;

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
          shippingDeliveryMin: g.shippingDeliveryMin || 3,
          shippingDeliveryMax: g.shippingDeliveryMax || 7,
          shippingFees: 0, // 後でOrderItemから計算
          subTotal: 0,     // 後でOrderItemから計算
          total: 0,        // 後でOrderItemから計算
        },
      });

      let groupSubTotal = 0;

      for (const item of g.items) {
        const productId = maps.products.get(item.productSlug);
        const variantId = maps.variants.get(item.variantSlug);

        if (!productId || !variantId) {
          console.warn(
            `⚠️  商品/バリアントが見つかりません: ${item.productSlug}/${item.variantSlug} (スキップ)`
          );
          continue;
        }

        const sizeKey = `${item.variantSlug}:${item.size}`;
        const sizeId = maps.sizes.get(sizeKey);

        if (!sizeId) {
          console.warn(
            `⚠️  サイズが見つかりません: ${sizeKey} (スキップ)`
          );
          continue;
        }

        // 商品データを取得して必要なフィールドを補完
        const product = await prisma.product.findUnique({
          where: { id: productId },
        });
        const variant = await prisma.productVariant.findUnique({
          where: { id: variantId },
        });
        const size = await prisma.size.findUnique({
          where: { id: sizeId },
        });

        if (!product || !variant || !size) {
          console.warn(`⚠️  データ取得失敗: ${item.productSlug} (スキップ)`);
          continue;
        }

        const itemTotal = size.price.toNumber() * item.quantity;

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

        groupSubTotal += itemTotal;
      }

      // OrderGroup の合計を更新
      await prisma.orderGroup.update({
        where: { id: orderGroup.id },
        data: { subTotal: groupSubTotal, total: groupSubTotal },
      });
      orderSubTotal += groupSubTotal;
    }

    // Order の合計を更新
    await prisma.order.update({
      where: { id: order.id },
      data: { subTotal: orderSubTotal, total: orderSubTotal },
    });
  }
}
