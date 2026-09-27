"use client";

// React
import { FC } from "react";

// Prisma
import type { AttributeOption } from "@prisma/client";

// Form handling utilities
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Schema
import {
    AttributeOptionFormSchema,
    type AttributeOptionFormValues,
} from "@/lib/schemas";

// UI Components
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Queries
import { upsertAttributeOption } from "@/queries/attribute";

// Utils
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

interface AttributeOptionDetailsProps {
    definitionId: string;
    data?: AttributeOption;
}

/**
 * ENUM 属性の許容値フォーム（design.md Q6）。value は不変の機械値なので編集時は無効化し、
 * label の改名は FK 参照している既存商品の表示へそのまま追随する（A-4）。
 */
const AttributeOptionDetails: FC<AttributeOptionDetailsProps> = ({
    definitionId,
    data,
}) => {
    const { toast } = useToast();
    const router = useRouter();
    const isEdit = Boolean(data?.id);

    const form = useForm<AttributeOptionFormValues>({
        mode: "onChange",
        resolver: zodResolver(AttributeOptionFormSchema),
        defaultValues: {
            value: data?.value ?? "",
            label: data?.label ?? "",
            sortOrder: data?.sortOrder ?? 0,
        },
    });

    const isLoading = form.formState.isSubmitting;
    const idleLabel = isEdit ? "Save option" : "Add option";
    const submitLabel = isLoading ? "loading..." : idleLabel;

    const handleSubmit = async (values: AttributeOptionFormValues) => {
        try {
            await upsertAttributeOption(definitionId, {
                ...values,
                id: data?.id,
            });
            toast({
                title: isEdit
                    ? "Option has been updated."
                    : `'${values.label}' is now added.`,
            });
            if (!isEdit)
                form.reset({
                    value: "",
                    label: "",
                    sortOrder: values.sortOrder + 1,
                });
            router.refresh();
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : "An unknown error occurred";
            toast({
                variant: "destructive",
                title: "Oops!",
                description: message,
            });
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>{isEdit ? "Edit option" : "Add option"}</CardTitle>
                <CardDescription>
                    The value is a permanent machine key. Renaming the label
                    updates every product that uses this option.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="flex flex-col gap-4 md:flex-row md:items-end"
                    >
                        <FormField
                            control={form.control}
                            name="value"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormLabel>Value</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="wheat"
                                            disabled={isEdit || isLoading}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="label"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormLabel>Label</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Wheat" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="sortOrder"
                            render={({ field }) => (
                                <FormItem className="w-32">
                                    <FormLabel>Sort order</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={field.value}
                                            onChange={(event) =>
                                                field.onChange(
                                                    event.target.valueAsNumber
                                                )
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={isLoading}>
                            {submitLabel}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
};

export default AttributeOptionDetails;
