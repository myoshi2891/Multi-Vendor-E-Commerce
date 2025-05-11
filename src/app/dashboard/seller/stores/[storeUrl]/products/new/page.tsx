import ProductDetails from "@/components/dashboard/forms/product-details";
import { getAllCategories } from "@/queries/category";

export default async function SellerNewProductPage({
	params,
}: {
	params: { storeUrl: string };
}) {
	const categories = await getAllCategories();
	// const offerTags = await getAllOfferTags();
	return (
		<div className="w-full">
			<ProductDetails
				categories={categories}
				storeUrl={params.storeUrl}
				// offerTags={offerTags}
			/>
		</div>
	);
}
