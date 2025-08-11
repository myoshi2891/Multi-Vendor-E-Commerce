import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { StoreShippingSchema } from "@/lib/schemas";
import { StoreType } from "@/lib/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dispatch, SetStateAction } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import AnimatedContainer from "../../animated-container";
import ImageUpload from "@/components/dashboard/shared/image-upload";
import Input from "@/components/store/ui/input";
import { Textarea } from "@/components/store/ui/textarea";
import { applySeller } from "@/queries/store";
import toast from "react-hot-toast";

export default function Step3({
    step,
    setStep,
    formData,
    setFormData,
}: {
    step: number;
    setStep: Dispatch<SetStateAction<number>>;
    formData: StoreType;
    setFormData: Dispatch<SetStateAction<StoreType>>;
}) {
    // Form hook for managing form state and validation
    const form = useForm<z.infer<typeof StoreShippingSchema>>({
        mode: "onChange", // Form validation mode
        resolver: zodResolver(StoreShippingSchema), // Resolver for form validation
        defaultValues: {
            defaultShippingService: formData.defaultShippingService ?? "",
            defaultShippingFeePerItem: formData.defaultShippingFeePerItem ,
            defaultShippingFeeForAdditionalItem:
                formData.defaultShippingFeeForAdditionalItem ,
            defaultShippingFeePerKg: formData.defaultShippingFeePerKg ,
            defaultShippingFeeFixed: formData.defaultShippingFeeFixed ,
            defaultDeliveryTimeMin: formData.defaultDeliveryTimeMin ,
            defaultDeliveryTimeMax: formData.defaultDeliveryTimeMax ,
            returnPolicy: formData.returnPolicy ?? "",
        },
    });

    // Get product details that are needed to add review info
    const handleSubmit = async (
        values: z.infer<typeof StoreShippingSchema>
    ) => {
        try {
            const response = await applySeller({
                name: formData.name,
                description: formData.description,
                email: formData.email,
                phone: formData.phone,
                logo: formData.logo,
                cover: formData.cover,
                url: formData.url,
                defaultShippingService: values.defaultShippingService,
                defaultShippingFeePerItem: values.defaultShippingFeePerItem,
                defaultShippingFeeForAdditionalItem:
                    values.defaultShippingFeeForAdditionalItem,
                defaultShippingFeePerKg: values.defaultShippingFeePerKg,
                defaultShippingFeeFixed: values.defaultShippingFeeFixed,
                defaultDeliveryTimeMin: values.defaultDeliveryTimeMin,
                defaultDeliveryTimeMax: values.defaultDeliveryTimeMax,
                returnPolicy: values.returnPolicy,
            });
            if (response.id) {
                setStep((prev) => prev + 1);
            }
        } catch (error: any) {
            toast.error(error.toString());
            console.error("Error applying seller", error);
        }
    };

    interface FormData {
        defaultShippingService: string;
        defaultShippingFeePerItem: number;
        defaultShippingFeePerKg: number;
        defaultShippingFeeForAdditionalItem: number;
        defaultShippingFeeFixed: number;
        defaultDeliveryTimeMin: number;
        defaultDeliveryTimeMax: number;
        returnPolicy: string;
    }

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = event.target;
        const parsedValue =
            type === "number" ? (value ? Number(value) : 0) : value;

        setFormData((prev) => ({ ...prev, [name]: parsedValue }));
        form.setValue(name as keyof FormData, parsedValue);
    };

    return (
        <div className="h-full">
            <AnimatedContainer>
                <Form {...form}>
                    <div className="mb-4 mt-2 pl-1 text-gray-600">
                        <p className="font-medium">
                            Fill out your store&apos;s default shipping details
                            (this is optional).
                        </p>
                        <ul className="ml-4 mt-2 list-disc text-sm">
                            <li>
                                Any fields left empty will default to our
                                pre-set formData.
                            </li>
                            <li>
                                Don&apos;t worry you can update your details
                                anytime from your seller dashboard.
                            </li>
                            <li>
                                You&apos;ll be able to customize your shipping
                                details for each country later on.
                            </li>
                        </ul>
                    </div>
                    <form onSubmit={form.handleSubmit(handleSubmit)}>
                        {/* Form items */}
                        <div className="space-y-4">
                            {/* Shipping Service */}
                            <FormField
                                control={form.control}
                                name="defaultShippingService"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Input
                                                placeholder="Shipping Service"
                                                value={field.value}
                                                type="text"
                                                name="defaultShippingService"
                                                onChange={handleInputChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Shipping Fee per Kg */}
                            <FormField
                                control={form.control}
                                name="defaultShippingFeePerKg"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Input
                                                placeholder="Shipping Fee for Additional Item"
                                                name="defaultShippingFeePerKg"
                                                value={field.value}
                                                type="number"
                                                onChange={handleInputChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Shipping Fee for Additional Item */}
                            <FormField
                                control={form.control}
                                name="defaultShippingFeeForAdditionalItem"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Input
                                                placeholder="Shipping Fee for Additional Item"
                                                name="defaultShippingFeeForAdditionalItem"
                                                value={field.value}
                                                type="number"
                                                onChange={handleInputChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Shipping Fee per Item */}
                            <FormField
                                control={form.control}
                                name="defaultShippingFeePerItem"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Input
                                                placeholder="Shipping Fee per Item"
                                                name="defaultShippingFeePerItem"
                                                value={field.value}
                                                type="number"
                                                onChange={handleInputChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Fixed Shipping */}
                            <FormField
                                control={form.control}
                                name="defaultShippingFeeFixed"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Input
                                                placeholder="Fixed Shipping Fee"
                                                name="defaultShippingFeeFixed"
                                                value={field.value}
                                                type="number"
                                                onChange={handleInputChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Delivery Time Min */}
                            <FormField
                                control={form.control}
                                name="defaultDeliveryTimeMin"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Input
                                                name="defaultDeliveryTimeMin"
                                                type="number"
                                                value={field.value}
                                                placeholder="Min Delivery Time"
                                                onChange={handleInputChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Delivery Time Max */}
                            <FormField
                                control={form.control}
                                name="defaultDeliveryTimeMax"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Input
                                                name="defaultDeliveryTimeMax"
                                                type="number"
                                                value={field.value}
                                                placeholder="Max Delivery Time"
                                                onChange={handleInputChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Return Policy */}
                            <FormField
                                control={form.control}
                                name="returnPolicy"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Textarea
                                                name="returnPolicy"
                                                value={field.value}
                                                placeholder="Return Policy"
                                                onChange={(e) => {
                                                    field.onChange(e);
                                                    setFormData({
                                                        ...formData,
                                                        returnPolicy:
                                                            field.value,
                                                    });
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </form>
                </Form>
            </AnimatedContainer>
            <div className="flex h-[100px] justify-between px-2 pt-4">
                <button
                    type="button"
                    onClick={() => step > 1 && setStep((prev) => prev - 1)}
                    className="h-10 rounded-lg border bg-white px-4 py-2 font-medium text-gray-600 shadow-sm hover:bg-gray-100"
                >
                    Previous
                </button>
                <button
                    type="submit"
                    onClick={form.handleSubmit(handleSubmit)}
                    className="h-10 rounded-lg border bg-blue-500 px-4 py-2 font-medium text-white shadow-sm hover:bg-blue-700"
                >
                    Submit
                </button>
            </div>
        </div>
    );
}
