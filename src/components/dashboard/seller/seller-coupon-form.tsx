"use client";
import { useRef, useState } from "react";
import type { Coupon } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { v4 } from "uuid";
import { format } from "date-fns";
import { CouponFormSchema } from "@/lib/schemas";
import type { upsertCoupon } from "@/queries/coupon";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { CouponFormFields } from "../forms/coupon-form-fields";
import styles from "../design/seller.module.css";
export default function SellerCouponForm({
    data,
    storeUrl,
    saveAction,
    onBusyChange,
}: {
    data?: Coupon;
    storeUrl: string;
    saveAction: typeof upsertCoupon;
    onBusyChange?: (busy: boolean) => void;
}) {
    const router = useRouter(),
        pending = useRef(false),
        [busy, setBusy] = useState(false),
        [feedback, setFeedback] = useState<"failed" | "saved" | null>(null);
    const form = useForm<z.infer<typeof CouponFormSchema>>({
        resolver: zodResolver(CouponFormSchema),
        defaultValues: {
            code: data?.code ?? "",
            discount: data?.discount ?? 0,
            startDate:
                data?.startDate ?? format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
            endDate:
                data?.endDate ?? format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
        },
    });
    async function submit(values: z.infer<typeof CouponFormSchema>) {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        onBusyChange?.(true);
        setFeedback(null);
        try {
            await saveAction(
                {
                    id: data?.id ?? v4(),
                    ...values,
                    isActive: data?.isActive ?? true,
                    scope: "STORE",
                    storeId: data?.storeId ?? "",
                    createdAt: data?.createdAt ?? new Date(),
                    updatedAt: new Date(),
                },
                storeUrl
            );
            setFeedback("saved");
            if (data?.id) router.refresh();
            else
                router.push(
                    `/dashboard/seller/stores/${encodeURIComponent(storeUrl)}/coupons`
                );
        } catch {
            setFeedback("failed");
        } finally {
            pending.current = false;
            setBusy(false);
            onBusyChange?.(false);
        }
    }
    return (
        <section className={styles.panel}>
            <h2 className="text-xl">Coupon information</h2>
            <Form {...form}>
                <form
                    aria-label="Coupon information"
                    noValidate
                    onSubmit={form.handleSubmit(submit)}
                    className="mt-4 space-y-4"
                >
                    <fieldset disabled={busy} className="space-y-4">
                        <CouponFormFields
                            control={form.control}
                            design="seller"
                        />
                        <Button type="submit">
                            {busy
                                ? "Saving…"
                                : data?.id
                                  ? "Save coupon"
                                  : "Create coupon"}
                        </Button>
                    </fieldset>
                </form>
            </Form>
            {busy && <p role="status">Saving coupon…</p>}
            {feedback === "failed" && (
                <p role="alert" className={styles.alert}>
                    Could not save coupon. Your input has been kept. Please try
                    again.
                </p>
            )}
            {feedback === "saved" && <p role="status">Coupon saved.</p>}
        </section>
    );
}
