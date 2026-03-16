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
} from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Queries
import { upsertShippingRate } from "@/queries/store";

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

const mapShippingRateToFormValues = (data?: CountryWithShippingRatesType) => ({
    countryId: data?.countryId ?? "",
    countryName: data?.countryName ?? "",
    shippingService: data?.shippingRate?.shippingService ?? "",
    shippingFeePerItem: data?.shippingRate
        ? data.shippingRate.shippingFeePerItem.toNumber()
        : 0,
    shippingFeeForAdditionalItem: data?.shippingRate
        ? data.shippingRate.shippingFeeForAdditionalItem.toNumber()
        : 0,
    shippingFeePerKg: data?.shippingRate
        ? data.shippingRate.shippingFeePerKg.toNumber()
        : 0,
    shippingFeeFixed: data?.shippingRate
        ? data.shippingRate.shippingFeeFixed.toNumber()
        : 0,
    deliveryTimeMin: data?.shippingRate?.deliveryTimeMin ?? 1,
    deliveryTimeMax: data?.shippingRate?.deliveryTimeMax ?? 1,
    returnPolicy: data?.shippingRate?.returnPolicy ?? "",
});

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
        defaultValues: mapShippingRateToFormValues(data),
    });

    // Loading status based on form submission
    const isLoading = form.formState.isSubmitting;

    // Reset form values when data changes
    useEffect(() => {
        form.reset(mapShippingRateToFormValues(data));
    }, [data, form]);

    // Submit handler for form submission
    const handleSubmit = async (
        values: z.infer<typeof ShippingRateFormSchema>
    ) => {
        try {
            // Upserting category data
            const response = await upsertShippingRate(storeUrl, {
                id: data?.shippingRate ? data.shippingRate.id : v4(),
                countryId: data?.countryId ? data.countryId : "",
                shippingService: values.shippingService,
                shippingFeePerItem: values.shippingFeePerItem,
                shippingFeeForAdditionalItem:
                    values.shippingFeeForAdditionalItem,
                shippingFeePerKg: values.shippingFeePerKg,
                shippingFeeFixed: values.shippingFeeFixed,
                deliveryTimeMin: values.deliveryTimeMin,
                deliveryTimeMax: values.deliveryTimeMax,
                returnPolicy: values.returnPolicy,
            });

            if (response.id) {
                // Displaying success message
                toast({
                    title: "Shipping rate has been updated.",
                });

                // Redirect or Refresh data
                router.refresh();
            }
        } catch (error: unknown) {
            // Handling form submission errors
            if (error instanceof Error) {
                console.error(
                    "Error submitting shipping rate form:",
                    error.message,
                    error.stack
                );
            } else {
                console.error("Error submitting shipping rate form:", error);
            }
            toast({
                variant: "destructive",
                title: "Oops!",
                description:
                    error instanceof Error ? error.message : String(error),
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
                                            <FormLabel>Country ID</FormLabel>
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
                                            <FormLabel>Country name</FormLabel>
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
                                    control={form.control}
                                    name="shippingFeePerItem"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>
                                                Shipping fee per item
                                            </FormLabel>
                                            <FormControl>
                                                <NumberInput
                                                    value={field.value}
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                    step={0.1}
                                                    min={0}
                                                    className="rounded-md pl-1 !shadow-none"
                                                    placeholder="Shipping fees per item"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="shippingFeeForAdditionalItem"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>
                                                Shipping fee for additional item
                                            </FormLabel>
                                            <FormControl>
                                                <NumberInput
                                                    value={field.value}
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                    step={0.1}
                                                    min={0}
                                                    className="rounded-md pl-1 !shadow-none"
                                                    placeholder="Shipping fees for additional item"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="shippingFeePerKg"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>
                                                Shipping fee per kg
                                            </FormLabel>
                                            <FormControl>
                                                <NumberInput
                                                    value={field.value}
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                    step={0.1}
                                                    min={0}
                                                    className="rounded-md pl-1 !shadow-none"
                                                    placeholder="Shipping fees per kg"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="shippingFeeFixed"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>
                                                Fixed Shipping fee
                                            </FormLabel>
                                            <FormControl>
                                                <NumberInput
                                                    value={field.value}
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                    step={0.1}
                                                    min={0}
                                                    className="rounded-md pl-1 !shadow-none"
                                                    placeholder="Fixed Shipping Fee"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="deliveryTimeMin"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>
                                                Delivery Time Min
                                            </FormLabel>
                                            <FormControl>
                                                <NumberInput
                                                    value={field.value}
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                    min={1}
                                                    className="rounded-md pl-1 !shadow-none"
                                                    placeholder="Minimum Delivery Time (days)"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="deliveryTimeMax"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>
                                                Delivery Time Max
                                            </FormLabel>
                                            <FormControl>
                                                <NumberInput
                                                    value={field.value}
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                    min={1}
                                                    className="rounded-md pl-1 !shadow-none"
                                                    placeholder="Maximum Delivery Time (days)"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
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
