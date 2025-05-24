import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function ProductPage({
	params,
}: {
	params: { productSlug: string };
}) {
	// Fetch the product from the database using the provided slug
	const product = await db.product.findUnique({
		where: {
			slug: params.productSlug,
		},
		include: { variants: true }, // Include product variants in the query
    });
    // If the product is not found, redirect to the homepage
    if (!product) return redirect('/')

    // If the product has no variants, redirect to the homepage
    if (!product.variants.length) return redirect('/');

    // If the product exists and has variants, redirect to the first variant's page
	return redirect(`/product/${product.slug}/${product.variants[0].slug}`);
}
