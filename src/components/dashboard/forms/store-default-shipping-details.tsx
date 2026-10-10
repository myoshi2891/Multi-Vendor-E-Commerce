"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StoreShippingFormSchema } from "@/lib/schemas";
import type {
    StoreDefaultShippingInput,
    StoreDefaultShippingType,
} from "@/lib/types";
import type { ShippingActions } from "@/lib/seller-shipping";
import { toNumberSafe } from "@/lib/utils";
import { useSellerSave } from "@/hooks/use-seller-save";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import ShippingFields from "./shipping-fields";
import styles from "../design/seller.module.css";

const schema = StoreShippingFormSchema.refine(
    (data) => data.defaultDeliveryTimeMax >= data.defaultDeliveryTimeMin,
    {
        message:
            "Maximum delivery time must be greater than or equal to minimum delivery time",
        path: ["defaultDeliveryTimeMax"],
    }
);
const fields = [
    ["defaultShippingFeePerItem", "Shipping fee per item", 0, 0.1],
    [
        "defaultShippingFeeForAdditionalItem",
        "Shipping fee for additional item",
        0,
        0.1,
    ],
    ["defaultShippingFeePerKg", "Shipping fee per kg", 0, 0.1],
    ["defaultShippingFeeFixed", "Fixed shipping fee", 0, 0.1],
    ["defaultDeliveryTimeMin", "Delivery time min", 1, 1],
    ["defaultDeliveryTimeMax", "Delivery time max", 1, 1],
] as const;
const valuesFor = (
    data?: StoreDefaultShippingInput | NonNullable<StoreDefaultShippingType>
): StoreDefaultShippingInput => ({
    defaultShippingService: data?.defaultShippingService ?? "",
    defaultShippingFeePerItem: toNumberSafe(
        data?.defaultShippingFeePerItem ?? 0
    ),
    defaultShippingFeeForAdditionalItem: toNumberSafe(
        data?.defaultShippingFeeForAdditionalItem ?? 0
    ),
    defaultShippingFeePerKg: toNumberSafe(data?.defaultShippingFeePerKg ?? 0),
    defaultShippingFeeFixed: toNumberSafe(data?.defaultShippingFeeFixed ?? 0),
    defaultDeliveryTimeMin: data?.defaultDeliveryTimeMin ?? 0,
    defaultDeliveryTimeMax: data?.defaultDeliveryTimeMax ?? 0,
    returnPolicy: data?.returnPolicy ?? "",
});
export default function StoreDefaultShippingDetails({
    design,
    data,
    storeUrl,
    updateDefaultsAction,
}: {
    data?: StoreDefaultShippingInput | NonNullable<StoreDefaultShippingType>;
    storeUrl: string;
    updateDefaultsAction: ShippingActions["updateDefaultsAction"];
    design?: "seller";
}) {
    const router = useRouter();
    const feedback = useSellerSave();
    const form = useForm<StoreDefaultShippingInput>({
        mode: "onChange",
        resolver: zodResolver(schema),
        defaultValues: valuesFor(data),
    });
    useEffect(() => {
        if (data) form.reset(valuesFor(data));
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
                    Default shipping details
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form
                        aria-label="Default shipping details"
                        onSubmit={(event) =>
                            feedback.submit(
                                event,
                                form.handleSubmit((values) =>
                                    feedback.save(
                                        () =>
                                            updateDefaultsAction(
                                                storeUrl,
                                                values
                                            ),
                                        () => router.refresh()
                                    )
                                )
                            )
                        }
                    >
                        <fieldset
                            disabled={feedback.pending}
                            className="min-w-0 space-y-4"
                            aria-label="Default shipping fields"
                        >
                            <ShippingFields
                                control={form.control}
                                serviceName="defaultShippingService"
                                numberFields={fields}
                                returnPolicyName="returnPolicy"
                            />
                            <Button type="submit">
                                {feedback.pending
                                    ? "Saving shipping details…"
                                    : "Save changes"}
                            </Button>
                        </fieldset>
                        {feedback.state === "error" ? (
                            <p role="alert" className={styles.alert}>
                                Could not save shipping details. Please try
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
                                    ? "Saving shipping details…"
                                    : feedback.state === "success"
                                      ? "Shipping details saved."
                                      : ""}
                            </p>
                        )}
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
