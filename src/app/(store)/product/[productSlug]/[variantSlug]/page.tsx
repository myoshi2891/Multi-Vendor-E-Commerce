import StoreCard from "@/components/store/cards/store-card";
import CategoriesHeader from '@/components/store/layout/categories-header/categories-header'
import StoreHeader from '@/components/store/layout/header/header'
import ProductPageContainer from '@/components/store/product-page/container'
import ProductDescription from '@/components/store/product-page/product-description'
import ProductQuestions from '@/components/store/product-page/product-questions'
import ProductSpecs from '@/components/store/product-page/product-specs'
import RelatedProducts from '@/components/store/product-page/related-product'
import ProductReviews from '@/components/store/product-page/reviews/product-reviews'
import StoreProducts from '@/components/store/product-page/store-products'
import { Separator } from '@/components/ui/separator'
import { getProductPageData, getProducts } from '@/queries/product'
import { notFound, redirect } from 'next/navigation'

interface PageProps {
    params: Promise<{ productSlug: string; variantSlug: string }>
    searchParams: Promise<{ size?: string }>
}
/**
 * Renders the product variant page for the given route parameters and search params.
 *
 * Fetches product and variant data for the provided slugs, validates or normalizes the `size`
 * query parameter (redirecting when the size is invalid or auto-selecting when only one size
 * is available), and returns the JSX for the product variant view including related products,
 * reviews, descriptions, specs, questions, and store information.
 *
 * @param params - A promise that resolves to an object with `productSlug` and `variantSlug`.
 * @param searchParams - A promise that resolves to an object with optional `size` (the size id).
 * @returns The React element for the product variant page. May perform redirects or return a 404 view when appropriate.
 */
export default async function ProductVariantPage({
    params,
    searchParams,
}: PageProps) {
    const { productSlug, variantSlug } = await params;
    const { size: sizeId } = await searchParams;
    // Fetch product data based on the product slug and variant slug
    const productData = await getProductPageData(productSlug, variantSlug)

    // If no product data is found, show the 404 Not Found page
    if (!productData) {
        return notFound()
        // return redirect("/");
    }

    // Extract the available sizes for the product variant
    const { sizes } = productData

    // If the size is provided in the URL
    if (sizeId) {
        // Check if the provided size is available for the product variant
        const isValidSize = sizes.some((size) => size.id === sizeId)

        // If the is not valid, redirect to the same product page without the size parameter
        if (!isValidSize) {
            return redirect(`/product/${productSlug}/${variantSlug}`)
        }
    }
    // If no sizeId is provided and there's only one size available, automatically select it
    else if (sizes.length === 1) {
        return redirect(
            `/product/${productSlug}/${variantSlug}?size=${sizes[0].id}` // Redirect to the URL with the size parameter prefilled
        )
    }

    const {
        productId,
        variantInfo,
        specs,
        questions,
        shippingDetails,
        category,
        subCategory,
        store,
        reviewsStatistics,
        reviews,
    } = productData

    const relatedProducts = await getProducts(
        {
            category: category.url,
        },
        '',
        1,
        12
    )

    return (
        <div>
            <StoreHeader />
            <CategoriesHeader />
            <div className="mx-auto max-w-[1650px] overflow-x-hidden p-4">
                <div className="rounded-md border bg-white p-4 text-black shadow" />

                <ProductPageContainer productData={productData} sizeId={sizeId}>
                    {relatedProducts.products && (
                        <>
                            <Separator />
                            {/* Related Products */}
                            <RelatedProducts
                                products={relatedProducts.products}
                            />
                        </>
                    )}
                    <Separator className="mt-6" />
                    {/* Product Reviews */}
                    <ProductReviews
                        productId={productData.productId}
                        rating={productData.rating}
                        statistics={reviewsStatistics}
                        reviews={reviews}
                        variantsInfo={variantInfo}
                    />
                    <>
                        <Separator className="mt-6" />
                        {/* Product description */}
                        <ProductDescription
                            text={[
                                productData.description,
                                productData.variantDescription || '',
                            ]}
                        />
                    </>
                    {(specs.product.length > 0 || specs.variant.length > 0) && (
                        <>
                            <Separator className="mt-6" />
                            {/* Specs table */}
                            <ProductSpecs specs={specs} />
                        </>
                    )}
                    {questions.length > 0 && (
                        <>
                            <Separator className="mt-6" />
                            {/* Product Questions */}
                            <ProductQuestions
                                questions={productData.questions}
                            />
                        </>
                    )}
                    <Separator className="mt-6" />
                    {/* Store Card */}
                    <StoreCard store={productData.store} />
                    {/* Store products */}
                    <StoreProducts
                        storeUrl={store.url}
                        storeName={store.name}
                        count={5}
                    />
                </ProductPageContainer>
            </div>
        </div>
    )
}
