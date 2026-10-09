"use client";

// React
import { FC, useRef, useState } from "react";

// Prisma
import {
    AttributeScope,
    AttributeType,
    type AttributeDefinition,
} from "@prisma/client";

// Form handling utilities
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Schema
import {
    AttributeDefinitionFormSchema,
    type AttributeDefinitionFormValues,
} from "@/lib/schemas";

// UI Components
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
} from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

// Queries
import type { upsertAttributeDefinition } from "@/queries/attribute";

// Utils
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

/** カテゴリ選択肢（`flattenCategoryTree` の出力の最小形）。 */
export interface AttributeCategoryOption {
    id: string;
    name: string;
    path: string;
    depth: number;
}

import styles from "../design/seller.module.css";
import attributeStyles from "../admin/attribute.module.css";
import { SaveFeedback } from "../admin/save-state";

interface AttributeDetailsProps {
    saveAction: typeof upsertAttributeDefinition;
    onBusyChange?: (busy: boolean) => void;
    data?: AttributeDefinition;
    categories: AttributeCategoryOption[];
}

type BooleanField = "required" | "facetable" | "multiValued";

const BOOLEAN_FIELDS: {
    name: BooleanField;
    label: string;
    description: string;
}[] = [
    {
        name: "required",
        label: "Required",
        description:
            "Sellers cannot save a product in this category without a value.",
    },
    {
        name: "facetable",
        label: "Facetable",
        description:
            "Shown as a search filter. Not allowed for TEXT attributes.",
    },
    {
        name: "multiValued",
        label: "Multi-valued",
        description:
            "Allow selecting several options (ENUM only, e.g. allergens).",
    },
];

const AttributeDetails: FC<AttributeDetailsProps> = ({
    data,
    categories,
    saveAction,
    onBusyChange,
}) => {
    const { toast } = useToast();
    const router = useRouter();
    const isEdit = Boolean(data?.id);

    const form = useForm<AttributeDefinitionFormValues>({
        mode: "onChange",
        resolver: zodResolver(AttributeDefinitionFormSchema),
        defaultValues: {
            categoryId: data?.categoryId ?? "",
            key: data?.key ?? "",
            name: data?.name ?? "",
            type: data?.type ?? AttributeType.TEXT,
            scope: data?.scope ?? AttributeScope.PRODUCT,
            unit: data?.unit ?? "",
            required: data?.required ?? false,
            facetable: data?.facetable ?? false,
            multiValued: data?.multiValued ?? false,
            sortOrder: data?.sortOrder ?? 0,
        },
    });

    const pending = useRef(false);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState<"failed" | "saved" | null>(null);
    const isLoading = busy;
    const idleLabel = isEdit
        ? "Save attribute information"
        : "Create attribute";
    const submitLabel = isLoading ? "loading..." : idleLabel;

    const handleSubmit = async (values: AttributeDefinitionFormValues) => {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        onBusyChange?.(true);
        setFeedback(null);
        try {
            const response = await saveAction({
                ...values,
                id: data?.id,
            });
            setFeedback("saved");
            toast({
                title: isEdit
                    ? "Attribute has been updated."
                    : `'${response.name}' is now created.`,
            });
            if (isEdit) {
                router.refresh();
            } else {
                router.push("/dashboard/admin/attributes");
            }
        } catch (error: unknown) {
            setFeedback("failed");
            const message =
                error instanceof Error
                    ? error.message
                    : "An unknown error occurred";
            toast({
                variant: "destructive",
                title: "Oops!",
                description: message,
            });
        } finally {
            pending.current = false;
            setBusy(false);
            onBusyChange?.(false);
        }
    };

    return (
        <Card
            className={`${styles.theme} ${styles.panel} ${attributeStyles.surface}`}
        >
            <CardHeader>
                <h2>Attribute Information</h2>
                <CardDescription>
                    {isEdit
                        ? `Update the ${data?.name} attribute. The key cannot be changed.`
                        : "Define a structured attribute for a category. It is inherited by all descendant categories."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form
                        aria-label="Attribute information"
                        noValidate
                        aria-busy={busy}
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-4"
                    >
                        <fieldset disabled={busy} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="categoryId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Category</FormLabel>
                                        <FormControl>
                                            <select
                                                {...field}
                                                disabled={busy}
                                                className="h-11 w-full border px-3"
                                            >
                                                <option value="">
                                                    Select a category
                                                </option>
                                                {categories.map((category) => (
                                                    <option
                                                        key={category.id}
                                                        value={category.id}
                                                    >
                                                        {"— ".repeat(
                                                            category.depth
                                                        )}
                                                        {category.name} /
                                                        {category.path}
                                                    </option>
                                                ))}
                                            </select>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex flex-col gap-4 md:flex-row">
                                <FormField
                                    control={form.control}
                                    name="key"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>Key</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="screen_size"
                                                    disabled={
                                                        isEdit || isLoading
                                                    }
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>Display name</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Screen size"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="flex flex-col gap-4 md:flex-row">
                                <FormField
                                    control={form.control}
                                    name="type"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>Type</FormLabel>
                                            <FormControl>
                                                <select
                                                    {...field}
                                                    disabled={busy}
                                                    className="h-11 w-full border px-3"
                                                >
                                                    {Object.values(
                                                        AttributeType
                                                    ).map((value) => (
                                                        <option
                                                            key={value}
                                                            value={value}
                                                        >
                                                            {value}
                                                        </option>
                                                    ))}
                                                </select>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="scope"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>Scope</FormLabel>
                                            <FormControl>
                                                <select
                                                    {...field}
                                                    disabled={busy}
                                                    className="h-11 w-full border px-3"
                                                >
                                                    {Object.values(
                                                        AttributeScope
                                                    ).map((value) => (
                                                        <option
                                                            key={value}
                                                            value={value}
                                                        >
                                                            {value ===
                                                            AttributeScope.PRODUCT
                                                                ? "Product"
                                                                : "Variant"}
                                                        </option>
                                                    ))}
                                                </select>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="flex flex-col gap-4 md:flex-row">
                                <FormField
                                    control={form.control}
                                    name="unit"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>
                                                Unit (optional)
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="cm / inch / g"
                                                    {...field}
                                                    value={field.value ?? ""}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="sortOrder"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>Sort order</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    step={1}
                                                    value={field.value}
                                                    onChange={(event) =>
                                                        field.onChange(
                                                            event.target
                                                                .valueAsNumber
                                                        )
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            {BOOLEAN_FIELDS.map((item) => (
                                <FormField
                                    key={item.name}
                                    control={form.control}
                                    name={item.name}
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={(
                                                        checked
                                                    ) =>
                                                        field.onChange(
                                                            checked === true
                                                        )
                                                    }
                                                />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel className="inline-flex min-h-11 items-center">
                                                    {item.label}
                                                </FormLabel>
                                                <FormDescription>
                                                    {item.description}
                                                </FormDescription>
                                                <FormMessage />
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            ))}
                            <Button type="submit" disabled={isLoading}>
                                {submitLabel}
                            </Button>
                        </fieldset>
                    </form>
                </Form>
                <SaveFeedback busy={busy} feedback={feedback} />
            </CardContent>
        </Card>
    );
};

export default AttributeDetails;
