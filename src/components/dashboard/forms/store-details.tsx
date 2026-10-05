"use client";
import { useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { Store } from "@prisma/client";
import type { upsertStore } from "@/queries/store";
import { StoreFormSchema } from "@/lib/schemas";
import { useSellerSave } from "@/hooks/use-seller-save";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardDescription,
} from "@/components/ui/card";
import {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import ImageUpload from "../shared/image-upload";
import styles from "../design/seller.module.css";

export type StoreDetailsData = Pick<
    Store,
    | "id"
    | "name"
    | "description"
    | "email"
    | "phone"
    | "logo"
    | "cover"
    | "url"
    | "featured"
    | "status"
>;
type Values = z.infer<typeof StoreFormSchema>;
const valuesFor = (data?: StoreDetailsData): Values => ({
    name: data?.name ?? "",
    description: data?.description ?? "",
    email: data?.email ?? "",
    phone: data?.phone ?? "",
    logo: data?.logo ? [{ url: data.logo }] : [],
    cover: data?.cover ? [{ url: data.cover }] : [],
    url: data?.url ?? "",
    featured: data?.featured ?? false,
    status: data?.status,
});
const fields = [
    ["name", "Store name", "text", "Name"],
    ["email", "Store email", "email", "Email"],
    ["phone", "Store phone number", "tel", "Phone"],
    ["url", "Store url", "text", "/store-url"],
] as const;
export default function StoreDetails({
    data,
    upsertStoreAction,
    design,
}: {
    data?: StoreDetailsData;
    upsertStoreAction: typeof upsertStore;
    design?: "seller";
}) {
    const router = useRouter();
    const imageErrorId = useId();
    const feedback = useSellerSave();
    const form = useForm<Values>({
        mode: "onChange",
        resolver: zodResolver(StoreFormSchema),
        defaultValues: valuesFor(data),
    });
    useEffect(() => {
        if (data) form.reset(valuesFor(data));
    }, [data, form]);
    async function save(values: Values) {
        let destination = "";
        await feedback.save(
            async () => {
                const response = await upsertStoreAction({
                    ...(data?.id ? { id: data.id } : {}),
                    name: values.name,
                    description: values.description,
                    email: values.email,
                    phone: values.phone,
                    logo: values.logo[0].url,
                    cover: values.cover[0].url,
                    url: values.url,
                    featured: values.featured,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                destination = response.url;
            },
            () => {
                if (data?.id) router.refresh();
                else router.push(`/dashboard/seller/stores/${destination}`);
            }
        );
    }
    return (
        <Card className={design === "seller" ? styles.editor : "w-full"}>
            <CardHeader>
                <CardTitle role="heading" aria-level={2}>
                    Store information
                </CardTitle>
                <CardDescription>
                    {data?.id
                        ? `Update ${data.name} store information.`
                        : "Let's create a store. You can edit store later from the store settings page."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form
                        aria-label="Store information"
                        onSubmit={(event) =>
                            feedback.submit(event, form.handleSubmit(save))
                        }
                    >
                        <fieldset
                            disabled={feedback.pending}
                            className="min-w-0 space-y-6"
                            aria-label="Store fields"
                        >
                            <div className={styles.storeMedia}>
                                {(["logo", "cover"] as const).map((name) => (
                                    <FormField
                                        key={name}
                                        control={form.control}
                                        name={name}
                                        render={({ field }) => (
                                            <FormItem>
                                                <h3>
                                                    {name === "logo"
                                                        ? "Store logo"
                                                        : "Store cover"}
                                                </h3>
                                                <div
                                                    role="group"
                                                    aria-describedby={
                                                        form.formState.errors[
                                                            name
                                                        ]
                                                            ? `${imageErrorId}-${name}`
                                                            : undefined
                                                    }
                                                    aria-label={
                                                        name === "logo"
                                                            ? "Store logo"
                                                            : "Store cover"
                                                    }
                                                >
                                                    <ImageUpload
                                                        type={
                                                            name === "logo"
                                                                ? "profile"
                                                                : "cover"
                                                        }
                                                        value={field.value.map(
                                                            (image) => image.url
                                                        )}
                                                        disabled={
                                                            feedback.pending
                                                        }
                                                        onChange={(url) =>
                                                            field.onChange([
                                                                { url },
                                                            ])
                                                        }
                                                        onRemove={(url) =>
                                                            field.onChange(
                                                                field.value.filter(
                                                                    (image) =>
                                                                        image.url !==
                                                                        url
                                                                )
                                                            )
                                                        }
                                                    />
                                                </div>
                                                <FormMessage
                                                    id={`${imageErrorId}-${name}`}
                                                    role="alert"
                                                />
                                            </FormItem>
                                        )}
                                    />
                                ))}
                            </div>
                            <div className={styles.grid}>
                                {fields.map(
                                    ([name, label, type, placeholder]) => (
                                        <FormField
                                            key={name}
                                            control={form.control}
                                            name={name}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {label}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type={type}
                                                            placeholder={
                                                                placeholder
                                                            }
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )
                                )}
                            </div>
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Store description</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Description"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="featured"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 border p-4">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={(checked) =>
                                                    field.onChange(
                                                        checked === true
                                                    )
                                                }
                                            />
                                        </FormControl>
                                        <div className="space-y-1">
                                            <FormLabel>Featured</FormLabel>
                                            <FormDescription>
                                                This store will appear on the
                                                home page.
                                            </FormDescription>
                                        </div>
                                    </FormItem>
                                )}
                            />
                            <Button type="submit">
                                {feedback.pending
                                    ? "Saving store…"
                                    : data?.id
                                      ? "Save store information"
                                      : "Create store"}
                            </Button>
                        </fieldset>
                        {feedback.state === "error" ? (
                            <p role="alert" className={styles.alert}>
                                Could not save the store. Please try again.
                            </p>
                        ) : (
                            <p role="status" aria-live="polite">
                                {feedback.pending
                                    ? "Saving store…"
                                    : feedback.state === "success"
                                      ? "Store information saved."
                                      : ""}
                            </p>
                        )}
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
