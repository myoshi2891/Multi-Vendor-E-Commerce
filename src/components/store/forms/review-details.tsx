import { AddReviewSchema } from "@/lib/schemas";
import { ReviewDetailsType, VariantInfoType } from "@/lib/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

export default function ReviewDetails({
	productId,
	data,
	variantsInfo,
}: {
	productId: string;
	data: ReviewDetailsType;
	variantsInfo: VariantInfoType[];
}) {
	// State for selected variant
	const [activeVariant, setActiveVariant] = useState<VariantInfoType>(
		variantsInfo[0]
	);

	// State for sizes
	const [sizes, setSizes] = useState<{ name: string; value: string }[]>([]);

	// Form hook for managing form state and validation
	const form = useForm<z.infer<typeof AddReviewSchema>>({
		mode: "onChange", // Form validation mode
		resolver: zodResolver(AddReviewSchema), // Resolver for form validation
		defaultValues: {
			variantName: data?.variant || activeVariant.variantName,
			rating: data?.rating || 0,
			size: data?.size || "",
			review: data?.review || "",
			quantity: data?.quantity || undefined,
			images: data?.images || [],
			color: data?.color || "",
		},
	});

	// Loading status based on form submission
	const isLoading = form.formState.isSubmitting;

	// Errors
	const errors = form.formState.errors;

	// Submit handler for form submission
	const handleSubmit = async (values: z.infer<typeof AddReviewSchema>) => {
		try {
		} catch (error: any) {
			// Handle error submission errors
			console.error(error);
			toast.error("Failed to add review.");
		}
	};

	const variants = variantsInfo.map((v) => ({
		name: v.variantName,
		value: v.variantName,
		image: v.variantImage,
		colors: v.colors.map((c) => c.name).join(","),
    }));
    
    useEffect(() => {
        form.setValue("size", "")
        const name = form.getValues().variantName
        const variant = variantsInfo.find((v) => v.variantName === name)
        if (variant) {
            const sizes_data = variant.sizes.map((s) => ({
                name: s.size,
                value: s.size,
            }))
            setActiveVariant(variant)
            if (sizes) setSizes(sizes_data)
            form.setValue("color", variant.colors.join(','))
        }

    }, [form.getValues().variantName]);
	return <div>ReviewDetails</div>;
}
