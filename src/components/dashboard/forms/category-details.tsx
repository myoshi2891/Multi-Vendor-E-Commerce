"use client";

// React
import { FC } from "react";

// Prisma model
import { Category } from "@prisma/client";

// カテゴリツリー（DB に触れない純粋ヘルパーのみ）
import { MAX_CATEGORY_DEPTH } from "@/lib/category-path";
import {
    useCategoryForm,
    type CategoryFormValues,
} from "@/components/dashboard/shared/use-category-form";

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

    const { form, parentOptions } = useCategoryForm(data, categories);

    // Loading status based on form submission
    const isLoading = form.formState.isSubmitting;

    // Submit handler for form submission
    const handleSubmit = async (values: CategoryFormValues) => {
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
                // 編集時は createdAt を送らない（サーバー側 update からも除外済み）。
                // 新規作成時のみ作成日時を渡す。
                ...(data?.id ? {} : { createdAt: new Date() }),
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
            if (error instanceof Error) {
                console.error(
                    "[CategoryDetails:handleSubmit] Failed to save category",
                    {
                        error: error.message,
                        stack: error.stack,
                    }
                );
            } else {
                console.error(
                    "[CategoryDetails:handleSubmit] Unknown error while saving category",
                    { error }
                );
            }
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
