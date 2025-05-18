"use client";

// React, Next.js
import { useRouter } from "next/navigation";
import { FC, useEffect, useRef, useState } from "react";

// Prisma model
import { Category, SubCategory } from "@prisma/client";

// Form handling utilities
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

// Schema
import { ProductFormSchema } from "@/lib/schemas";

// UI Components
import { AlertDialog } from "@/components/ui/alert-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import ImageUpload from "../shared/image-upload";

// Queries
import { getAllSubCategoriesFotCategory } from "@/queries/category";
import { upsertProduct } from "@/queries/product";

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
import { ProductWithVariantType } from "@/lib/types";
import ImagesPreviewGrid from "../shared/images-preview-grid";
import ClickToAddInputs from "./click-to-add";

// React date time picker
import DateTimePicker from "react-datetime-picker";
import "react-datetime-picker/dist/DateTimePicker.css";
import "react-calendar/dist/Calendar.css";
import "react-clock/dist/Clock.css";
import { format } from "date-fns";
// import { useToast } from "@/components/ui/use-toast";

interface ProductDetailsProps {
	data?: Partial<ProductWithVariantType>;
	categories: Category[];
	storeUrl: string;
}

const ProductDetails: FC<ProductDetailsProps> = ({
	data,
	categories,
	storeUrl,
}) => {
	// Initializing necessary hooks
	const { toast } = useToast(); // Hook for displaying toast messages
	const router = useRouter(); // Hook for routing

	// Jodit editor refs
	const productDescEditor = useRef(null);
	const variantDescEditor = useRef(null);

	// State for subCategories
	const [subCategories, setSubcategories] = useState<SubCategory[]>([]);

	// State for colors
	const [colors, setColors] = useState<{ color: string }[]>([{ color: "" }]);

	// State for sizes
	const [sizes, setSizes] = useState<
		{ size: string; price: number; quantity: number; discount: number }[]
	>([{ size: "", quantity: 1, price: 0.01, discount: 0 }]);

	// Temporary state for images
	const [images, setImages] = useState<{ url: string }[]>([]);

	// Form hook for managing form state and validation
	const form = useForm<z.infer<typeof ProductFormSchema>>({
		mode: "onChange", // Form validation mode
		resolver: zodResolver(ProductFormSchema), // Resolver for form validation
		defaultValues: {
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
			brand: data?.brand ?? "",
			sku: data?.sku ?? "",
			colors: data?.colors ?? [{ color: "" }],
			sizes: data?.sizes ?? [],
			product_specs: data?.product_specs ?? [],
			variant_specs: data?.variant_specs ?? [],
			keywords: data?.keywords ?? [],
			isSale: data?.isSale ?? false,
			saleEndDate:
				data?.saleEndDate ||
				format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
		},
	});

	// useEffect to fetch subcategories based on categoryId
	useEffect(() => {
		const getSubcategories = async () => {
			const res = await getAllSubCategoriesFotCategory(
				form.watch().categoryId
			);
			setSubcategories(res);
		};
		getSubcategories();
	}, [form.watch().categoryId]);

	// Extract errors state from form
	const errors = form.formState.errors;

	// Loading status based on form submission
	const isLoading = form.formState.isSubmitting;

	// Reset form values when data changes
	useEffect(() => {
		if (data) {
			form.reset({ ...data, variantImage: [{ url: data.variantImage }] });
		}
	}, [data, form]);

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
					variantDescription: values.variantDescription || "",
					categoryId: values.categoryId,
					subCategoryId: values.subCategoryId,
					images: values.images,
					variantImage: values.variantImage[0].url,
					isSale: values.isSale || false,
					brand: values.brand,
					sku: values.sku,
					colors: values.colors,
					sizes: values.sizes || [],
					keywords: values.keywords || [],
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				storeUrl
			);
			// Displaying success message
			toast({
				title:
					data?.productId && data?.variantId
						? "Product has been updated."
						: `Congratulations! '${response?.slug}' is now created.`,
			});
			// Redirect or Refresh data
			if (data?.productId && data?.variantId) {
				router.refresh();
			} else {
				router.push(`/dashboard/seller/stores/${storeUrl}/products`);
			}
		} catch (error: any) {
			// Handling form submission errors
			console.log(error);
			toast({
				variant: "destructive",
				title: "Oops!",
				description: error.toString(),
			});
		}
	};

	// Handle keywords input
	const [keywords, setKeywords] = useState<string[]>([]);

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
		form.setValue("colors", colors);
		form.setValue("sizes", sizes);
		form.setValue("keywords", keywords);
		// form.setValue("keywords", data?.keywords || []);
	}, [colors, sizes, keywords, data]);

	console.log("product description", form.getValues().description);
	console.log(
		"product variantDescription",
		form.getValues().variantDescription
	);

	return (
		<AlertDialog>
			<Card className="w-full">
				<CardHeader>
					<CardTitle>Product Information</CardTitle>
					<CardDescription>
						{data?.productId && data?.variantId
							? `Update ${data?.name} product information.`
							: " Lets create a product. You can edit product later from the store products page."}
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
								<div className="w-full flex flex-col gap-y-3 xl:pl-5">
									<ClickToAddInputs
										details={data?.colors || colors}
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
							<div className="flex flex-col lg:flex-row gap-4">
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormLabel>Product name</FormLabel>
											<FormControl>
												<Input
													placeholder="Name"
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
											<FormLabel>Variant name</FormLabel>
											<FormControl>
												<Input
													placeholder="Name"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
							{/* Product and variant description editors (tabs) */}
							<Tabs defaultValue="product" className="w-full">
								<TabsList className="w-full grid grid-cols-2">
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
														ref={productDescEditor}
														value={
															form.getValues()
																.description
														}
														onChange={(content) => {
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
														ref={variantDescEditor}
														value={
															form.getValues()
																.variantDescription ||
															""
														}
														onChange={(content) => {
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

							{/* Description */}
							<div className="flex flex-col lg:flex-row gap-4 hidden"></div>
							{/* Category - SubCategory */}
							<div className="flex flex-col lg:flex-row gap-4">
								<FormField
									control={form.control}
									name="categoryId"
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormLabel>
												Product Category
											</FormLabel>
											<Select
												disabled={
													isLoading ||
													categories.length === 0
												}
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
																{category.name}
															</SelectItem>
														)
													)}
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
								{form.watch().categoryId && (
									<FormField
										control={form.control}
										name="subCategoryId"
										render={({ field }) => (
											<FormItem className="flex-1">
												<FormLabel>
													Product SubCategory
												</FormLabel>
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
									/>
								)}
							</div>
							{/* Brand, Sku */}
							<div className="flex flex-col lg:flex-row gap-4">
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
												className="text-xs inline-flex items-center px-3 py-1 bg-blue-200 text-blue-700 rounded-full gap-x-2"
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
							<div className="w-full flex flex-col gap-y-3">
								<ClickToAddInputs
									details={sizes}
									setDetails={setSizes}
									initialDetail={{
										size: "",
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
							{/* Is On Sale */}
							<div className="flex border rounded-md">
								<FormField
									control={form.control}
									name="isSale"
									render={({ field }) => (
										<FormItem className="flex flex-row items-start space-x-3 p-4">
											<FormControl>
												<Checkbox
													checked={field.value}
													// @ts-ignore
													onCheckedChange={
														field.onChange
													}
												/>
											</FormControl>
											<div className="space-y-1 leading-none">
												<FormLabel>On Sale</FormLabel>
												<FormDescription>
													Is this product on sale?
												</FormDescription>
											</div>
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="saleEndDate"
									render={({ field }) => (
										<FormItem className="flex flex-row items-start space-x-3 p-4">
											<FormControl>
												<DateTimePicker
													onChange={(date) => {
														field.onChange(
															date
																? format(
																		date,
																		"yyyy-MM-dd'T'HH:mm:ss"
																  )
																: ""
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
							</div>
							<Button type="submit" disabled={isLoading}>
								{isLoading
									? "loading..."
									: data?.productId && data?.variantId
									? "Save store information"
									: "Create store"}
							</Button>
						</form>
					</Form>
				</CardContent>
			</Card>
		</AlertDialog>
	);
};
export default ProductDetails;
