import ProductPageContainer from "@/components/store/product-page/container";
import { Separator } from "@/components/ui/separator";
import { getProductPageData } from "@/queries/product";
import { notFound, redirect } from "next/navigation";

interface PageProps {
	params: { productSlug: string; variantSlug: string };
	searchParams: { size?: string };
}
export default async function ProductVariantPage({
	params: { productSlug, variantSlug },
	searchParams: { size: sizeId },
}: PageProps) {
	// Fetch product data based on the product slug and variant slug
	const productData = await getProductPageData(productSlug, variantSlug);

	// If no product data is found, show the 404 Not Found page
	if (!productData) {
		return notFound();
		// return redirect("/");
	}

	// Extract the available sizes for the product variant
	const { sizes } = productData;

	// If the size is provided in the URL
	if (sizeId) {
		// Check if the provided size is available for the product variant
		const isValidSize = sizes.some((size) => size.id === sizeId);

		// If the is not valid, redirect to the same product page without the size parameter
		if (!isValidSize) {
			return redirect(`/product/${productSlug}/${variantSlug}`);
		}
	}
	// If no sizeId is provided and there's only one size available, automatically select it
	else if (sizes.length === 1) {
		return redirect(
			`/product/${productSlug}/${variantSlug}?size=${sizes[0].id}` // Redirect to the URL with the size parameter prefilled
		);
	}

	const relatedProducts = {
		products: [],
	};

	const { specs, questions } = productData;
	return (
		<div>
			<div className="max-w-[1650px] mx-auto p-4 overflow-x-hidden">
				<ProductPageContainer productData={productData} sizeId={sizeId}>
					{relatedProducts.products && (
						<>
							<Separator />
							{/* Related Products */}
						</>
					)}
					<Separator className="mt-6" />
					{/* Product Reviews */}
					<>
						<Separator className="mt-6" />
						{/* Product description */}
					</>
					{(specs.product.length > 0 || specs.variant.length > 0) && (
						<>
							<Separator className="mt-6" />
							{/* Specs table */}
						</>
					)}
					{questions.length > 0 && (
						<>
							<Separator className="mt-6" />
							{/* Product Questions */}
						</>
					)}
					<Separator className="mt-6" />
					{/* Store Card */}
					{/* Store products */}
				</ProductPageContainer>
			</div>
		</div>
	);
}
