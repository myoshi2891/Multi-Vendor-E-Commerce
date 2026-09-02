"use client";

// React
import { FC, useEffect } from "react";

// Prisma model
import { Category } from "@prisma/client";

// Form handling utilities
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Schema
import { CategoryFormSchema } from "@/lib/schemas";

// カテゴリツリー（DB に触れない純粋ヘルパーのみ）
import {
    isWithinSubtree,
    toCanonicalCategorySlug,
    MAX_CATEGORY_DEPTH,
} from "@/lib/category-path";

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
    FormDescription,
} from "@/components/ui/form";

import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ImageUpload from "../shared/image-upload";

// Queries
import { upsertCategory } from "@/queries/category";

// Utils
import { v4 } from "uuid";
// import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

interface CategoryDetailsProps {
    data?: Category;
    /**
     * 親の候補（pre-order で平坦化済みのツリー全体）。
     *
     * 未指定なら親選択を出さない（ルートのみ作成できる従来の挙動）。
     */
    categories?: Category[];
}

/** 親選択で「ルート」を表す番兵。空文字は Radix Select が扱えない。 */
const ROOT_PARENT_VALUE = "__root__";

const CategoryDetails: FC<CategoryDetailsProps> = ({ data, categories }) => {
    // Initializing necessary hooks
    const { toast } = useToast(); // Hook for displaying toast messages
    const router = useRouter(); // Hook for routing

    // Form hook for managing form state and validation
    const form = useForm<z.infer<typeof CategoryFormSchema>>({
        mode: "onChange", // Form validation mode
        resolver: zodResolver(CategoryFormSchema), // Resolver for form validation
        defaultValues: {
            // Setting default form values from data (if available)
            name: data?.name ?? "",
            image: data?.image ? [{ url: data.image }] : [],
            // 移行で温存された旧 url（大文字・`_`・空白）は CategoryFormSchema の
            // 正規表現を通らない。正準形へ寄せておかないと、その行は featured の
            // 切り替えすら保存できない（旧 slug は保存時に別名表へ残る）。
            url: data?.url ? toCanonicalCategorySlug(data.url) : "",
            featured: data?.featured ?? false,
            parentId: data?.parentId ?? null,
            sortOrder: data?.sortOrder ?? 0,
        },
    });

    // Loading status based on form submission
    const isLoading = form.formState.isSubmitting;

    // 親に選べないノードを落とす。
    // - 自分自身と自分の子孫（循環になる。サーバー側も V-7b / V-7c で拒否する）
    // - depth が上限のノード（その下は上限を超える）
    // **UI の絞り込みは表示上の親切であって強制ではない** —— 本体の検証は
    // upsertCategory 側にある。
    const parentOptions = (categories ?? []).filter((candidate) => {
        if (data && candidate.id === data.id) return false;
        if (data && isWithinSubtree(candidate.path, data.path)) return false;
        return candidate.depth < MAX_CATEGORY_DEPTH;
    });

    // Reset form values when data changes
    useEffect(() => {
        if (data) {
            form.reset({
                name: data.name ?? "",
                image: data.image ? [{ url: data.image }] : [],
                url: data.url ? toCanonicalCategorySlug(data.url) : "",
                featured: data.featured ?? false,
                parentId: data.parentId ?? null,
                sortOrder: data.sortOrder ?? 0,
            });
        }
    }, [data, form]);

    // Submit handler for form submission
    const handleSubmit = async (values: z.infer<typeof CategoryFormSchema>) => {
        try {
            // Upserting category data
            const response = await upsertCategory({
                id: data?.id ? data.id : v4(),
                name: values.name,
                image: values.image[0].url,
                url: values.url,
                featured: values.featured,
                parentId: values.parentId,
                sortOrder: values.sortOrder,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Displaying success message
            toast({
                title: data?.id
                    ? "Category has been updated."
                    : `Congratulations! '${response?.name}' is now created.`,
            });

            // Redirect or Refresh data
            if (data?.id) {
                router.refresh();
            } else {
                router.push("/dashboard/admin/categories");
            }
        } catch (error: unknown) {
            // Handling form submission errors
            const message =
                error instanceof Error
                    ? error.message
                    : "An unknown error occurred";
            console.error(error);
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
                <CardTitle>Category Information</CardTitle>
                <CardDescription>
                    {data?.id
                        ? `Update ${data?.name} category information.`
                        : " Lets create a category. You can edit category later from the categories table or the category page."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-4"
                    >
                        <FormField
                            control={form.control}
                            name="image"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <ImageUpload
                                            type="profile"
                                            value={field.value.map(
                                                (image) => image.url
                                            )}
                                            disabled={isLoading}
                                            onChange={(url) =>
                                                field.onChange([{ url }])
                                            }
                                            onRemove={(url) =>
                                                field.onChange([
                                                    ...field.value.filter(
                                                        (current) =>
                                                            current.url !== url
                                                    ),
                                                ])
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            // disabled={isLoading}
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormLabel>Category name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Name" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        This is your public display name.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            // disabled={isLoading}
                            control={form.control}
                            name="url"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormLabel>Category url</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="/category-url"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {categories && (
                            <FormField
                                control={form.control}
                                name="parentId"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel>Parent category</FormLabel>
                                        <Select
                                            disabled={isLoading}
                                            onValueChange={(value) =>
                                                field.onChange(
                                                    value === ROOT_PARENT_VALUE
                                                        ? null
                                                        : value
                                                )
                                            }
                                            value={
                                                field.value ?? ROOT_PARENT_VALUE
                                            }
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Root (no parent)" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem
                                                    value={ROOT_PARENT_VALUE}
                                                >
                                                    Root (no parent)
                                                </SelectItem>
                                                {parentOptions.map(
                                                    (category) => (
                                                        <SelectItem
                                                            key={category.id}
                                                            value={category.id}
                                                        >
                                                            {"\u00A0".repeat(
                                                                category.depth *
                                                                    4
                                                            )}
                                                            {category.name}
                                                        </SelectItem>
                                                    )
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            Leave as root to create a top-level
                                            department. Depth is capped at{" "}
                                            {MAX_CATEGORY_DEPTH + 1} levels.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
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
                                            placeholder="0"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Position among siblings. Lower comes
                                        first.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="featured"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            // @ts-ignore
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Featured</FormLabel>
                                        <FormDescription>
                                            This Category will appear on the
                                            home page
                                        </FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={isLoading}>
                            {isLoading
                                ? "loading..."
                                : data?.id
                                  ? "Save category information"
                                  : "Create category"}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
};

export default CategoryDetails;
