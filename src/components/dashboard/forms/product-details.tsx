"use client";

// React, Next.js
import sellerStyles from "../design/seller.module.css";
import { useRouter } from "next/navigation";
import { FC, useEffect, useMemo, useRef, useState } from "react";

// Prisma model
import { Category, Country, OfferTag, ShippingFeeMethod } from "@prisma/client";

// Form handling utilities
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

// Schema（カテゴリ別属性で動的に拡張する・plan 069）
import {
    emptyAttributeValues,
    makeProductSchema,
    toAttributePayload,
    type ProductFormWithAttributes,
} from "@/lib/attribute-schema";
import {
    findSpecAttributeOverlaps,
    type AttributeDefinitionDTO,
} from "@/lib/attribute-definitions";

// カテゴリツリー（DB に触れない純粋ヘルパーのみ）
import { isProductAssignableCategory } from "@/lib/category-path";

// UI Components
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "react-multi-select-component";

import { useToast } from "@/hooks/use-toast";
import ImageUpload from "../shared/image-upload";

// Queries
import type { ProductFormActions } from "@/lib/seller-products";

// ReactTags
import { WithOutContext as ReactTags } from "react-tag-input";

// Jodit text editor
import JoditEditor from "jodit-react";

// Utils
import { v4 } from "uuid";

// Types
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { ProductFormData } from "@/lib/types";
import ImagesPreviewGrid from "../shared/images-preview-grid";
import ClickToAddInputs from "./click-to-add";
import AttributeFields from "./attribute-fields";

// React date time picker
import DateTimePicker from "react-datetime-picker";
import "react-datetime-picker/dist/DateTimePicker.css";
import "react-calendar/dist/Calendar.css";
import "react-clock/dist/Clock.css";
import { NumberInput } from "@tremor/react";
import InputFieldset from "../shared/input-fieldset";
import { ArrowRight, Dot } from "lucide-react";
import { useTheme } from "next-themes";
// import { useToast } from "@/components/ui/use-toast";

const shippingFeeMethods = [
    {
        value: ShippingFeeMethod.ITEM,
        description: "ITEM (Fees calculated based on number of products.)",
    },
    {
        value: ShippingFeeMethod.WEIGHT,
        description: "WEIGHT (Fees calculated based on product weight.)",
    },
    {
        value: ShippingFeeMethod.FIXED,
        description: "FIXED (Fees are fixed.)",
    },
];

interface ProductDetailsProps extends ProductFormActions {
    design?: "seller";
    data?: ProductFormData;
    categories: Category[];
    offerTags: OfferTag[];
    storeUrl: string;
    countries: Country[];
}

const ProductDetails: FC<ProductDetailsProps> = ({
    data,
    categories,
    offerTags,
    storeUrl,
    countries,
    upsertProductAction,
    getAttributeDefinitionsAction,
    design,
}) => {
    // Initializing necessary hooks
    const { toast } = useToast(); // Hook for displaying toast messages
    const router = useRouter(); // Hook for routing

    // Is new variant page
    const isNewVariantPage = data?.productId && !data?.variantId;

    // Jodit editor refs
    const productDescEditor = useRef(null);
    const variantDescEditor = useRef(null);

    // Jodit configuration
    const { theme } = useTheme();

    const config = useMemo(
        () => ({
            theme: theme === "dark" ? "dark" : "default",
            readonly: false,
        }),
        [theme]
    );

    // State for colors
    const [colors, setColors] = useState<{ color: string }[]>(
        data?.colors || [{ color: "" }]
    );

    // State for keywords
    const [keywords, setKeywords] = useState<string[]>(data?.keywords || []);

    // State for sizes
    const [sizes, setSizes] = useState<
        { size: string; price: number; quantity: number; discount: number }[]
    >(data?.sizes || [{ size: "", quantity: 1, price: 0.01, discount: 0 }]);

    // State for product specs
    const [productSpecs, setProductSpecs] = useState<
        { name: string; value: string }[]
    >(data?.product_specs || [{ name: "", value: "" }]);

    // State for product variant specs
    const [variantSpecs, setVariantSpecs] = useState<
        { name: string; value: string }[]
    >(data?.variant_specs || [{ name: "", value: "" }]);

    // State for product variant specs
    const [questions, setQuestions] = useState<
        { question: string; answer: string }[]
    >(data?.questions || [{ question: "", answer: "" }]);

    // Temporary state for images
    const [images, setImages] = useState<{ url: string }[]>([]);

    // 選択カテゴリに効く属性定義（祖先から継承・同一 key は最深ノード）。
    // カテゴリ選択の変更で再取得し、スキーマも作り直す（design.md Q4）。
    const [attributeDefs, setAttributeDefs] = useState<
        AttributeDefinitionDTO[]
    >([]);
    // 直前に反映した定義。「定義なし → 定義なし」の遷移では state もフォーム値も
    // 触らない（無意味な再描画と、テスト環境での act 外更新を避ける）。
    const appliedDefsRef = useRef<AttributeDefinitionDTO[]>([]);
    // 属性定義の取得失敗を販売者に伝える（黙って欄が消えると入力漏れに気づけない）
    const [attributeLoadError, setAttributeLoadError] = useState<string | null>(
        null
    );
    // 新バリアント画面では商品レベルを編集しないので、PRODUCT 属性は描画も送信もしない
    // （送らない = サーバー側で同期対象外）。
    const includeProductScope = !isNewVariantPage;
    // 編集中レコードの現在値に含まれるアーカイブ済み選択肢（A-11）。候補と検証の両方に足す
    const archivedCurrent = data?.archivedCurrent;
    const productSchema = useMemo(
        () =>
            makeProductSchema(attributeDefs, {
                includeProductScope,
                archivedCurrent,
            }),
        [attributeDefs, includeProductScope, archivedCurrent]
    );

    // Form hook for managing form state and validation
    const form = useForm<ProductFormWithAttributes>({
        mode: "onChange", // Form validation mode
        resolver: zodResolver(productSchema), // Resolver for form validation
        defaultValues: {
            // 既存レコードの値（編集ページ）。定義の取得後は有効な定義の分だけが残る
            productAttributes: data?.productAttributes ?? {},
            variantAttributes: data?.variantAttributes ?? {},
            // Setting default form values from data (if available)
            name: data?.name ?? "",
            description: data?.description ?? "",
            variantName: data?.variantName ?? "",
            variantDescription: data?.variantDescription ?? "",
            images: data?.images || [],
            variantImage: data?.variantImage
                ? [{ url: data.variantImage }]
                : [],
            categoryId: data?.categoryId,
            subCategoryId: data?.subCategoryId,
            offerTagId: data?.offerTagId,
            brand: data?.brand ?? "",
            sku: data?.sku ?? "",
            colors: data?.colors,
            sizes: data?.sizes ?? [],
            product_specs: data?.product_specs ?? [],
            variant_specs: data?.variant_specs ?? [],
            keywords: data?.keywords ?? [],
            questions: data?.questions ?? [],
            isSale: data?.isSale ?? false,
            weight: data?.weight,
            saleEndDate: data?.saleEndDate || new Date().toISOString(),
            freeShippingForAllCountries: data?.freeShippingForAllCountries,
            freeShippingCountriesIds: data?.freeShippingCountriesIds || [],
            shippingFeeMethod: data?.shippingFeeMethod,
        },
    });

    const saleEndDate =
        form.getValues().saleEndDate || new Date().toISOString();
    const formattedDate = new Date(saleEndDate).toLocaleString("en-Us", {
        weekday: "short", // Abbreviated day name (e.g., "Mon")
        month: "long", // Abbreviated month name (e.g., "Nov")
        day: "2-digit", // Two-digit day (e.g., "25")
        year: "numeric", // Full year (e.g., "2024")
        hour: "2-digit", // Two-digit hour (e.g., "02")
        minute: "2-digit", // Two-digit minute (e.g., "30")
        // second: '2-digit', // Two-digit second (optional)
        hour12: false, // 12-hour format (change to false for 24-hour format)    })
    });

    // カテゴリはツリーから 1 本で選ぶ（plan 068）。選択値はリーフ（= 旧 subCategory）で、
    // 商品側の categoryId（ルート）はそこから導出する —— Phase B の Product は
    // 旧 2 FK が NOT NULL のままなので、リーフだけでは書き込めない。
    const selectedNodeId = form.watch().subCategoryId;
    useEffect(() => {
        if (!selectedNodeId) return;
        const selected = categories.find((node) => node.id === selectedNodeId);
        if (!selected) return;

        // ルートは path の先頭セグメント。祖先を辿らずに済むうえ、
        // path が正であることに依存を一本化できる。
        const rootPath = selected.path.split("/")[0];
        const root = categories.find((node) => node.path === rootPath);
        if (root && form.getValues().categoryId !== root.id) {
            form.setValue("categoryId", root.id, { shouldValidate: true });
        }
    }, [selectedNodeId, categories, form]);

    // カテゴリが変わったら属性定義を取り直す（古い応答で上書きしないよう cancelled で守る）
    useEffect(() => {
        let cancelled = false;
        const fetchDefinitions = async () => {
            try {
                const defs = selectedNodeId
                    ? await getAttributeDefinitionsAction(selectedNodeId)
                    : [];
                if (cancelled) return;
                setAttributeLoadError(null);
                if (defs.length === 0 && appliedDefsRef.current.length === 0) {
                    return;
                }
                appliedDefsRef.current = defs;
                setAttributeDefs(defs);
                // 消えた定義の値は持ち越さず、残った定義の入力は保つ
                form.setValue(
                    "productAttributes",
                    emptyAttributeValues(
                        defs,
                        "PRODUCT",
                        form.getValues().productAttributes
                    )
                );
                form.setValue(
                    "variantAttributes",
                    emptyAttributeValues(
                        defs,
                        "VARIANT",
                        form.getValues().variantAttributes
                    )
                );
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error(
                        "[ProductDetails:fetchDefinitions] Error:",
                        error.message,
                        error.stack
                    );
                } else {
                    console.error(
                        "[ProductDetails:fetchDefinitions] Unknown error:",
                        error
                    );
                }
                if (cancelled) return;
                setAttributeLoadError(
                    "Failed to load attributes for this category. Please reselect the category to try again."
                );
                if (appliedDefsRef.current.length > 0) {
                    appliedDefsRef.current = [];
                    setAttributeDefs([]);
                }
            }
        };
        void fetchDefinitions();
        return () => {
            cancelled = true;
        };
    }, [selectedNodeId, form, getAttributeDefinitionsAction]);

    const productAttributeDefs = attributeDefs.filter(
        (def) => def.scope === "PRODUCT"
    );
    const variantAttributeDefs = attributeDefs.filter(
        (def) => def.scope === "VARIANT"
    );

    // Spec 名が構造化属性と重なったら警告する（ブロックしない・design.md Q3 併存ルール 2）。
    // 新バリアント画面では商品 Spec を編集しないので対象外。
    const specOverlaps = useMemo(
        () =>
            findSpecAttributeOverlaps(
                [...(isNewVariantPage ? [] : productSpecs), ...variantSpecs],
                attributeDefs
            ),
        [isNewVariantPage, productSpecs, variantSpecs, attributeDefs]
    );

    // Extract errors state from form
    const errors = form.formState.errors;

    // Loading status based on form submission
    const isLoading = form.formState.isSubmitting;
    const savingRef = useRef(false);
    const [saveState, setSaveState] = useState<
        "idle" | "saving" | "error" | "success"
    >("idle");

    // Reset form values when data changes
    useEffect(() => {
        if (data) {
            // フォームをリセット
            form.reset({
                ...data,
                variantImage: data.variantImage
                    ? [{ url: data.variantImage }]
                    : [],
                // 属性値は定義の取得後に埋める（上の fetchDefinitions）
                productAttributes: form.getValues().productAttributes ?? {},
                variantAttributes: form.getValues().variantAttributes ?? {},
            });

            // すべての local state を再初期化
            setColors(data.colors || [{ color: "" }]);
            setSizes(
                data.sizes || [
                    { size: "", quantity: 1, price: 0.01, discount: 0 },
                ]
            );
            setProductSpecs(data.product_specs || [{ name: "", value: "" }]);
            setVariantSpecs(data.variant_specs || [{ name: "", value: "" }]);
            setQuestions(data.questions || [{ question: "", answer: "" }]);
            setKeywords(data.keywords || []);
            setImages(data.images || []);
        }
    }, [data, form]);

    // Submit handler for form submission
    const handleSubmit = async (values: ProductFormWithAttributes) => {
        if (savingRef.current) return;
        savingRef.current = true;
        setSaveState("saving");
        try {
            const variantId = data?.variantId ? data.variantId : v4();
            // colors から空プレースホルダーを除外
            const filteredColors = values.colors.filter(
                (c) => c.color.trim() !== ""
            );
            const normalizedColors =
                filteredColors.length > 0 ? filteredColors : [];

            // Upserting product data
            const response = await upsertProductAction(
                {
                    productId: data?.productId ? data.productId : v4(),
                    variantId,
                    name: values.name,
                    description: values.description,
                    variantName: values.variantName,
                    variantDescription: values.variantDescription || "",
                    categoryId: values.categoryId,
                    subCategoryId: values.subCategoryId,
                    offerTagId: values.offerTagId || "",
                    images: values.images,
                    variantImage: values.variantImage[0].url,
                    isSale: values.isSale,
                    saleEndDate: values.saleEndDate,
                    brand: values.brand,
                    sku: values.sku,
                    weight: values.weight,
                    colors: normalizedColors,
                    sizes: values.sizes || [],
                    product_specs: values.product_specs,
                    variant_specs: values.variant_specs,
                    keywords: values.keywords || [],
                    questions: values.questions || [],
                    shippingFeeMethod: values.shippingFeeMethod,
                    freeShippingForAllCountries:
                        values.freeShippingForAllCountries,
                    freeShippingCountriesIds:
                        values.freeShippingCountriesIds || [],
                    attributes: toAttributePayload(attributeDefs, values, {
                        variantId,
                        includeProductScope,
                    }),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                storeUrl
            );
            setSaveState("success");
            // Seller forms announce feedback inline in their scoped theme.
            if (design !== "seller") toast({
                title:
                    data?.productId && data?.variantId
                        ? "Product has been updated."
                        : `Congratulations! Product is now created.`,
            });
            // Redirect or Refresh data
            if (data?.productId && data?.variantId) {
                router.refresh();
            } else {
                router.push(`/dashboard/seller/stores/${storeUrl}/products`);
            }
        } catch (error: unknown) {
            // Handling form submission errors
            setSaveState("error");
            const message =
                design === "seller"
                    ? "Could not save the product. Please try again."
                    : error instanceof Error
                      ? error.message
                      : "An unknown error occurred";
            if (error instanceof Error) {
                console.error(
                    "ProductDetails submit error:",
                    error.message,
                    error.stack
                );
            } else {
                console.error("ProductDetails submit error:", error);
            }
            if (design !== "seller") toast({
                variant: "destructive",
                title: "Oops!",
                description: message,
            });
        } finally {
            savingRef.current = false;
        }
    };

    interface Keyword {
        id: string;
        text: string;
    }

    const handleAddition = (keyword: Keyword) => {
        if (keywords.length === 10) return;
        setKeywords([...keywords, keyword.text]);
    };

    const handleDeleteKeyword = (index: number) => {
        setKeywords(keywords.filter((_, i) => i !== index));
    };

    // Whenever colors, sizes, keywords changes we update the form values
    useEffect(() => {
        // colors/keywords を常に form に反映（空配列も含む）
        form.setValue("colors", colors);
        form.setValue("keywords", keywords);

        // sizes, questions, specs は常に同期（既存の挙動を維持）
        form.setValue("sizes", sizes);
        form.setValue("questions", questions);
        form.setValue("product_specs", productSpecs);
        form.setValue("variant_specs", variantSpecs);
    }, [colors, sizes, keywords, questions, productSpecs, variantSpecs, form]);

    //Countries options
    type CountryOption = {
        label: string;
        value: string;
    };

    const countryOptions: CountryOption[] = countries.map((c) => ({
        label: c.name,
        value: c.id,
    }));

    const handleDeleteCountryFreeShipping = (index: number) => {
        const currentValues = form.getValues().freeShippingCountriesIds;
        const updatedValues = currentValues.filter((_, i) => i !== index);
        form.setValue("freeShippingCountriesIds", updatedValues);
    };

    return (
        <Card className={design === "seller" ? sellerStyles.editor : "w-full"}>
            <CardHeader>
                <CardTitle
                    role={design === "seller" ? "heading" : undefined}
                    aria-level={design === "seller" ? 2 : undefined}
                >
                    {design === "seller"
                        ? "Product information"
                        : data?.productId && data?.variantId
                          ? `Edit ${data.name} Product Information`
                          : isNewVariantPage
                            ? `Add a new variant to ${data.name}`
                            : "Create a new Product Information"}
                </CardTitle>
                <CardDescription>
                    {data?.productId && data?.variantId
                        ? `Update ${data?.name} product information.`
                        : "Let's create a product. You can edit product later from the store products page."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-4"
                    >
                        <fieldset
                            disabled={isLoading}
                            className="min-w-0 space-y-4"
                            aria-label="Product fields"
                        >
                            {/* Images - colors */}
                            <div className="flex flex-col gap-y-6 xl:flex-row">
                                {/* Images */}
                                <FormField
                                    control={form.control}
                                    name="images"
                                    render={({ field }) => (
                                        <FormItem className="w-full xl:border-r">
                                            <FormControl>
                                                <>
                                                    <ImagesPreviewGrid
                                                        images={
                                                            form.getValues()
                                                                .images
                                                        }
                                                        onRemove={(url) => {
                                                            const updatedImages =
                                                                images.filter(
                                                                    (img) =>
                                                                        img.url !==
                                                                        url
                                                                );
                                                            setImages(
                                                                updatedImages
                                                            );
                                                            field.onChange(
                                                                updatedImages
                                                            );
                                                        }}
                                                        colors={colors}
                                                        setColors={setColors}
                                                    />
                                                    <FormMessage className="!mt-4" />
                                                    <ImageUpload
                                                        dontShowPreview
                                                        type="standard"
                                                        value={field.value.map(
                                                            (image) => image.url
                                                        )}
                                                        onChange={(url) => {
                                                            setImages(
                                                                (
                                                                    prevImages
                                                                ) => {
                                                                    const updatedImages =
                                                                        [
                                                                            ...prevImages,
                                                                            {
                                                                                url,
                                                                            },
                                                                        ];
                                                                    field.onChange(
                                                                        updatedImages
                                                                    );
                                                                    return updatedImages;
                                                                }
                                                            );
                                                        }}
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
                                                </>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                {/* Colors */}
                                <div className="flex w-full flex-col gap-y-3 xl:pl-5">
                                    <ClickToAddInputs
                                        design={design}
                                        details={colors}
                                        setDetails={setColors}
                                        initialDetail={{ color: "" }}
                                        header="Colors"
                                        colorPicker
                                    />
                                    {errors.colors && (
                                        <span className="text-sm font-medium text-destructive">
                                            {errors.colors.message}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {/* Name */}
                            <InputFieldset label="Name">
                                <div className="flex flex-col gap-4 lg:flex-row">
                                    {!isNewVariantPage && (
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Product Name"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                    <FormField
                                        control={form.control}
                                        name="variantName"
                                        render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <FormControl>
                                                    <Input
                                                        placeholder="Variant Name"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </InputFieldset>
                            {/* Product and variant description editors (tabs) */}
                            {!isNewVariantPage && (
                                <InputFieldset
                                    label="Description Editors"
                                    description={
                                        isNewVariantPage
                                            ? ""
                                            : " Note: The product description is the main description for the product (Will display in every variant page). You can add an extra description specific to this variant using Variant description tab"
                                    }
                                >
                                    <Tabs
                                        defaultValue={
                                            isNewVariantPage
                                                ? "variant"
                                                : "product"
                                        }
                                        className="w-full"
                                    >
                                        {!isNewVariantPage && (
                                            <TabsList className="grid w-full grid-cols-2">
                                                <TabsTrigger value="product">
                                                    Product description
                                                </TabsTrigger>
                                                <TabsTrigger value="variant">
                                                    Variant description
                                                </TabsTrigger>
                                            </TabsList>
                                        )}
                                        <TabsContent value="product">
                                            <FormField
                                                control={form.control}
                                                name="description"
                                                render={({ field }) => (
                                                    <FormItem className="flex-1">
                                                        <FormControl>
                                                            <JoditEditor
                                                                ref={
                                                                    productDescEditor
                                                                }
                                                                config={{
                                                                    ...config,
                                                                    readonly:
                                                                        isLoading,
                                                                }}
                                                                value={
                                                                    form.getValues()
                                                                        .description
                                                                }
                                                                onChange={(
                                                                    content
                                                                ) => {
                                                                    form.setValue(
                                                                        "description",
                                                                        content
                                                                    );
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </TabsContent>
                                        <TabsContent value="variant">
                                            <FormField
                                                control={form.control}
                                                name="variantDescription"
                                                render={({ field }) => (
                                                    <FormItem className="flex-1">
                                                        <FormControl>
                                                            <JoditEditor
                                                                ref={
                                                                    variantDescEditor
                                                                }
                                                                config={{
                                                                    ...config,
                                                                    readonly:
                                                                        isLoading,
                                                                }}
                                                                value={
                                                                    form.getValues()
                                                                        .variantDescription ||
                                                                    ""
                                                                }
                                                                onChange={(
                                                                    content
                                                                ) => {
                                                                    form.setValue(
                                                                        "variantDescription",
                                                                        content
                                                                    );
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </TabsContent>
                                    </Tabs>
                                </InputFieldset>
                            )}
                            {/* Category - SubCategory - offer */}
                            <InputFieldset label="Category">
                                <div className="flex flex-col gap-4 lg:flex-row">
                                    <FormField
                                        control={form.control}
                                        name="subCategoryId"
                                        render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <Select
                                                    disabled={
                                                        isLoading ||
                                                        categories.length === 0
                                                    }
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                    value={field.value}
                                                    defaultValue={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger aria-label="Category">
                                                            <SelectValue
                                                                defaultValue={
                                                                    field.value
                                                                }
                                                                placeholder="Select a category"
                                                            />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent
                                                        className={
                                                            design === "seller"
                                                                ? sellerStyles.theme
                                                                : undefined
                                                        }
                                                    >
                                                        {categories.map(
                                                            (category) => (
                                                                <SelectItem
                                                                    key={
                                                                        category.id
                                                                    }
                                                                    value={
                                                                        category.id
                                                                    }
                                                                    disabled={
                                                                        !isProductAssignableCategory(
                                                                            category
                                                                        )
                                                                    }
                                                                >
                                                                    {"\u00A0".repeat(
                                                                        category.depth *
                                                                            4
                                                                    )}
                                                                    {
                                                                        category.name
                                                                    }
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />{" "}
                                    {/* Offer Tag */}
                                    <FormField
                                        disabled={isLoading}
                                        control={form.control}
                                        name="offerTagId"
                                        render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <Select
                                                    disabled={
                                                        isLoading ||
                                                        categories.length == 0
                                                    }
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                    value={field.value}
                                                    defaultValue={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger aria-label="Offer">
                                                            <SelectValue
                                                                defaultValue={
                                                                    field.value
                                                                }
                                                                placeholder="Select an offer"
                                                            />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent
                                                        className={
                                                            design === "seller"
                                                                ? sellerStyles.theme
                                                                : undefined
                                                        }
                                                    >
                                                        {offerTags &&
                                                            offerTags.map(
                                                                (offer) => (
                                                                    <SelectItem
                                                                        key={
                                                                            offer.id
                                                                        }
                                                                        value={
                                                                            offer.id
                                                                        }
                                                                    >
                                                                        {
                                                                            offer.name
                                                                        }
                                                                    </SelectItem>
                                                                )
                                                            )}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </InputFieldset>
                            {/* カテゴリ別属性（plan 069）: 商品レベルは 1 度だけ、バリアント属性はこのバリアントに */}
                            {attributeLoadError && (
                                <p
                                    role="alert"
                                    className="rounded-md border border-destructive/50 p-3 text-sm font-medium text-destructive"
                                >
                                    {attributeLoadError}
                                </p>
                            )}
                            {includeProductScope &&
                                productAttributeDefs.length > 0 && (
                                    <InputFieldset label="Product attributes">
                                        <AttributeFields
                                            control={form.control}
                                            prefix="productAttributes"
                                            definitions={productAttributeDefs}
                                            archivedCurrent={archivedCurrent}
                                            disabled={isLoading}
                                        />
                                    </InputFieldset>
                                )}
                            {variantAttributeDefs.length > 0 && (
                                <InputFieldset label="Variant attributes">
                                    <AttributeFields
                                        control={form.control}
                                        prefix="variantAttributes"
                                        definitions={variantAttributeDefs}
                                        archivedCurrent={archivedCurrent}
                                        disabled={isLoading}
                                    />
                                </InputFieldset>
                            )}
                            {/* Brand, Sku, weight */}
                            <InputFieldset
                                label={
                                    isNewVariantPage
                                        ? "Sku, Weight"
                                        : "Brand, Sku, Weight"
                                }
                            >
                                <div className="flex flex-col gap-4 lg:flex-row">
                                    {!isNewVariantPage && (
                                        <FormField
                                            control={form.control}
                                            name="brand"
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormControl>
                                                        <Input
                                                            placeholder="Product Brand"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                    <FormField
                                        control={form.control}
                                        name="sku"
                                        render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <FormControl>
                                                    <Input
                                                        placeholder="Product Sku"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="weight"
                                        render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <FormControl>
                                                    <NumberInput
                                                        defaultValue={
                                                            field.value
                                                        }
                                                        onValueChange={
                                                            field.onChange
                                                        }
                                                        placeholder="Product Weight"
                                                        min={0.01}
                                                        step={0.01}
                                                        className="rounded-md !text-sm !shadow-none"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </InputFieldset>

                            {/* Variant image - Keywords */}
                            <div
                                className={
                                    design === "seller"
                                        ? sellerStyles.mediaEditor
                                        : "flex items-center gap-10 py-14"
                                }
                            >
                                {/* Variant image */}
                                <div
                                    className={
                                        design === "seller"
                                            ? "min-w-0"
                                            : "border-r pr-10"
                                    }
                                >
                                    <FormField
                                        control={form.control}
                                        name="variantImage"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel
                                                    className={
                                                        design === "seller"
                                                            ? "block"
                                                            : "ml-14"
                                                    }
                                                >
                                                    Variant Image
                                                </FormLabel>
                                                <FormControl>
                                                    <ImageUpload
                                                        dontShowPreview
                                                        type="profile"
                                                        value={field.value.map(
                                                            (image) => image.url
                                                        )}
                                                        onChange={(url) =>
                                                            field.onChange([
                                                                { url },
                                                            ])
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
                                                <FormMessage className="!mt-4" />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                {/* Keywords */}
                                <div className="w-full flex-1 space-y-3">
                                    <FormField
                                        control={form.control}
                                        name="keywords"
                                        render={({ field }) => (
                                            <FormItem className="relative flex-1">
                                                <FormLabel>
                                                    Product Label
                                                </FormLabel>
                                                <FormControl>
                                                    <ReactTags
                                                        handleAddition={
                                                            handleAddition
                                                        }
                                                        handleDelete={
                                                            handleDeleteKeyword
                                                        }
                                                        placeholder="Keywords (e.g., size, color, material)"
                                                        classNames={{
                                                            tagInputField:
                                                                "bg-background border rounded-md p-2 w-full focus:outline-none",
                                                        }}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <div className="flex flex-wrap gap-1">
                                        {keywords.map((k, i) => (
                                            <div
                                                key={i}
                                                className="inline-flex items-center gap-x-2 rounded-full bg-blue-200 px-3 py-1 text-xs text-blue-700"
                                            >
                                                <span>{k}</span>
                                                <span
                                                    className="cursor-pointer"
                                                    onClick={() =>
                                                        handleDeleteKeyword(i)
                                                    }
                                                >
                                                    x
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {/* Sizes */}
                            <InputFieldset label="Sizes, Quantities, Prices, Discounts">
                                <div className="flex w-full flex-col gap-y-3">
                                    <ClickToAddInputs
                                        design={design}
                                        details={sizes}
                                        setDetails={setSizes}
                                        initialDetail={{
                                            size: "",
                                            quantity: 1,
                                            price: 0.01,
                                            discount: 0,
                                        }}
                                        containerClassName="flex-1"
                                        inputClassName="w-full"
                                    />
                                    {errors.sizes && (
                                        <span className="text-sm font-medium text-destructive">
                                            {errors.sizes.message}
                                        </span>
                                    )}
                                </div>
                            </InputFieldset>

                            {/* Product and variant specs */}
                            <InputFieldset
                                label="Specifications"
                                description={
                                    isNewVariantPage
                                        ? ""
                                        : "Note: The product specifications are the main specs for the product (Will display in every variant page). You can add extra specs specific to this variant using 'Variant Specifications' tab."
                                }
                            >
                                <Tabs
                                    defaultValue={
                                        isNewVariantPage
                                            ? "variantSpecs"
                                            : "productSpecs"
                                    }
                                    className="w-full"
                                >
                                    {!isNewVariantPage && (
                                        <TabsList className="grid w-full grid-cols-2">
                                            <TabsTrigger value="productSpecs">
                                                Product Specifications
                                            </TabsTrigger>
                                            <TabsTrigger value="variantSpecs">
                                                Variant Specifications
                                            </TabsTrigger>
                                        </TabsList>
                                    )}
                                    <TabsContent value="productSpecs">
                                        <div className="flex w-full flex-col gap-y-3">
                                            <ClickToAddInputs
                                                design={design}
                                                details={productSpecs}
                                                setDetails={setProductSpecs}
                                                initialDetail={{
                                                    name: "",
                                                    value: "",
                                                }}
                                                containerClassName="flex-1"
                                                inputClassName="w-full"
                                            />
                                            {errors.product_specs && (
                                                <span className="text-sm font-medium text-destructive">
                                                    {
                                                        errors.product_specs
                                                            .message
                                                    }
                                                </span>
                                            )}
                                        </div>
                                    </TabsContent>
                                    <TabsContent value="variantSpecs">
                                        <div className="flex w-full flex-col gap-y-3">
                                            <ClickToAddInputs
                                                design={design}
                                                details={variantSpecs}
                                                setDetails={setVariantSpecs}
                                                initialDetail={{
                                                    name: "",
                                                    value: "",
                                                }}
                                                containerClassName="flex-1"
                                                inputClassName="w-full"
                                            />
                                            {errors.variant_specs && (
                                                <span className="text-sm font-medium text-destructive">
                                                    {
                                                        errors.variant_specs
                                                            .message
                                                    }
                                                </span>
                                            )}
                                        </div>
                                    </TabsContent>
                                </Tabs>
                                {specOverlaps.length > 0 && (
                                    <output className="mt-3 block rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                                        <p>
                                            These specifications duplicate
                                            attributes of this category. Enter
                                            the values in the attribute fields
                                            and keep specifications for
                                            supplementary notes.
                                        </p>
                                        <ul className="mt-1 list-disc pl-5">
                                            {specOverlaps.map((overlap) => (
                                                <li key={overlap.specName}>
                                                    {overlap.specName} →{" "}
                                                    {overlap.attributeName}
                                                </li>
                                            ))}
                                        </ul>
                                    </output>
                                )}
                            </InputFieldset>

                            {/* Questions */}
                            {!isNewVariantPage && (
                                <InputFieldset label="Questions & Answers">
                                    <div className="flex w-full flex-col gap-y-3">
                                        <ClickToAddInputs
                                            design={design}
                                            details={questions}
                                            setDetails={setQuestions}
                                            initialDetail={{
                                                question: "",
                                                answer: "",
                                            }}
                                            containerClassName="flex-1"
                                            inputClassName="w-full"
                                        />
                                        {errors.questions && (
                                            <span className="text-sm font-medium text-destructive">
                                                {errors.questions.message}
                                            </span>
                                        )}
                                    </div>
                                </InputFieldset>
                            )}
                            {/* Is On Sale */}
                            <InputFieldset
                                label="Sales"
                                description="Is your product on sale ?"
                            >
                                <div>
                                    <label
                                        htmlFor="yes"
                                        className="ml-5 flex cursor-pointer items-center gap-x-2"
                                    >
                                        <FormField
                                            control={form.control}
                                            name="isSale"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <>
                                                            <input
                                                                type="checkbox"
                                                                id="yes"
                                                                checked={
                                                                    field.value
                                                                }
                                                                onChange={
                                                                    field.onChange
                                                                }
                                                                hidden
                                                            />
                                                            <Checkbox
                                                                checked={
                                                                    field.value
                                                                }
                                                                // @ts-ignore
                                                                onCheckedChange={
                                                                    field.onChange
                                                                }
                                                            />
                                                        </>
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <span>Yes</span>
                                    </label>
                                    {form.getValues().isSale && (
                                        <div className="mt-5">
                                            <p className="flex pb-3 text-sm text-main-secondary dark:text-gray-400">
                                                <Dot className="-me-1" />
                                                When sale does end ?
                                            </p>
                                            <div className="flex items-center gap-x-5">
                                                <FormField
                                                    control={form.control}
                                                    name="saleEndDate"
                                                    render={({ field }) => (
                                                        <FormItem className="ml-4">
                                                            <FormControl>
                                                                <DateTimePicker
                                                                    className="inline-flex items-center gap-2 rounded-md border p-2 shadow-sm"
                                                                    calendarIcon={
                                                                        <span className="text-gray-500 hover:text-gray-600">
                                                                            🗓️
                                                                        </span>
                                                                    }
                                                                    clearIcon={
                                                                        <span className="text-gray-500 hover:text-gray-600">
                                                                            ❌
                                                                        </span>
                                                                    }
                                                                    onChange={(
                                                                        date
                                                                    ) => {
                                                                        // ProductFormSchema は
                                                                        // `.datetime({ offset: true })`。
                                                                        // タイムゾーンを落とした表記も空文字も
                                                                        // 通らないため、絶対時刻 (UTC) か
                                                                        // null のどちらかを書く。
                                                                        field.onChange(
                                                                            date
                                                                                ? date.toISOString()
                                                                                : null
                                                                        );
                                                                    }}
                                                                    value={
                                                                        field.value
                                                                            ? new Date(
                                                                                  field.value
                                                                              )
                                                                            : null
                                                                    }
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <ArrowRight className="w-4 text-[#1087ff]" />
                                                <span>{formattedDate}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </InputFieldset>
                            {/* Shipping fee method */}
                            {!isNewVariantPage && (
                                <InputFieldset label="Product shipping fee method">
                                    <FormField
                                        control={form.control}
                                        name="shippingFeeMethod"
                                        render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <Select
                                                    disabled={isLoading}
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                    value={field.value}
                                                    defaultValue={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger aria-label="Shipping fee method">
                                                            <SelectValue
                                                                defaultValue={
                                                                    field.value
                                                                }
                                                                placeholder="Select Shipping Fee Calculation method"
                                                            />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent
                                                        className={
                                                            design === "seller"
                                                                ? sellerStyles.theme
                                                                : undefined
                                                        }
                                                    >
                                                        {shippingFeeMethods.map(
                                                            (method) => (
                                                                <SelectItem
                                                                    key={
                                                                        method.value
                                                                    }
                                                                    value={
                                                                        method.value
                                                                    }
                                                                >
                                                                    {
                                                                        method.description
                                                                    }
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </InputFieldset>
                            )}
                            {/* Free Shipping */}
                            {!isNewVariantPage && (
                                <InputFieldset
                                    label="Free Shipping (Optional)"
                                    description="Free Shipping Worldwide?"
                                >
                                    <div>
                                        <label
                                            htmlFor="freeShippingForAll"
                                            className="ml-5 flex cursor-pointer items-center gap-x-2"
                                        >
                                            <FormField
                                                control={form.control}
                                                name="freeShippingForAllCountries"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <>
                                                                <input
                                                                    type="checkbox"
                                                                    id="freeShippingForAll"
                                                                    checked={
                                                                        field.value
                                                                    }
                                                                    onChange={
                                                                        field.onChange
                                                                    }
                                                                    hidden
                                                                />
                                                                <Checkbox
                                                                    checked={
                                                                        field.value
                                                                    }
                                                                    // @ts-ignore
                                                                    onCheckedChange={
                                                                        field.onChange
                                                                    }
                                                                />
                                                            </>
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <span>Yes</span>
                                        </label>
                                    </div>
                                    <div>
                                        <p className="mt-4 flex pb-3 text-sm text-main-secondary dark:text-gray-400">
                                            <Dot className="-me-1" />
                                            If selected, customers will not need
                                            to pay shipping fees when purchasing
                                            from this product in any country.
                                        </p>
                                    </div>
                                    <div>
                                        {!form.getValues()
                                            .freeShippingForAllCountries && (
                                            <div>
                                                <FormField
                                                    control={form.control}
                                                    name="freeShippingCountriesIds"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormControl>
                                                                {design ===
                                                                "seller" ? (
                                                                    <select
                                                                        multiple
                                                                        aria-label="Countries eligible for free shipping"
                                                                        value={field.value.map(
                                                                            (
                                                                                country
                                                                            ) =>
                                                                                country.value
                                                                        )}
                                                                        onChange={(
                                                                            event
                                                                        ) =>
                                                                            field.onChange(
                                                                                countryOptions.filter(
                                                                                    (
                                                                                        country
                                                                                    ) =>
                                                                                        Array.from(
                                                                                            event
                                                                                                .target
                                                                                                .selectedOptions
                                                                                        ).some(
                                                                                            (
                                                                                                option
                                                                                            ) =>
                                                                                                option.value ===
                                                                                                country.value
                                                                                        )
                                                                                )
                                                                            )
                                                                        }
                                                                    >
                                                                        {countryOptions.map(
                                                                            (
                                                                                country
                                                                            ) => (
                                                                                <option
                                                                                    key={
                                                                                        country.value
                                                                                    }
                                                                                    value={
                                                                                        country.value
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        country.label
                                                                                    }
                                                                                </option>
                                                                            )
                                                                        )}
                                                                    </select>
                                                                ) : (
                                                                    <MultiSelect
                                                                        className="!max-w-[800px]"
                                                                        options={
                                                                            countryOptions
                                                                        } // Array of options, each with `label` and `value`
                                                                        value={
                                                                            field.value
                                                                        } // Pass the array of objects directly
                                                                        onChange={(
                                                                            selected: CountryOption[]
                                                                        ) => {
                                                                            field.onChange(
                                                                                selected
                                                                            );
                                                                        }}
                                                                        labelledBy="Select"
                                                                    />
                                                                )}
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                                <p className="mt-4 flex pb-3 text-sm text-main-secondary dark:text-gray-400">
                                                    <Dot className="-me-1" />
                                                    List of countries you offer
                                                    shipping for this product
                                                    :&nbsp;
                                                    {form.getValues()
                                                        .freeShippingCountriesIds &&
                                                        form.getValues()
                                                            .freeShippingCountriesIds
                                                            .length === 0 &&
                                                        "None"}
                                                </p>
                                                {/* Free shipping countries */}
                                                <div className="flex flex-wrap gap-1">
                                                    {form
                                                        .getValues()
                                                        .freeShippingCountriesIds?.map(
                                                            (
                                                                country,
                                                                index
                                                            ) => (
                                                                <div
                                                                    key={
                                                                        country.id
                                                                    }
                                                                    className="inline-flex items-center rounded-md bg-blue-200 px-3 py-1 text-xs text-blue-primary"
                                                                >
                                                                    <span>
                                                                        {
                                                                            country.label
                                                                        }
                                                                    </span>
                                                                    <span
                                                                        className="ml-2 cursor-pointer hover:text-red-500"
                                                                        onClick={() =>
                                                                            handleDeleteCountryFreeShipping(
                                                                                index
                                                                            )
                                                                        }
                                                                    >
                                                                        x
                                                                    </span>
                                                                </div>
                                                            )
                                                        )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </InputFieldset>
                            )}
                            <Button type="submit" disabled={isLoading}>
                                {isLoading
                                    ? "loading..."
                                    : data?.productId && data?.variantId
                                      ? "Save product"
                                      : "Create product"}
                            </Button>
                        </fieldset>
                        {design === "seller" && saveState === "error" && (
                            <p role="alert" className={sellerStyles.alert}>
                                Could not save the product. Please try again.
                            </p>
                        )}
                        {design === "seller" && saveState !== "error" && (
                            <p role="status" aria-live="polite">
                                {saveState === "saving"
                                    ? "Saving product…"
                                    : saveState === "success"
                                      ? "Product saved."
                                      : ""}
                            </p>
                        )}
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
};
export default ProductDetails;
