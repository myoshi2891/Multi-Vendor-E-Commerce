import type {
    CountryWithShippingRatesType,
    StoreDefaultShippingType,
    StoreDefaultShippingInput,
    ShippingRateInput,
} from "./types";
import type {
    updateStoreDefaultShippingDetails,
    upsertShippingRate,
} from "@/queries/store";
import { toNumberSafe } from "./utils";

export type ShippingCountryRow = {
    countryId: string;
    countryName: string;
    shippingRate: Omit<ShippingRateInput, "countryId"> | null;
};
export type ShippingActions = {
    updateDefaultsAction: typeof updateStoreDefaultShippingDetails;
    upsertShippingRateAction: typeof upsertShippingRate;
};
export function serializeShippingDefaults(
    data: NonNullable<StoreDefaultShippingType>
): StoreDefaultShippingInput {
    return {
        defaultShippingService: data.defaultShippingService,
        defaultShippingFeePerItem: toNumberSafe(data.defaultShippingFeePerItem),
        defaultShippingFeeForAdditionalItem: toNumberSafe(
            data.defaultShippingFeeForAdditionalItem
        ),
        defaultShippingFeePerKg: toNumberSafe(data.defaultShippingFeePerKg),
        defaultShippingFeeFixed: toNumberSafe(data.defaultShippingFeeFixed),
        defaultDeliveryTimeMin: data.defaultDeliveryTimeMin,
        defaultDeliveryTimeMax: data.defaultDeliveryTimeMax,
        returnPolicy: data.returnPolicy,
    };
}
export function serializeShippingCountries(
    rows: CountryWithShippingRatesType[]
): ShippingCountryRow[] {
    return rows.map(({ countryId, countryName, shippingRate: rate }) => ({
        countryId,
        countryName,
        shippingRate: rate
            ? {
                  id: rate.id,
                  shippingService: rate.shippingService,
                  shippingFeePerItem: toNumberSafe(rate.shippingFeePerItem),
                  shippingFeeForAdditionalItem: toNumberSafe(
                      rate.shippingFeeForAdditionalItem
                  ),
                  shippingFeePerKg: toNumberSafe(rate.shippingFeePerKg),
                  shippingFeeFixed: toNumberSafe(rate.shippingFeeFixed),
                  deliveryTimeMin: rate.deliveryTimeMin,
                  deliveryTimeMax: rate.deliveryTimeMax,
                  returnPolicy: rate.returnPolicy,
              }
            : null,
    }));
}
