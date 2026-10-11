"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { v4 } from "uuid";
import { ShippingRateFormSchema } from "@/lib/schemas";
import type { z } from "zod";
import type { CountryWithShippingRatesType } from "@/lib/types";
import type {
    ShippingCountryRow,
    ShippingActions,
} from "@/lib/seller-shipping";
import { toNumberSafe } from "@/lib/utils";
import { useSellerSave } from "@/hooks/use-seller-save";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import ShippingFields from "./shipping-fields";
import styles from "../design/seller.module.css";

type Values = z.infer<typeof ShippingRateFormSchema>;
const fields = [
    ["shippingFeePerItem", "Shipping fee per item", 0, 0.1],
    [
        "shippingFeeForAdditionalItem",
        "Shipping fee for additional item",
        0,
        0.1,
    ],
    ["shippingFeePerKg", "Shipping fee per kg", 0, 0.1],
    ["shippingFeeFixed", "Fixed shipping fee", 0, 0.1],
    ["deliveryTimeMin", "Delivery time min", 1, 1],
    ["deliveryTimeMax", "Delivery time max", 1, 1],
] as const;
function valuesFor(
    data?: ShippingCountryRow | CountryWithShippingRatesType
): Values {
    const rate = data?.shippingRate;
    return {
        countryId: data?.countryId,
        countryName: data?.countryName,
        shippingService: rate?.shippingService ?? "",
        shippingFeePerItem: toNumberSafe(rate?.shippingFeePerItem ?? 0),
        shippingFeeForAdditionalItem: toNumberSafe(
            rate?.shippingFeeForAdditionalItem ?? 0
        ),
        shippingFeePerKg: toNumberSafe(rate?.shippingFeePerKg ?? 0),
        shippingFeeFixed: toNumberSafe(rate?.shippingFeeFixed ?? 0),
        deliveryTimeMin: rate?.deliveryTimeMin ?? 1,
        deliveryTimeMax: rate?.deliveryTimeMax ?? 1,
        returnPolicy: rate?.returnPolicy ?? "",
    };
}
export default function ShippingRateDetails({
    design,
    data,
    storeUrl,
    upsertShippingRateAction,
    onBusyChange,
}: {
    data?: ShippingCountryRow | CountryWithShippingRatesType;
    storeUrl: string;
    upsertShippingRateAction: ShippingActions["upsertShippingRateAction"];
    onBusyChange?: (busy: boolean) => void;
    design?: "seller";
}) {
    const router = useRouter();
    const feedback = useSellerSave(onBusyChange);
    const form = useForm<Values>({
        mode: "onChange",
        resolver: zodResolver(ShippingRateFormSchema),
        defaultValues: valuesFor(data),
    });
    useEffect(() => {
        form.reset(valuesFor(data));
    }, [data, form]);
    return (
        <Card
            className={
                design === "seller"
                    ? `${styles.editor} ${styles.controls}`
                    : styles.editor
            }
        >
            <CardHeader>
                <CardTitle role="heading" aria-level={2}>
                    Shipping rate
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form
                        aria-label={`Shipping rate for ${data?.countryName ?? "country"}`}
                        onSubmit={(event) =>
                            feedback.submit(
                                event,
                                form.handleSubmit((values) =>
                                    feedback.save(
                                        () =>
                                            upsertShippingRateAction(storeUrl, {
                                                id:
                                                    data?.shippingRate?.id ??
                                                    v4(),
                                                countryId:
                                                    data?.countryId ?? "",
                                                shippingService:
                                                    values.shippingService,
                                                shippingFeePerItem:
                                                    values.shippingFeePerItem,
                                                shippingFeeForAdditionalItem:
                                                    values.shippingFeeForAdditionalItem,
                                                shippingFeePerKg:
                                                    values.shippingFeePerKg,
                                                shippingFeeFixed:
                                                    values.shippingFeeFixed,
                                                deliveryTimeMin:
                                                    values.deliveryTimeMin,
                                                deliveryTimeMax:
                                                    values.deliveryTimeMax,
                                                returnPolicy:
                                                    values.returnPolicy,
                                            }),
                                        () => router.refresh()
                                    )
                                )
                            )
                        }
                    >
                        <fieldset
                            disabled={feedback.pending}
                            className="min-w-0 space-y-4"
                            aria-label="Country shipping fields"
                        >
                            <p>Country: {data?.countryName}</p>
                            <ShippingFields
                                control={form.control}
                                serviceName="shippingService"
                                numberFields={fields}
                                returnPolicyName="returnPolicy"
                            />
                            <Button type="submit">
                                {feedback.pending
                                    ? "Saving shipping rate…"
                                    : "Save changes"}
                            </Button>
                        </fieldset>
                        {feedback.state === "error" ? (
                            <p role="alert" className={styles.alert}>
                                Could not save the shipping rate. Please try
                                again.
                            </p>
                        ) : (
                            <p
                                role="status"
                                aria-live="polite"
                                className={
                                    design === "seller" &&
                                    feedback.state === "success"
                                        ? styles.success
                                        : undefined
                                }
                            >
                                {feedback.pending
                                    ? "Saving shipping rate…"
                                    : feedback.state === "success"
                                      ? "Shipping rate saved."
                                      : ""}
                            </p>
                        )}
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
