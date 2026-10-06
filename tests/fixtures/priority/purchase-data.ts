import type { ProductType } from "@/lib/types";
export const products: ProductType[] = [
    {
        id: "piece",
        slug: "considered-piece",
        name: "A considered piece with a long name ".repeat(4),
        rating: 0,
        sales: 0,
        numReviews: 0,
        variants: [
            {
                variantId: "variant",
                variantSlug: "ivory",
                variantName: "Ivory",
                images: [
                    {
                        id: "image",
                        url: "/assets/brand/star.svg",
                        alt: "Ivory piece",
                        productVariantId: "variant",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                ],
                sizes: [
                    {
                        id: "size",
                        size: "One size",
                        price: 45,
                        discount: 0,
                        quantity: 2,
                        productVariantId: "variant",
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    },
                ],
            },
        ],
        variantImages: [
            {
                url: "/product/considered-piece/ivory",
                image: "/assets/brand/star.svg",
            },
        ],
    },
];
