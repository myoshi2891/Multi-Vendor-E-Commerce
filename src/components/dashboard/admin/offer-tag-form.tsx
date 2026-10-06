"use client";
import type { OfferTag } from "@prisma/client";
import type { upsertOfferTag } from "@/queries/offer-tag";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { v4 } from "uuid";
import { OfferTagFormSchema } from "@/lib/schemas";
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
import styles from "../design/seller.module.css";
import { useSaveState, SaveFeedback } from "./save-state";
export default function OfferTagForm({
    data,
    saveAction,
    onBusyChange,
}: {
    data?: OfferTag;
    saveAction: typeof upsertOfferTag;
    onBusyChange?: (busy: boolean) => void;
}) {
    const router = useRouter(),
        state = useSaveState(onBusyChange);
    const form = useForm<z.infer<typeof OfferTagFormSchema>>({
        resolver: zodResolver(OfferTagFormSchema),
        defaultValues: { name: data?.name ?? "", url: data?.url ?? "" },
    });
    function submit(values: z.infer<typeof OfferTagFormSchema>) {
        return state.save(
            () =>
                saveAction({
                    id: data?.id ?? v4(),
                    ...values,
                    createdAt: data?.createdAt ?? new Date(),
                    updatedAt: new Date(),
                }),
            () => {
                if (data) router.refresh();
                else router.push("/dashboard/admin/offer-tags");
            }
        );
    }
    return (
        <section className={styles.panel}>
            <h2 className="text-xl">Offer tag information</h2>
            <Form {...form}>
                <form
                    aria-label="Offer tag information"
                    noValidate
                    onSubmit={form.handleSubmit(submit)}
                    className="mt-4 space-y-4"
                >
                    <fieldset disabled={state.busy} className="space-y-4">
                        {(
                            [
                                ["name", "Offer tag name"],
                                ["url", "Offer tag url"],
                            ] as const
                        ).map(([name, label]) => (
                            <FormField
                                key={name}
                                control={form.control}
                                name={name}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{label}</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ))}
                        <Button type="submit">
                            {state.busy
                                ? "Saving…"
                                : data
                                  ? "Save offer tag"
                                  : "Create offer tag"}
                        </Button>
                    </fieldset>
                </form>
            </Form>
            <SaveFeedback {...state} />
        </section>
    );
}
