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
  // Coupon
  await prisma.coupon.deleteMany();
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
        startDate: new Date(c.startDate),
        endDate: new Date(c.endDate),
        discount: c.discount,
      },
    });
    coupons.set(c.code, coupon.id);
  }

  // ShippingAddress
  await prisma.shippingAddress.deleteMany();
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
  await prisma.order.deleteMany();

  for (const o of SEED_ORDERS) {
    const userId = maps.users.get(o.userEmail);
    if (!userId) {
      throw new Error(`ユーザーが見つかりません: ${o.userEmail}（注文）`);
    }

    const addresses = userAddresses.get(userId);
    if (!addresses || addresses.length === 0) {
      throw new Error(`配送先が設定されていません: ${o.userEmail}（注文）`);
    }

    // indexが範囲外の場合は0を使う
    const addrIndex = o.shippingAddressIndex < addresses.length ? o.shippingAddressIndex : 0;
    const shippingAddressId = addresses[addrIndex];

    const order = await prisma.order.create({
      data: {
        userId,
        shippingAddressId,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod || undefined,
        subTotal: 0, // 後でOrderItemから計算
        total: 0,    // 後でOrderItemから計算
      },
    });

    for (const g of o.groups) {
      const storeId = maps.stores.get(g.storeUrl);
      if (!storeId) {
        throw new Error(`ストアが見つかりません: ${g.storeUrl}（注文グループ）`);
      }

      const couponId = g.couponCode ? coupons.get(g.couponCode) : undefined;

      const orderGroup = await prisma.orderGroup.create({
        data: {
          orderId: order.id,
          storeId,
          status: g.status,
          couponId,
        },
      });

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
            totalPrice: size.price * item.quantity,
            status: item.status,
          },
        });
      }
    }
  }
}
