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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ImageUpload from "../shared/image-upload";

// Queries
import type { upsertCategory } from "@/queries/category";

// Utils
import { v4 } from "uuid";
// import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import styles from "../design/seller.module.css";
import categoryStyles from "./category.module.css";
import { useSaveState, SaveFeedback } from "./save-state";

interface CategoryFormProps {
    data?: Category;
    saveAction: typeof upsertCategory;
    onBusyChange?: (busy: boolean) => void;
    /**
     * 親の候補（pre-order で平坦化済みのツリー全体）。
     *
     * 未指定なら親選択を出さない（ルートのみ作成できる従来の挙動）。
     */
    categories?: Category[];
}

/** 親選択のRootを表す番兵。保存時は既存契約のnullへ変換する。 */
const ROOT_PARENT_VALUE = "__root__";

const CategoryForm: FC<CategoryFormProps> = ({
    data,
    categories,
    saveAction,
    onBusyChange,
}) => {
    // Initializing necessary hooks
    const state = useSaveState(onBusyChange);
    const router = useRouter(); // Hook for routing

    const { form, parentOptions } = useCategoryForm(data, categories);

    // Loading status based on form submission
    const isLoading = state.busy;

    const handleSubmit = (values: CategoryFormValues) =>
        state.save(
            () =>
                saveAction({
                    id: data?.id ?? v4(),
                    name: values.name,
                    image: values.image[0].url,
                    url: values.url,
                    featured: values.featured,
                    parentId: values.parentId,
                    sortOrder: values.sortOrder,
                    ...(data?.id ? {} : { createdAt: new Date() }),
                    updatedAt: new Date(),
                }),
            () => {
                if (data?.id) router.refresh();
                else router.push("/dashboard/admin/categories");
            }
        );

    return (
        <Card
            className={`${styles.panel} ${styles.editor} ${categoryStyles.editor}`}
        >
            <CardHeader>
                <h2 className="text-xl">Category information</h2>
                <CardDescription>
                    {data?.id
                        ? `Update ${data?.name} category information.`
                        : "Let's create a category. You can edit the category later from the categories table or the category page."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form
                        aria-label="Category information"
                        noValidate
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-4"
                    >
                        <fieldset disabled={isLoading} className="space-y-4">
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
                                                                current.url !==
                                                                url
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
                                            <Input
                                                placeholder="Name"
                                                {...field}
                                            />
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
                                            <FormLabel>
                                                Parent category
                                            </FormLabel>
                                            <FormControl>
                                                <select
                                                    disabled={isLoading}
                                                    className="w-full border p-2"
                                                    value={
                                                        field.value ??
                                                        ROOT_PARENT_VALUE
                                                    }
                                                    onChange={(event) =>
                                                        field.onChange(
                                                            event.target
                                                                .value ===
                                                                ROOT_PARENT_VALUE
                                                                ? null
                                                                : event.target
                                                                      .value
                                                        )
                                                    }
                                                >
                                                    <option
                                                        value={
                                                            ROOT_PARENT_VALUE
                                                        }
                                                    >
                                                        Root (no parent)
                                                    </option>
                                                    {parentOptions.map(
                                                        (category) => (
                                                            <option
                                                                key={
                                                                    category.id
                                                                }
                                                                value={
                                                                    category.id
                                                                }
                                                            >{`${"— ".repeat(category.depth)}${category.name}`}</option>
                                                        )
                                                    )}
                                                </select>
                                            </FormControl>
                                            <FormDescription>
                                                Leave as root to create a
                                                top-level department. Depth is
                                                capped at{" "}
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
                                                onCheckedChange={(value) =>
                                                    field.onChange(
                                                        value === true
                                                    )
                                                }
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
                        </fieldset>
                    </form>
                    <SaveFeedback {...state} />
                </Form>
            </CardContent>
        </Card>
    );
};

export default CategoryForm;
