import styles from "../../application.module.css";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { StoreFormSchema } from "@/lib/schemas";
import { StoreType } from "@/lib/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dispatch, SetStateAction } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import AnimatedContainer from "../../animated-container";
import ImageUpload from "@/components/dashboard/shared/image-upload";
import Input from "@/components/store/ui/input";
import { Textarea } from "@/components/store/ui/textarea";

interface FormData {
    name: string;
    description: string;
    email: string;
    phone: string;
    url: string;
    logo: string[];
    cover: string[];
}

export default function Step2({
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
    const form = useForm<z.infer<typeof StoreFormSchema>>({
        mode: "onChange", // Form validation mode
        resolver: zodResolver(StoreFormSchema), // Resolver for form validation
        defaultValues: {
            // Setting default form values from data (if available)
            name: formData?.name ?? "",
            description: formData?.description ?? "",
            url: formData?.url ?? "",
            email: formData?.email ?? "",
            phone: formData?.phone ?? "",
            logo: formData?.logo ? [{ url: formData.logo }] : [],
            cover: formData?.cover ? [{ url: formData.cover }] : [],
        },
    });

    // Get product details that are needed to add review info
    const handleSubmit = async (values: z.infer<typeof StoreFormSchema>) => {
        setFormData((prev) => ({
            ...prev,
            ...values,
            logo: values.logo[0]?.url ?? "",
            cover: values.cover[0]?.url ?? "",
        }));
        setStep((prev) => prev + 1);
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = event.target;
        const parsedValue = type === "number" ? Number(value) : value;

        setFormData((prev) => ({ ...prev, [name]: parsedValue }));
        form.setValue(name as keyof FormData, value);
    };

    const handleImageChange = (name: string, url: string) => {
        setFormData((prev) => ({ ...prev, [name]: url }));
        form.setValue(name as keyof FormData, [{ url }]);
    };

    return (
        <div className="h-full">
            <AnimatedContainer>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)}>
                        {/* Form items */}
                        <div className="space-y-4">
                            {/* Logo - Cover */}
                            <div className={styles.images}>
                                <FormField
                                    control={form.control}
                                    name="logo"
                                    render={({ field }) => (
                                        <FormItem className="min-w-0">
                                            <FormLabel>Store logo</FormLabel>
                                            <FormControl>
                                                <ImageUpload
                                                    error={
                                                        form.formState.errors
                                                            .logo
                                                            ? true
                                                            : false
                                                    }
                                                    type="profile"
                                                    value={field.value.map(
                                                        (image) => image.url
                                                    )}
                                                    onChange={(url) =>
                                                        handleImageChange(
                                                            "logo",
                                                            url
                                                        )
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
                                    control={form.control}
                                    name="cover"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Store cover</FormLabel>
                                            <FormControl>
                                                <ImageUpload
                                                    error={
                                                        form.formState.errors
                                                            .cover
                                                            ? true
                                                            : false
                                                    }
                                                    type="cover"
                                                    value={field.value.map(
                                                        (image) => image.url
                                                    )}
                                                    onChange={(url) => {
                                                        handleImageChange(
                                                            "cover",
                                                            url
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
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            {/* Name */}
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel>Store name</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Store Name"
                                                value={field.value}
                                                type="text"
                                                name="name"
                                                onChange={handleInputChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Description */}
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel>Store description</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Store Description"
                                                {...field}
                                                onChange={(e) => {
                                                    const { name, value } =
                                                        e.target;
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        [name]: value,
                                                    }));
                                                    field.onChange(e);
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Url */}
                            <FormField
                                control={form.control}
                                name="url"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Store URL</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Store Url"
                                                value={field.value}
                                                type="text"
                                                name="url"
                                                onChange={handleInputChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Email - Phone */}
                            <div className="flex flex-col gap-6 md:flex-row">
                                <FormField
                                    // disabled={isLoading}
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>Store email</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Store Email"
                                                    name="email"
                                                    type="text"
                                                    value={field.value}
                                                    onChange={handleInputChange}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>Store phone</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Store Phone"
                                                    name="phone"
                                                    type="text"
                                                    value={field.value}
                                                    onChange={handleInputChange}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </form>
                </Form>
            </AnimatedContainer>
            <div className={styles.actions}>
                <button
                    type="button"
                    onClick={() => step > 1 && setStep((prev) => prev - 1)}
                    className={styles.secondary}
                >
                    Previous
                </button>
                <button
                    type="submit"
                    onClick={form.handleSubmit(handleSubmit)}
                    className={styles.primary}
                >
                    Next
                </button>
            </div>
        </div>
    );
}
