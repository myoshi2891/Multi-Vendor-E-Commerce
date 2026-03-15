/**
 * ストアseeder: Store + ShippingRate
 */

import { PrismaClient } from "@prisma/client";
import { SEED_STORES } from "../constants/stores";
import { SEED_COUNTRIES } from "../constants/countries";

/**
 * Ensures seed stores exist and creates or updates their default shipping rates per country.
 *
 * For each predefined store, resolves its owner via `userMap`, upserts the store record (create or update),
 * and upserts a ShippingRate for each predefined country using the store's default shipping settings.
 *
 * @param userMap - Map from owner email to user ID used to assign store ownership
 * @param countryMap - Map from country code to country ID used when creating shipping rates
 * @returns A Map keyed by store URL with values set to the corresponding store record ID
 * @throws Error if a store's owner email is not present in `userMap`
 * @throws Error if a country's code is not present in `countryMap`
 */
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
