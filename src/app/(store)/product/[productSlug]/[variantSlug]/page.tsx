import { getProductPageData } from "@/queries/product";

interface PageProps {
	params: { productSlug: string; variantSlug: string };
}
export default async function ProductVariantPage({
	params: { productSlug, variantSlug },
}: PageProps) {
	// Fetch product data based on the product slug and variant slug
	const productData = await getProductPageData(productSlug, variantSlug);

	return (
		<div>
			<h1 className="text-4xl font-bold">Variant Page</h1>
		</div>
	);
}
