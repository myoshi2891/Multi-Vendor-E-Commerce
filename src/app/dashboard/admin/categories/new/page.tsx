import CategoryDetails from "@/components/dashboard/forms/category-details";
import React from "react";

export default function AdminNewCategoryPage() {
    const CLOUDINARY_PRESET_KEY =
		process.env.NEXT_PUBLIC_CLOUDINARY_PRESET_NAME;
	if (!CLOUDINARY_PRESET_KEY) return null;

	return (
		<div className="w-full">
			<CategoryDetails cloudinary_key={CLOUDINARY_PRESET_KEY} />
		</div>
	);
}
