"use client";
import { ApplyCouponFormSchema } from "@/lib/schemas";
import type { SerializedCartType } from "@/lib/types";
import type { CheckoutActions } from "@/lib/commerce-actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import toast from "react-hot-toast";
import styles from "../shared/commerce.module.css";

export default function ApplyCouponForm({
    cartId,
    setCartData,
    applyCouponAction,
    disabled = false,
    onBusyChange,
}: {
    cartId: string;
    setCartData: Dispatch<SetStateAction<SerializedCartType>>;
    applyCouponAction: CheckoutActions["applyCouponAction"];
    disabled?: boolean;
    onBusyChange: (busy: boolean) => void;
}) {
    const form = useForm<z.infer<typeof ApplyCouponFormSchema>>({
        resolver: zodResolver(ApplyCouponFormSchema),
        defaultValues: { coupon: "" },
    });
    const [error, setError] = useState<string>();
    const locked = useRef(false);
    const pending = form.formState.isSubmitting;
    const submit = form.handleSubmit(async (values) => {
        setError(undefined);
        try {
            const res = await applyCouponAction(values.coupon, cartId);
            setCartData(res.cart);
            toast.success(res.message);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to apply coupon.";
            setError(message);
            toast.error(message);
        }
    });
    return (
        <form
            aria-label="Apply coupon"
            className={styles.coupon}
            noValidate
            onSubmit={(event) => {
                event.preventDefault();
                if (locked.current || disabled) return;
                locked.current = true;
                onBusyChange(true);
                void submit(event).finally(() => {
                    locked.current = false;
                    onBusyChange(false);
                });
            }}
        >
            <div className={styles.field}>
                <label htmlFor="checkout-coupon">Coupon code</label>
                <input
                    id="checkout-coupon"
                    {...form.register("coupon")}
                    placeholder="Coupon code"
                    disabled={disabled || pending}
                    aria-invalid={Boolean(form.formState.errors.coupon)}
                    aria-describedby={
                        form.formState.errors.coupon
                            ? "coupon-error"
                            : undefined
                    }
                />
                {form.formState.errors.coupon && (
                    <p id="coupon-error" className={styles.error} role="alert">
                        {form.formState.errors.coupon.message}
                    </p>
                )}
            </div>
            <button
                type="submit"
                className={styles.secondary}
                disabled={disabled || pending}
            >
                {pending ? "Applying coupon…" : "Apply"}
            </button>
            {pending && <p role="status">Applying coupon…</p>}
            {error && (
                <p role="alert" className={styles.error}>
                    {error}
                </p>
            )}
        </form>
    );
}
