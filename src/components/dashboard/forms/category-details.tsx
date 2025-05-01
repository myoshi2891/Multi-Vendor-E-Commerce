"use client";

// React
import { FC, useEffect } from "react";

// Prisma model
import { Category } from "@/generated/prisma";

// Form handling utilities
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Schema
import { CategoryFormSchema } from "@/lib/schemas";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

interface CategoryDetailsProps {
	data?: Category;
}

const CategoryDetails: FC<CategoryDetailsProps> = ({ data }) => {
	// Form hook for managing form state and validation
	const form = useForm<z.infer<typeof CategoryFormSchema>>({
		mode: "onChange", // Form validation mode
		resolver: zodResolver(CategoryFormSchema), // Resolver for form validation
		defaultValues: {
			// Setting default form values from data (if available)
			name: data?.name || "",
			image: data?.image ? [{ url: data?.image }] : [],
			url: data?.url || "",
			featured: data?.featured ?? false,
		} satisfies z.infer<typeof CategoryFormSchema>,
	});
	// Loading status based on form submission
	const isLoading = form.formState.isSubmitting;

	// Reset form values when data changes
	useEffect(() => {
		if (data) {
			form.reset({
				name: data?.name,
				image: [{ url: data?.image }],
				url: data?.url,
				featured: data?.featured,
			});
		}
	}, [data, form]);

	// Submit handler for form submission
	const handleSubmit = async (values: z.infer<typeof CategoryFormSchema>) => {
		console.log(values);
	};

	// Submitting the form
	return (
		<AlertDialog>
			<Card className="w-full">
				<CardHeader>
					<CardTitle>Category Information</CardTitle>
					<CardDescription>
						{data?.id
							? `Update ${data?.name} category information.`
							: "Let's create a category. You can edit category later from the categories table or the category page"}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form
							action=""
							onSubmit={form.handleSubmit(handleSubmit)}
							className="space-y-4"
						>
							<FormField
								name="name"
								control={form.control}
								render={({ field }) => (
									<FormItem className="flex-1">
										<FormLabel>Category Name</FormLabel>
										<FormControl>
											<Input
												placeholder="Name"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
								disabled={isLoading}
							/>
							<FormField
								name="url"
								control={form.control}
								render={({ field }) => (
									<FormItem className="flex-1">
										<FormLabel>Category Url</FormLabel>
										<FormControl>
											<Input
												placeholder="/category-url"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
								disabled={isLoading}
							/>
							<FormField
								name="featured"
								control={form.control}
								render={({ field }) => (
									<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md">
										<FormControl>
											<Checkbox
												checked={field.value}
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
										{/* <FormMessage /> */}
									</FormItem>
								)}
								disabled={isLoading}
							/>
							<Button type="submit" disabled={isLoading}>
								{isLoading
									? "Loading..."
									: data?.id
									? "Save category information"
									: "Create category"}
							</Button>
						</form>
					</Form>
				</CardContent>
			</Card>
		</AlertDialog>
	);
};

export default CategoryDetails;
