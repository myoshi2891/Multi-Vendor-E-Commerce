import { db } from "@/lib/db";
import { redirect } from "next/navigation";

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
