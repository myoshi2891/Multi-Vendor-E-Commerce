"use client";

// React
import { FC, useEffect } from "react";

// Form handling utilities
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Schema
import { ShippingRateFormSchema } from "@/lib/schemas";

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
import { upsertCategory } from "@/queries/category";

// Utils
import { v4 } from "uuid";
// import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

// Types
import { CountryWithShippingRatesType } from "@/lib/types";
import { NumberInput } from "@tremor/react";
import { Textarea } from "@/components/ui/textarea";

interface ShippingRateDetailsProps {
	data?: CountryWithShippingRatesType;
	storeUrl: string;
}

const ShippingRateDetails: FC<ShippingRateDetailsProps> = ({
	data,
	storeUrl,
}) => {
	// Initializing necessary hooks
	const { toast } = useToast(); // Hook for displaying toast messages
	const router = useRouter(); // Hook for routing

	// Form hook for managing form state and validation
	const form = useForm<z.infer<typeof ShippingRateFormSchema>>({
		mode: "onChange", // Form validation mode
		resolver: zodResolver(ShippingRateFormSchema), // Resolver for form validation
		defaultValues: {
			countryId: data?.countryId ?? "",
			countryName: data?.countryName ?? "",
			shippingService: data?.shippingRate
				? data?.shippingRate.shippingService
				: "",
			shippingFeePerItem: data?.shippingRate
				? data?.shippingRate.shippingFeePerItem
				: 0,
			shippingFeeForAdditionalItem: data?.shippingRate
				? data?.shippingRate.shippingFeeForAdditionalItem
				: 0,
			shippingFeePerKg: data?.shippingRate
				? data?.shippingRate.shippingFeePerKg
				: 0,
			shippingFeeFixed: data?.shippingRate
				? data?.shippingRate.shippingFeeFixed
				: 0,
			deliveryTimeMin: data?.shippingRate
				? data?.shippingRate.deliveryTimeMin
				: 1,
			deliveryTimeMax: data?.shippingRate
				? data?.shippingRate.deliveryTimeMax
				: 1,
			returnPolicy: data?.shippingRate
				? data?.shippingRate.returnPolicy
				: "",
		},
	});

	// Loading status based on form submission
	const isLoading = form.formState.isSubmitting;

	// Reset form values when data changes
	useEffect(() => {
		if (data) {
			form.reset(data);
		}
	}, [data, form]);

	// Submit handler for form submission
	const handleSubmit = async (
		values: z.infer<typeof ShippingRateFormSchema>
	) => {
		try {
			// Upserting category data
			const response = await upsertCategory({
				id: data?.id ? data.id : v4(),
				name: values.name,
				image: values.image[0].url,
				url: values.url,
				featured: values.featured,
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

	return (
		<AlertDialog>
			<Card className="w-full">
				<CardHeader>
					<CardTitle>Shipping Rate</CardTitle>
					<CardDescription>
						Update Shipping rate information for {data?.countryName}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(handleSubmit)}>
							<div className="hidden">
								<FormField
									// disabled={isLoading}
									disabled
									control={form.control}
									name="countryId"
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormLabel>Category name</FormLabel>
											<FormControl>
												<Input {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
							<div className="space-y-4">
								<FormField
									disabled
									control={form.control}
									name="countryName"
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormLabel>Category name</FormLabel>
											<FormControl>
												<Input {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="shippingService"
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormControl>
												<Input
													{...field}
													placeholder="Shipping service"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									disabled
									control={form.control}
									name="shippingFeePerItem"
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormLabel>
												Shipping fee per item
											</FormLabel>
											<FormControl>
												<NumberInput
													defaultValue={field.value}
													onValueChange={
														field.onChange
													}
													step={0.1}
													min={0}
													className="pl-1 !shadow-none rounded-md"
													placeholder="Shipping fees per item"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									disabled
									control={form.control}
									name="shippingFeeForAdditionalItem"
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormLabel>
												Shipping fee for additional item
											</FormLabel>
											<FormControl>
												<NumberInput
													defaultValue={field.value}
													onValueChange={
														field.onChange
													}
													step={0.1}
													min={0}
													className="pl-1 !shadow-none rounded-md"
													placeholder="Shipping fees for additional item"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									disabled
									control={form.control}
									name="shippingFeePerKg"
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormLabel>
												Shipping fee per kg
											</FormLabel>
											<FormControl>
												<NumberInput
													defaultValue={field.value}
													onValueChange={
														field.onChange
													}
													step={0.1}
													min={0}
													className="pl-1 !shadow-none rounded-md"
													placeholder="Shipping fees per kg"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									disabled
									control={form.control}
									name="shippingFeeFixed"
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormLabel>
												Fixed Shipping fee
											</FormLabel>
											<FormControl>
												<NumberInput
													defaultValue={field.value}
													onValueChange={
														field.onChange
													}
													step={0.1}
													min={0}
													className="pl-1 !shadow-none rounded-md"
													placeholder="Fixed Shipping Fee"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									disabled
									control={form.control}
									name="deliveryTimeMin"
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormLabel>
												Delivery Time Min
											</FormLabel>
											<FormControl>
												<NumberInput
													defaultValue={field.value}
													onValueChange={
														field.onChange
													}
													min={1}
													className="pl-1 !shadow-none rounded-md"
													placeholder="Minimum Delivery Time (days)"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									disabled
									control={form.control}
									name="deliveryTimeMax"
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormLabel>
												Delivery Time Max
											</FormLabel>
											<FormControl>
												<NumberInput
													defaultValue={field.value}
													onValueChange={
														field.onChange
													}
													min={1}
													className="pl-1 !shadow-none rounded-md"
													placeholder="Maximum Delivery Time (days)"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									// disabled={isLoading}
									control={form.control}
									name="returnPolicy"
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormLabel>Return Policy</FormLabel>
											<FormControl>
												<Textarea
													placeholder="What's the return policy for your store?"
													{...field}
													className="p-4"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
							<div className="mt-4">
								<Button type="submit" disabled={isLoading}>
									{isLoading ? "loading..." : "Save changes"}
								</Button>
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>
		</AlertDialog>
	);
};

export default ShippingRateDetails;
