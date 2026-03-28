import { db } from "@/lib/db";
import { redirect } from "next/navigation";

/**
 * Redirects to the first variant's product page for the given product slug, or to the home page if the product can't be fetched or has no variants.
 *
 * @param params - A promise that resolves to an object containing `productSlug`, used to look up the product.
 * @returns A redirect response to `/product/{productSlug}/{variantSlug}` when a product with variants is found, otherwise a redirect to `/`.
 */
export default async function ProductPage({
	params,
}: {
	params: Promise<{ productSlug: string }>;
}) {
	const { productSlug } = await params;

	let product;
	try {
		product = await db.product.findUnique({
			where: { slug: productSlug },
			include: { variants: true },
		});
	} catch (error: unknown) {
		if (error instanceof Error) {
			console.error("[ProductPage] Failed to fetch product:", error.message, error.stack);
		} else {
			console.error("[ProductPage] Failed to fetch product:", error);
		}
		return redirect('/');
	}

	if (!product || !product.variants.length) return redirect('/');

	return redirect(`/product/${product.slug}/${product.variants[0].slug}`);
}
