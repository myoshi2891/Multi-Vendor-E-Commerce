"use client";

// React
import { FC, useEffect } from "react";

// Form handling utilities
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Schema
import { StoreShippingFormSchema } from "@/lib/schemas";

// UI Components
import { AlertDialog } from "@/components/ui/alert-dialog";
import {
	Card,
	CardContent,
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
import { NumberInput } from "@tremor/react"

// Queries
import { upsertCategory } from "@/queries/category";

// Utils
import { v4 } from "uuid";
// import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { StoreDefaultShippingType } from "@/lib/types";

interface StoreDefaultShippingDetailsProps {
	data?: StoreDefaultShippingType;
}

const StoreDefaultShippingDetails: FC<StoreDefaultShippingDetailsProps> = ({
	data,
}) => {
	// Initializing necessary hooks
	const { toast } = useToast(); // Hook for displaying toast messages
	const router = useRouter(); // Hook for routing

	// Form hook for managing form state and validation
	const form = useForm<z.infer<typeof StoreShippingFormSchema>>({
		mode: "onChange", // Form validation mode
		resolver: zodResolver(StoreShippingFormSchema), // Resolver for form validation
		defaultValues: {
			// Setting default form values from data (if available)
			defaultShippingService: data?.defaultShippingService ?? "",
			defaultShippingFeePerItem: data?.defaultShippingFeePerItem ?? 0,
			defaultShippingFeeForAdditionalItem:
				data?.defaultShippingFeeForAdditionalItem ?? 0,
			defaultShippingFeePerKg: data?.defaultShippingFeePerKg ?? 0,
			defaultShippingFeeFixed: data?.defaultShippingFeeFixed ?? 0,
			defaultDeliveryTimeMin: data?.defaultDeliveryTimeMin ?? 0,
			defaultDeliveryTimeMax: data?.defaultDeliveryTimeMax ?? 0,
			returnPolicy: data?.returnPolicy ?? "",
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
	const handleSubmit = async (values: z.infer<typeof StoreShippingFormSchema>) => {
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
					<CardTitle>Store Default Shipping Details</CardTitle>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(handleSubmit)}
							className="space-y-4"
						>
							<FormField
								// disabled={isLoading}
								control={form.control}
								name="defaultShippingService"
								render={({ field }) => (
									<FormItem className="flex-1">
										<FormLabel>
											Shipping Service Name
										</FormLabel>
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
							<div className="flex flex-wrap gap-4">
								<FormField
									// disabled={isLoading}
									control={form.control}
									name="defaultShippingFeePerItem"
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormLabel>
												Shipping Fee Per Item
											</FormLabel>
											<FormControl>
												<NumberInput
													defaultValue={field.value}
													onValueChange={field.onChange}
													min={1}
													className="!pl-1 !shadow-none rounded-md"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
							<Button type="submit" disabled={isLoading}>
								{isLoading
									? "loading..." : "Save changes"}
							</Button>
						</form>
					</Form>
				</CardContent>
			</Card>
		</AlertDialog>
	);
};

export default StoreDefaultShippingDetails;
