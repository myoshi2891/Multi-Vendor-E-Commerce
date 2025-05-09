"use client";

// React, Next.js
import { FC, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Prisma model
import { Category, Store, SubCategory } from "@prisma/client";

// Form handling utilities
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

// Schema
import { ProductFormSchema } from "@/lib/schemas";

// UI Components
import { AlertDialog } from "@/components/ui/alert-dialog";
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
import ImageUpload from "../shared/image-upload";
import { useToast } from "@/hooks/use-toast";

// Queries
import { upsertStore } from "@/queries/store";

// Utils
import { v4 } from "uuid";

// Types
import { ProductWithVariantType } from "@/lib/types";
import ImagesPreviewGrid from "../shared/images-preview-grid";
import ClickToAddInputs from "./click-to-add";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	getAllCategories,
	getAllSubCategoriesFotCategory,
} from "@/queries/category";
// import { useToast } from "@/components/ui/use-toast";

interface ProductDetailsProps {
	data?: ProductWithVariantType;
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
			categoryId: data?.categoryId,
			subCategoryId: data?.subCategoryId,
			isSale: data?.isSale ?? false,
			brand: data?.brand ?? "",
			sku: data?.sku ?? "",
			colors: data?.colors ?? [{ color: "" }],
			sizes: data?.sizes ?? [],
			keywords: data?.keywords ?? [],
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

	// useEffect to fetch colors and sizes from data
	useEffect(() => {
		if (data) {
			setColors(data.colors);
			setSizes(data.sizes);
		}
	}, [data]);

	// useEffect to extract images from data
	useEffect(() => {
		if (data?.images) {
			setImages(data.images);
		}
	}, [data]);

	// Form submission handler

	// Extract errors state from form
	const errors = form.formState.errors;
	console.log(errors);

	// Loading status based on form submission
	const isLoading = form.formState.isSubmitting;

	// Reset form values when data changes
	useEffect(() => {
		if (data) {
			form.reset(data);
		}
	}, [data, form]);

	// Submit handler for form submission
	const handleSubmit = async (values: z.infer<typeof ProductFormSchema>) => {
		try {
			// Upserting category data
			// const response = await upsertStore({
			// 	id: data?.id ? data.id : v4(),
			// 	name: values.name,
			// 	description: values.description,
			// 	email: values.email,
			// 	phone: values.phone,
			// 	logo: values.logo[0].url,
			// 	cover: values.cover[0].url,
			// 	url: values.url,
			// 	featured: values.featured,
			// 	createdAt: new Date(),
			// 	updatedAt: new Date(),
			// });
			// Displaying success message
			// toast({
			// 	title: data?.id
			// 		? "Store has been updated."
			// 		: `Congratulations! '${response?.name}' is now created.`,
			// });
			// // Redirect or Refresh data
			// if (data?.id) {
			// 	router.refresh();
			// } else {
			// 	router.push(`/dashboard/seller/stores/${response.url}`);
			// }
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

	// Whenever colors, sizes, keywords changes we update the form values
	useEffect(() => {
		form.setValue("colors", colors);
		form.setValue("sizes", sizes);
		// form.setValue("keywords", data?.keywords || []);
	}, [colors, sizes]);
	console.log(sizes);

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
										<FormItem>
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
														// colors={colors}
														// setColors={setColors}
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
										details={colors}
										setDetails={setColors}
										initialDetail={{ color: "" }}
										header="Colors"
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
											<FormLabel>Store name</FormLabel>
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
							{/* Description */}
							<div className="flex flex-col lg:flex-row gap-4">
								<FormField
									control={form.control}
									name="description"
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormLabel>
												Product description
											</FormLabel>
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
									name="variantDescription"
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormLabel>
												Variant Description
											</FormLabel>
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
							</div>
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
							{/* Sizes */}
							<div className="w-full flex flex-col gap-y-3 xl:pl-5">
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
