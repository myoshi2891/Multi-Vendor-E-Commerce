import StoreCard from "@/components/store/cards/store-card";
import ProductPageContainer from '@/components/store/product-page/container'
import ProductDescription from '@/components/store/product-page/product-description'
import ProductQuestions from '@/components/store/product-page/product-questions'
import ProductSpecs from '@/components/store/product-page/product-specs'
import RelatedProducts from '@/components/store/product-page/related-product'
import ProductReviews from '@/components/store/product-page/reviews/product-reviews'
import StoreProducts from '@/components/store/product-page/store-products'
import { getProductPageData, getProducts } from '@/queries/product'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import styles from '@/components/store/product-page/product.module.css'
import ProductNavigation from '@/components/store/product-page/product-navigation'
import { getAllCategories } from '@/queries/category'
import { getAllOfferTags } from '@/queries/offer-tag'
import { resolveProductRating } from '@/components/store/product-page/display-rating'

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ productSlug: string; variantSlug: string }>
    searchParams: Promise<{ size?: string }>
}
/**
 * Renders the product variant page for the requested product and variant.
 *
 * Validates the `size` query parameter, redirects when it is invalid, auto-selects the only
 * available size when none is provided, and returns the product variant view with related
 * products, reviews, description, specs, questions, and store details.
 *
 * @param params - The route parameters containing `productSlug` and `variantSlug`.
 * @param searchParams - The search parameters containing an optional `size` value.
 * @returns The product variant page element, or a redirect/404 response when applicable.
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
        attributes,
        questions,
        shippingDetails,
        category,
        subCategory,
        store,
        reviewsStatistics,
        reviews,
    } = productData

    const [relatedProducts, categories, offerTags] = await Promise.all([
        getProducts({ category: category.url }, '', 1, 12),
        getAllCategories(),
        getAllOfferTags(),
    ])

    return (
        <main className={styles.page}>
            <ProductNavigation categories={categories} offers={offerTags} />
            <div className={styles.pageShell}>
                <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                    <Link href="/browse"><ArrowLeft size={14} /> The collection</Link>
                    <span aria-hidden="true">/</span>
                    <Link href={`/browse?category=${encodeURIComponent(category.url)}`}>{category.name}</Link>
                    <span aria-hidden="true">/</span>
                    <span aria-current="page">{productData.name}</span>
                </nav>
                <div className={styles.intro}>
                    <div>
                        <p className={styles.eyebrow}>THE EXTRAORDINARY, EVERY DAY <span>✦</span> A PIECE TO TREASURE</p>
                        <p className={styles.introTitle}>Made to be <em>yours.</em></p>
                        <p lang="ja" className={styles.introJapanese}>心ときめく出会いを、あなたの毎日に。</p>
                    </div>
                    <Link href="/browse" className={styles.introLink}>Explore the collection <ArrowUpRight size={15} /></Link>
                </div>
                <ProductPageContainer productData={productData} sizeId={sizeId}>
                    <div className={styles.contentSection}>
                        <ProductDescription
                            text={[
                                productData.description,
                                productData.variantDescription || '',
                            ]}
                        />
                    </div>
                    {(specs.product.length > 0 ||
                        specs.variant.length > 0 ||
                        attributes.product.length > 0 ||
                        attributes.variant.length > 0) && (
                        <div className={styles.contentSection}>
                            <ProductSpecs attributes={attributes} specs={specs} />
                        </div>
                    )}
                    {relatedProducts.products.length > 0 && (
                        <div className={styles.contentSection}>
                            <RelatedProducts products={relatedProducts.products} />
                        </div>
                    )}
                    <div className={styles.contentSection}>
                        <ProductReviews
                            productId={productData.productId}
                            rating={resolveProductRating(productData.rating, reviewsStatistics.ratingStatistics)}
                            statistics={reviewsStatistics}
                            reviews={reviews}
                            variantsInfo={variantInfo}
                        />
                    </div>
                    {questions.length > 0 && (
                        <div className={styles.contentSection}>
                            <ProductQuestions
                                questions={productData.questions}
                            />
                        </div>
                    )}
                    <div className={styles.contentSection}>
                        <StoreCard store={productData.store} editorial />
                    </div>
                    <StoreProducts storeUrl={store.url} storeName={store.name} count={5} />
                </ProductPageContainer>
            </div>
        </main>
    )
}
