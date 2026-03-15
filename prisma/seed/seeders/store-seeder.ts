/**
 * ストアseeder: Store + ShippingRate
 */

import { PrismaClient } from "@prisma/client";
import { SEED_STORES } from "../constants/stores";
import { SEED_COUNTRIES } from "../constants/countries";

export async function seedStores(
  prisma: PrismaClient,
  userMap: Map<string, string>,
  countryMap: Map<string, string>
): Promise<Map<string, string>> {
  const stores = new Map<string, string>();

  for (const s of SEED_STORES) {
    const userId = userMap.get(s.ownerEmail);
    if (!userId) {
      throw new Error(
        `ユーザーが見つかりません: ${s.ownerEmail}（ストア: ${s.name}）`
      );
    }

    const record = await prisma.store.upsert({
      where: { url: s.url },
      update: {
        name: s.name,
        description: s.description,
        email: s.email,
        phone: s.phone,
        logo: s.logo,
        cover: s.cover,
        status: s.status,
        userId,
        defaultShippingService: s.defaultShippingService,
        defaultShippingFeePerItem: s.defaultShippingFeePerItem,
        defaultShippingFeeForAdditionalItem:
          s.defaultShippingFeeForAdditionalItem,
        defaultShippingFeePerKg: s.defaultShippingFeePerKg,
        defaultShippingFeeFixed: s.defaultShippingFeeFixed,
        defaultDeliveryTimeMin: s.defaultDeliveryTimeMin,
        defaultDeliveryTimeMax: s.defaultDeliveryTimeMax,
        returnPolicy: s.returnPolicy,
      },
      create: {
        name: s.name,
        description: s.description,
        email: s.email,
        phone: s.phone,
        url: s.url,
        logo: s.logo,
        cover: s.cover,
        status: s.status,
        userId,
        defaultShippingService: s.defaultShippingService,
        defaultShippingFeePerItem: s.defaultShippingFeePerItem,
        defaultShippingFeeForAdditionalItem:
          s.defaultShippingFeeForAdditionalItem,
        defaultShippingFeePerKg: s.defaultShippingFeePerKg,
        defaultShippingFeeFixed: s.defaultShippingFeeFixed,
        defaultDeliveryTimeMin: s.defaultDeliveryTimeMin,
        defaultDeliveryTimeMax: s.defaultDeliveryTimeMax,
        returnPolicy: s.returnPolicy,
      },
    });
    stores.set(s.url, record.id);

    // ShippingRate: 各国に対してデフォルト配送料を設定
    for (const country of SEED_COUNTRIES) {
      const countryId = countryMap.get(country.code);
      if (!countryId) {
        throw new Error(
          `国が見つかりません: ${country.code}（ストア: ${s.name}）`
        );
      }

      const shippingData = {
        shippingService: s.defaultShippingService,
        shippingFeePerItem: s.defaultShippingFeePerItem,
        shippingFeeForAdditionalItem:
          s.defaultShippingFeeForAdditionalItem,
        shippingFeePerKg: s.defaultShippingFeePerKg,
        shippingFeeFixed: s.defaultShippingFeeFixed,
        deliveryTimeMin: s.defaultDeliveryTimeMin,
        deliveryTimeMax: s.defaultDeliveryTimeMax,
        returnPolicy: s.returnPolicy,
      };

      await prisma.shippingRate.upsert({
        where: {
          storeId_countryId: { storeId: record.id, countryId },
        },
        update: shippingData,
        create: {
          storeId: record.id,
          countryId,
          ...shippingData,
        },
      });
    }
  }

  return stores;
}
