"use client";
import type { Coupon } from "@prisma/client";
import type { upsertCouponAsAdmin } from "@/queries/coupon";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { v4 } from "uuid";
import { format } from "date-fns";
import { AdminCouponFormSchema } from "@/lib/schemas";
import {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CouponFormFields } from "../forms/coupon-form-fields";
import styles from "../design/seller.module.css";
import { useSaveState, SaveFeedback } from "./save-state";
export default function CouponForm({
    data,
    saveAction,
    onBusyChange,
}: {
    data?: Coupon;
    saveAction: typeof upsertCouponAsAdmin;
    onBusyChange?: (busy: boolean) => void;
}) {
    const router = useRouter(),
        state = useSaveState(onBusyChange);
    const form = useForm<z.infer<typeof AdminCouponFormSchema>>({
        resolver: zodResolver(AdminCouponFormSchema),
        defaultValues: {
            code: data?.code ?? "",
            discount: data?.discount ?? 0,
            startDate:
                data?.startDate ?? format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
            endDate:
                data?.endDate ?? format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
            isActive: data?.isActive ?? true,
            scope: data?.scope ?? "STORE",
            storeId: data?.storeId ?? "",
        },
    });
    const scope = useWatch({ control: form.control, name: "scope" });
    function submit(values: z.infer<typeof AdminCouponFormSchema>) {
        return state.save(
            () =>
                saveAction({
                    id: data?.id ?? v4(),
                    code: values.code,
                    discount: values.discount,
                    startDate: values.startDate,
                    endDate: values.endDate,
                    isActive: values.isActive,
                    scope: values.scope,
                    storeId:
                        values.scope === "PLATFORM"
                            ? null
                            : (values.storeId ?? ""),
                    createdAt: data?.createdAt ?? new Date(),
                    updatedAt: new Date(),
                }),
            () => router.refresh()
        );
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
                    <fieldset disabled={state.busy} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="scope"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Scope</FormLabel>
                                    <FormControl>
                                        <select
                                            className="w-full border p-2"
                                            {...field}
                                            onChange={(e) => {
                                                field.onChange(e.target.value);
                                                if (
                                                    e.target.value ===
                                                    "PLATFORM"
                                                )
                                                    form.setValue(
                                                        "storeId",
                                                        null,
                                                        { shouldValidate: true }
                                                    );
                                            }}
                                        >
                                            <option value="STORE">Store</option>
                                            <option value="PLATFORM">
                                                Platform
                                            </option>
                                        </select>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {scope === "STORE" && (
                            <FormField
                                control={form.control}
                                name="storeId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Store ID</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                value={field.value ?? ""}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <CouponFormFields
                            control={form.control}
                            design="admin"
                        />
                        <FormField
                            control={form.control}
                            name="isActive"
                            render={({ field }) => (
                                <FormItem className="flex items-center gap-3">
                                    <FormControl>
                                        <input
                                            type="checkbox"
                                            checked={field.value}
                                            onChange={(e) =>
                                                field.onChange(e.target.checked)
                                            }
                                        />
                                    </FormControl>
                                    <FormLabel>Active</FormLabel>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit">
                            {state.busy
                                ? "Saving…"
                                : data
                                  ? "Save coupon"
                                  : "Create coupon"}
                        </Button>
                    </fieldset>
                </form>
            </Form>
            <SaveFeedback {...state} />
        </section>
    );
}
