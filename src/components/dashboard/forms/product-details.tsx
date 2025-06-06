'use client'

// React, Next.js
import { useRouter } from 'next/navigation'
import { FC, useEffect, useRef, useState } from 'react'

// Prisma model
import {
    Category,
    OfferTag,
    ShippingFeeMethod,
    SubCategory,
} from '@prisma/client'

// Form handling utilities
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

// Schema
import { ProductFormSchema } from '@/lib/schemas'

// UI Components
import { AlertDialog } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import ImageUpload from '../shared/image-upload'

// Queries
import { getAllSubCategoriesFotCategory } from '@/queries/category'
import { upsertProduct } from '@/queries/product'

// ReactTags
import { WithOutContext as ReactTags } from 'react-tag-input'

// Jodit text editor
import JoditEditor from 'jodit-react'

// Utils
import { v4 } from 'uuid'

// Types
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ProductWithVariantType } from '@/lib/types'
import ImagesPreviewGrid from '../shared/images-preview-grid'
import ClickToAddInputs from './click-to-add'

// React date time picker
import DateTimePicker from 'react-datetime-picker'
import 'react-datetime-picker/dist/DateTimePicker.css'
import 'react-calendar/dist/Calendar.css'
import 'react-clock/dist/Clock.css'
import { format } from 'date-fns'
import { NumberInput } from '@tremor/react'
import InputFieldset from '../shared/input-fieldset'
import { ArrowRight, Dot } from 'lucide-react'
// import { useToast } from "@/components/ui/use-toast";

const shippingFeeMethods = [
    {
        value: ShippingFeeMethod.ITEM,
        description: 'ITEM (Fees calculated based on number of products.)',
    },
    {
        value: ShippingFeeMethod.WEIGHT,
        description: 'WEIGHT (Fees calculated based on product weight.)',
    },
    {
        value: ShippingFeeMethod.FIXED,
        description: 'FIXED (Fees are fixed.)',
    },
]

interface ProductDetailsProps {
    data?: Partial<ProductWithVariantType>
    categories: Category[]
    offerTags: OfferTag[]
    storeUrl: string
}

const ProductDetails: FC<ProductDetailsProps> = ({
    data,
    categories,
    offerTags,
    storeUrl,
}) => {
    // Initializing necessary hooks
    const { toast } = useToast() // Hook for displaying toast messages
    const router = useRouter() // Hook for routing

    // Jodit editor refs
    const productDescEditor = useRef(null)
    const variantDescEditor = useRef(null)

    // State for subCategories
    const [subCategories, setSubcategories] = useState<SubCategory[]>([])

    // State for colors
    const [colors, setColors] = useState<{ color: string }[]>([{ color: '' }])

    // State for sizes
    const [sizes, setSizes] = useState<
        { size: string; price: number; quantity: number; discount: number }[]
    >(data?.sizes || [{ size: '', quantity: 1, price: 0.01, discount: 0 }])

    // State for product specs
    const [productSpecs, setProductSpecs] = useState<
        { name: string; value: string }[]
    >(data?.product_specs || [{ name: '', value: '' }])

    // State for product variant specs
    const [variantSpecs, setVariantSpecs] = useState<
        { name: string; value: string }[]
    >(data?.variant_specs || [{ name: '', value: '' }])

    // State for product variant specs
    const [questions, setQuestions] = useState<
        { question: string; answer: string }[]
    >(data?.questions || [{ question: '', answer: '' }])

    // Temporary state for images
    const [images, setImages] = useState<{ url: string }[]>([])

    // Form hook for managing form state and validation
    const form = useForm<z.infer<typeof ProductFormSchema>>({
        mode: 'onChange', // Form validation mode
        resolver: zodResolver(ProductFormSchema), // Resolver for form validation
        defaultValues: {
            // Setting default form values from data (if available)
            name: data?.name ?? '',
            description: data?.description ?? '',
            variantName: data?.variantName ?? '',
            variantDescription: data?.variantDescription ?? '',
            images: data?.images || [],
            variantImage: data?.variantImage
                ? [{ url: data.variantImage }]
                : [],
            categoryId: data?.categoryId,
            subCategoryId: data?.subCategoryId,
            offerTagId: data?.offerTagId,
            brand: data?.brand ?? '',
            sku: data?.sku ?? '',
            colors: data?.colors ?? [{ color: '' }],
            sizes: data?.sizes ?? [],
            product_specs: data?.product_specs ?? [],
            variant_specs: data?.variant_specs ?? [],
            keywords: data?.keywords ?? [],
            questions: data?.questions ?? [],
            isSale: data?.isSale ?? false,
            weight: data?.weight,
            saleEndDate:
                data?.saleEndDate ||
                format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
            freeShippingForAllCountries: data?.freeShippingForAllCountries,
            freeShippingCountriesIds: Array.isArray(
                data?.freeShippingCountriesIds
            )
                ? data?.freeShippingCountriesIds
                : data?.freeShippingCountriesIds
                  ? [data?.freeShippingCountriesIds]
                  : [],
            shippingFeeMethod: data?.shippingFeeMethod,
        },
    })

    const saleEndDate = form.getValues().saleEndDate || new Date().toISOString()
    const formattedDate = new Date(saleEndDate).toLocaleString('en-Us', {
        weekday: 'short', // Abbreviated day name (e.g., "Mon")
        month: 'long', // Abbreviated month name (e.g., "Nov")
        day: '2-digit', // Two-digit day (e.g., "25")
        year: 'numeric', // Full year (e.g., "2024")
        hour: '2-digit', // Two-digit hour (e.g., "02")
        minute: '2-digit', // Two-digit minute (e.g., "30")
        // second: '2-digit', // Two-digit second (optional)
        hour12: false, // 12-hour format (change to false for 24-hour format)    })
    })

    // useEffect to fetch subcategories based on categoryId
    useEffect(() => {
        const getSubcategories = async () => {
            const res = await getAllSubCategoriesFotCategory(
                form.watch().categoryId
            )
            setSubcategories(res)
        }
        getSubcategories()
    }, [form.watch().categoryId])

    // Extract errors state from form
    const errors = form.formState.errors

    // Loading status based on form submission
    const isLoading = form.formState.isSubmitting

    // Reset form values when data changes
    useEffect(() => {
        if (data) {
            form.reset({ ...data, variantImage: [{ url: data.variantImage }] })
        }
    }, [data, form])

    // Submit handler for form submission
    const handleSubmit = async (values: z.infer<typeof ProductFormSchema>) => {
        try {
            // Upserting category data
            const response = await upsertProduct(
                {
                    productId: data?.productId ? data.productId : v4(),
                    variantId: data?.variantId ? data.variantId : v4(),
                    name: values.name,
                    description: values.description,
                    variantName: values.variantName,
                    variantDescription: values.variantDescription || '',
                    categoryId: values.categoryId,
                    subCategoryId: values.subCategoryId,
                    offerTagId: values.offerTagId || '',
                    images: values.images,
                    variantImage: values.variantImage[0].url,
                    isSale: values.isSale || false,
                    saleEndDate: values.saleEndDate,
                    brand: values.brand,
                    sku: values.sku,
                    weight: values.weight,
                    colors: values.colors,
                    sizes: values.sizes || [],
                    product_specs: values.product_specs,
                    variant_specs: values.variant_specs,
                    keywords: values.keywords || [],
                    questions: values.questions || [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
                storeUrl
            )
            // Displaying success message
            toast({
                title:
                    data?.productId && data?.variantId
                        ? 'Product has been updated.'
                        : `Congratulations! '${response?.slug}' is now created.`,
            })
            // Redirect or Refresh data
            if (data?.productId && data?.variantId) {
                router.refresh()
            } else {
                router.push(`/dashboard/seller/stores/${storeUrl}/products`)
            }
        } catch (error: any) {
            // Handling form submission errors
            console.log(error)
            toast({
                variant: 'destructive',
                title: 'Oops!',
                description: error.toString(),
            })
        }
    }

    // Handle keywords input
    const [keywords, setKeywords] = useState<string[]>([])

    interface Keyword {
        id: string
        text: string
    }

    const handleAddition = (keyword: Keyword) => {
        if (keywords.length === 10) return
        setKeywords([...keywords, keyword.text])
    }

    const handleDeleteKeyword = (index: number) => {
        setKeywords(keywords.filter((_, i) => i !== index))
    }

    // Whenever colors, sizes, keywords changes we update the form values
    useEffect(() => {
        form.setValue('colors', colors)
        form.setValue('sizes', sizes)
        form.setValue('keywords', keywords)
        form.setValue('product_specs', productSpecs)
        form.setValue('variant_specs', variantSpecs)
    }, [colors, sizes, keywords, productSpecs, variantSpecs, data])

    // console.log("product spec", form.getValues().product_specs);
    // console.log("product variant spec", form.getValues().variant_specs);

    return (
        <AlertDialog>
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Product Information</CardTitle>
                    <CardDescription>
                        {data?.productId && data?.variantId
                            ? `Update ${data?.name} product information.`
                            : ' Lets create a product. You can edit product later from the store products page.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form
                            onSubmit={form.handleSubmit(handleSubmit)}
                            className="space-y-4"
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
                                                                )
                                                            setImages(
                                                                updatedImages
                                                            )
                                                            field.onChange(
                                                                updatedImages
                                                            )
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
                                                                        ]
                                                                    field.onChange(
                                                                        updatedImages
                                                                    )
                                                                    return updatedImages
                                                                }
                                                            )
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
                                        details={data?.colors || colors}
                                        setDetails={setColors}
                                        initialDetail={{ color: '' }}
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
                            <InputFieldset
                                label="Product and Variant Description Editors"
                                description=" Note: The product description is the main description for the product (Will display in every variant page). You can add an extra description specific to this variant using Variant description tab.
                            "
                            >
                                <Tabs defaultValue="product" className="w-full">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="product">
                                            Product description
                                        </TabsTrigger>
                                        <TabsTrigger value="variant">
                                            Variant description
                                        </TabsTrigger>
                                    </TabsList>
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
                                                            value={
                                                                form.getValues()
                                                                    .description
                                                            }
                                                            onChange={(
                                                                content
                                                            ) => {
                                                                form.setValue(
                                                                    'description',
                                                                    content
                                                                )
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
                                                            value={
                                                                form.getValues()
                                                                    .variantDescription ||
                                                                ''
                                                            }
                                                            onChange={(
                                                                content
                                                            ) => {
                                                                form.setValue(
                                                                    'variantDescription',
                                                                    content
                                                                )
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

                            {/* Category - SubCategory - offer */}
                            <InputFieldset label="Category">
                                <div className="flex flex-col gap-4 lg:flex-row">
                                    <FormField
                                        control={form.control}
                                        name="categoryId"
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
                                                        <SelectTrigger>
                                                            <SelectValue
                                                                defaultValue={
                                                                    field.value
                                                                }
                                                                placeholder="Select a category"
                                                            />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {categories.map(
                                                            (category) => (
                                                                <SelectItem
                                                                    key={
                                                                        category.id
                                                                    }
                                                                    value={
                                                                        category.id
                                                                    }
                                                                >
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
                                    />
                                    <FormField
                                        control={form.control}
                                        name="subCategoryId"
                                        render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <Select
                                                    disabled={
                                                        isLoading ||
                                                        categories.length ===
                                                            0 ||
                                                        !form.getValues()
                                                            .categoryId
                                                    }
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                    value={field.value}
                                                    defaultValue={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue
                                                                defaultValue={
                                                                    field.value
                                                                }
                                                                placeholder="Select a sub-category"
                                                            />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {subCategories.map(
                                                            (sub) => (
                                                                <SelectItem
                                                                    key={sub.id}
                                                                    value={
                                                                        sub.id
                                                                    }
                                                                >
                                                                    {sub.name}
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />{' '}
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
                                                        <SelectTrigger>
                                                            <SelectValue
                                                                defaultValue={
                                                                    field.value
                                                                }
                                                                placeholder="Select an offer"
                                                            />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
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
                            {/* Brand, Sku, weight */}
                            <div className="flex flex-col gap-4 lg:flex-row">
                                <FormField
                                    control={form.control}
                                    name="brand"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>Product brand</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Brand"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="sku"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>Product sku</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Sku"
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
                                            <FormLabel>
                                                Product weight
                                            </FormLabel>
                                            <FormControl>
                                                <NumberInput
                                                    defaultValue={field.value}
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                    placeholder="Weight"
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
                            {/* Variant image - Keywords */}
                            <div className="flex items-center gap-10 py-14">
                                {/* Variant image */}
                                <div className="border-r pr-10">
                                    <FormField
                                        control={form.control}
                                        name="variantImage"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="ml-14">
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
                                                                'bg-background border rounded-md p-2 w-full focus:outline-none',
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
                            <div className="flex w-full flex-col gap-y-3">
                                <ClickToAddInputs
                                    details={sizes}
                                    setDetails={setSizes}
                                    initialDetail={{
                                        size: '',
                                        quantity: 1,
                                        price: 0.01,
                                        discount: 0,
                                    }}
                                    header="Sizes, Quantities, Prices, Discounts"
                                />
                                {errors.sizes && (
                                    <span className="text-sm font-medium text-destructive">
                                        {errors.sizes.message}
                                    </span>
                                )}
                            </div>
                            {/* Product and variant specs */}
                            <InputFieldset
                                label="Specifications"
                                description="Note: The product specifications are the main specs for the product (Will display in every variant page). You can add extra specs specific to this variant using 'Variant Specifications' tab."
                            >
                                <Tabs
                                    defaultValue="productSpecs"
                                    className="w-full"
                                >
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="productSpecs">
                                            Product Specifications
                                        </TabsTrigger>
                                        <TabsTrigger value="variantSpecs">
                                            Variant Specifications
                                        </TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="productSpecs">
                                        <div className="flex w-full flex-col gap-y-3">
                                            <ClickToAddInputs
                                                details={productSpecs}
                                                setDetails={setProductSpecs}
                                                initialDetail={{
                                                    name: '',
                                                    value: '',
                                                }}
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
                                                details={variantSpecs}
                                                setDetails={setVariantSpecs}
                                                initialDetail={{
                                                    name: '',
                                                    value: '',
                                                }}
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
                            </InputFieldset>

                            {/* Questions */}
                            <InputFieldset label="Questions & Answers">
                                <div className="flex w-full flex-col gap-y-3">
                                    <ClickToAddInputs
                                        details={questions}
                                        setDetails={setQuestions}
                                        initialDetail={{
                                            question: '',
                                            answer: '',
                                        }}
                                    />
                                    {errors.questions && (
                                        <span className="text-sm font-medium text-destructive">
                                            {errors.questions.message}
                                        </span>
                                    )}
                                </div>
                            </InputFieldset>
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
                                                                        field.onChange(
                                                                            date
                                                                                ? format(
                                                                                      date,
                                                                                      "yyyy-MM-dd'T'HH:mm:ss"
                                                                                  )
                                                                                : ''
                                                                        )
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
                            <InputFieldset label="Product shipping fee method">
                                <FormField
                                    control={form.control}
                                    name="shippingFeeMethod"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <Select
                                                disabled={isLoading}
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                defaultValue={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue
                                                            defaultValue={
                                                                field.value
                                                            }
                                                            placeholder="Select Shipping Fee Calculation method"
                                                        />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
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
                            {/* Free Shipping */}
                            <InputFieldset
                                label="Free Shipping (Optional)"
                                description="Free Shipping Worldwide?"
                            >
                                {' '}
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
                                        If selected, customers will not need to
                                        pay shipping fees when purchasing from
                                        this product in any country.
                                    </p>
                                </div>
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
                                                                    field.onChange(
                                                                        date
                                                                            ? format(
                                                                                  date,
                                                                                  "yyyy-MM-dd'T'HH:mm:ss"
                                                                              )
                                                                            : ''
                                                                    )
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
                            </InputFieldset>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading
                                    ? 'loading...'
                                    : data?.productId && data?.variantId
                                      ? 'Save store information'
                                      : 'Create store'}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </AlertDialog>
    )
}
export default ProductDetails
