import type { SeedOrder } from "../types";

/** 注文データ（カタログから決定論的に生成） */
export const SEED_ORDERS: SeedOrder[] = [
    {
        seedKey: "order-001",
        userEmail: "lux-seed-customer-01@example.com",
        shippingAddressIndex: 0,
        orderStatus: "Delivered",
        paymentStatus: "Paid",
        paymentMethod: "Stripe",
        groups: [
            {
                storeUrl: "lux-noir-elegance",
                status: "Delivered",
                couponCode: "LUXNOIRELEGANCE2026",
                items: [
                    {
                        productSlug: "lux-noir-cashmere-double-breasted-coat",
                        variantSlug: "lux-noir-cashmere-coat-black",
                        size: "XS",
                        quantity: 1,
                        status: "Delivered",
                    },
                ],
            },
        ],
    },
    {
        seedKey: "order-002",
        userEmail: "lux-seed-customer-02@example.com",
        shippingAddressIndex: 0,
        orderStatus: "Shipped",
        paymentStatus: "Paid",
        paymentMethod: "PayPal",
        groups: [
            {
                storeUrl: "lux-maison-luxe",
                status: "Shipped",
                items: [
                    {
                        productSlug: "lux-maison-embroidered-tulle-blouse",
                        variantSlug: "lux-maison-tulle-blouse-ivory",
                        size: "M",
                        quantity: 1,
                        status: "Shipped",
                    },
                    {
                        productSlug: "lux-maison-structured-tweed-jacket",
                        variantSlug: "lux-maison-tweed-jacket-navy",
                        size: "38",
                        quantity: 2,
                        status: "Shipped",
                    },
                ],
            },
            {
                storeUrl: "lux-atelier-divine",
                status: "Shipped",
                couponCode: "LUXATELIERDIVINE2026",
                items: [
                    {
                        productSlug: "lux-atelier-hammered-silver-cuff",
                        variantSlug: "lux-atelier-silver-cuff-oxidized",
                        size: "L (19cm)",
                        quantity: 1,
                        status: "Shipped",
                    },
                ],
            },
        ],
    },
    {
        seedKey: "order-003",
        userEmail: "lux-seed-customer-03@example.com",
        shippingAddressIndex: 0,
        orderStatus: "Processing",
        paymentStatus: "Paid",
        paymentMethod: "Stripe",
        groups: [
            {
                storeUrl: "lux-atelier-divine",
                status: "Processing",
                couponCode: "LUXATELIERDIVINE2026",
                items: [
                    {
                        productSlug: "lux-atelier-hammered-silver-cuff",
                        variantSlug: "lux-atelier-silver-cuff-oxidized",
                        size: "L (19cm)",
                        quantity: 1,
                        status: "Processing",
                    },
                ],
            },
        ],
    },
    {
        seedKey: "order-004",
        userEmail: "lux-seed-customer-04@example.com",
        shippingAddressIndex: 0,
        orderStatus: "Pending",
        paymentStatus: "Pending",
        paymentMethod: "PayPal",
        groups: [
            {
                storeUrl: "lux-velvet-crown",
                status: "Pending",
                items: [
                    {
                        productSlug: "lux-velvet-patent-stiletto-heels",
                        variantSlug: "lux-velvet-patent-stiletto-black",
                        size: "39",
                        quantity: 1,
                        status: "Pending",
                    },
                    {
                        productSlug: "lux-velvet-calfskin-belt-monogram",
                        variantSlug: "lux-velvet-calfskin-belt-tan",
                        size: "100cm",
                        quantity: 2,
                        status: "Pending",
                    },
                ],
            },
            {
                storeUrl: "lux-oro-palazzo",
                status: "Pending",
                couponCode: "LUXOROPALAZZO2026",
                items: [
                    {
                        productSlug: "lux-oro-silk-pocket-square-set",
                        variantSlug: "lux-oro-pocket-square-set-classic",
                        size: "33cm x 33cm",
                        quantity: 1,
                        status: "Pending",
                    },
                ],
            },
        ],
    },
    {
        seedKey: "order-005",
        userEmail: "lux-seed-customer-05@example.com",
        shippingAddressIndex: 0,
        orderStatus: "Canceled",
        paymentStatus: "Cancelled",
        paymentMethod: "Stripe",
        groups: [
            {
                storeUrl: "lux-oro-palazzo",
                status: "Canceled",
                couponCode: "LUXOROPALAZZO2026",
                items: [
                    {
                        productSlug: "lux-oro-silk-pocket-square-set",
                        variantSlug: "lux-oro-pocket-square-set-classic",
                        size: "33cm x 33cm",
                        quantity: 1,
                        status: "Canceled",
                    },
                ],
            },
        ],
    },
    {
        seedKey: "order-006",
        userEmail: "lux-seed-customer-01@example.com",
        shippingAddressIndex: 1,
        orderStatus: "Refunded",
        paymentStatus: "Refunded",
        paymentMethod: "PayPal",
        groups: [
            {
                storeUrl: "lux-lumiere-paris",
                status: "Refunded",
                items: [
                    {
                        productSlug: "lux-lumiere-lambskin-driving-gloves",
                        variantSlug: "lux-lumiere-driving-gloves-black",
                        size: "L",
                        quantity: 1,
                        status: "Delivered",
                    },
                    {
                        productSlug: "lux-lumiere-boucle-cropped-jacket",
                        variantSlug: "lux-lumiere-boucle-jacket-pink",
                        size: "36",
                        quantity: 2,
                        status: "Delivered",
                    },
                ],
            },
            {
                storeUrl: "lux-noir-elegance",
                status: "Refunded",
                couponCode: "LUXNOIRELEGANCE2026",
                items: [
                    {
                        productSlug: "lux-noir-cashmere-double-breasted-coat",
                        variantSlug: "lux-noir-cashmere-coat-charcoal",
                        size: "S",
                        quantity: 1,
                        status: "Delivered",
                    },
                ],
            },
        ],
    },
    {
        seedKey: "order-007",
        userEmail: "lux-seed-customer-02@example.com",
        shippingAddressIndex: 0,
        orderStatus: "Delivered",
        paymentStatus: "Paid",
        paymentMethod: "Stripe",
        groups: [
            {
                storeUrl: "lux-noir-elegance",
                status: "Delivered",
                couponCode: "LUXNOIRELEGANCE2026",
                items: [
                    {
                        productSlug: "lux-noir-cashmere-double-breasted-coat",
                        variantSlug: "lux-noir-cashmere-coat-black",
                        size: "M",
                        quantity: 1,
                        status: "Delivered",
                    },
                ],
            },
        ],
    },
    {
        seedKey: "order-008",
        userEmail: "lux-seed-customer-03@example.com",
        shippingAddressIndex: 0,
        orderStatus: "Shipped",
        paymentStatus: "Paid",
        paymentMethod: "PayPal",
        groups: [
            {
                storeUrl: "lux-maison-luxe",
                status: "Shipped",
                items: [
                    {
                        productSlug: "lux-maison-embroidered-tulle-blouse",
                        variantSlug: "lux-maison-tulle-blouse-ivory",
                        size: "M",
                        quantity: 1,
                        status: "Shipped",
                    },
                    {
                        productSlug: "lux-maison-structured-tweed-jacket",
                        variantSlug: "lux-maison-tweed-jacket-navy",
                        size: "40",
                        quantity: 2,
                        status: "Shipped",
                    },
                ],
            },
            {
                storeUrl: "lux-atelier-divine",
                status: "Shipped",
                couponCode: "LUXATELIERDIVINE2026",
                items: [
                    {
                        productSlug: "lux-atelier-hammered-silver-cuff",
                        variantSlug: "lux-atelier-silver-cuff-oxidized",
                        size: "L (19cm)",
                        quantity: 1,
                        status: "Shipped",
                    },
                ],
            },
        ],
    },
    {
        seedKey: "order-009",
        userEmail: "lux-seed-customer-04@example.com",
        shippingAddressIndex: 0,
        orderStatus: "Processing",
        paymentStatus: "Paid",
        paymentMethod: "Stripe",
        groups: [
            {
                storeUrl: "lux-atelier-divine",
                status: "Processing",
                couponCode: "LUXATELIERDIVINE2026",
                items: [
                    {
                        productSlug: "lux-atelier-hammered-silver-cuff",
                        variantSlug: "lux-atelier-silver-cuff-oxidized",
                        size: "L (19cm)",
                        quantity: 1,
                        status: "Processing",
                    },
                ],
            },
        ],
    },
    {
        seedKey: "order-010",
        userEmail: "lux-seed-customer-05@example.com",
        shippingAddressIndex: 0,
        orderStatus: "Pending",
        paymentStatus: "Pending",
        paymentMethod: "PayPal",
        groups: [
            {
                storeUrl: "lux-velvet-crown",
                status: "Pending",
                items: [
                    {
                        productSlug: "lux-velvet-patent-stiletto-heels",
                        variantSlug: "lux-velvet-patent-stiletto-black",
                        size: "37",
                        quantity: 1,
                        status: "Pending",
                    },
                    {
                        productSlug: "lux-velvet-calfskin-belt-monogram",
                        variantSlug: "lux-velvet-calfskin-belt-tan",
                        size: "80cm",
                        quantity: 2,
                        status: "Pending",
                    },
                ],
            },
            {
                storeUrl: "lux-oro-palazzo",
                status: "Pending",
                couponCode: "LUXOROPALAZZO2026",
                items: [
                    {
                        productSlug: "lux-oro-silk-pocket-square-set",
                        variantSlug: "lux-oro-pocket-square-set-classic",
                        size: "33cm x 33cm",
                        quantity: 1,
                        status: "Pending",
                    },
                ],
            },
        ],
    },
    {
        seedKey: "order-011",
        userEmail: "lux-seed-customer-01@example.com",
        shippingAddressIndex: 0,
        orderStatus: "Canceled",
        paymentStatus: "Cancelled",
        paymentMethod: "Stripe",
        groups: [
            {
                storeUrl: "lux-oro-palazzo",
                status: "Canceled",
                couponCode: "LUXOROPALAZZO2026",
                items: [
                    {
                        productSlug: "lux-oro-silk-pocket-square-set",
                        variantSlug: "lux-oro-pocket-square-set-classic",
                        size: "33cm x 33cm",
                        quantity: 1,
                        status: "Canceled",
                    },
                ],
            },
        ],
    },
    {
        seedKey: "order-012",
        userEmail: "lux-seed-customer-02@example.com",
        shippingAddressIndex: 0,
        orderStatus: "Refunded",
        paymentStatus: "Refunded",
        paymentMethod: "PayPal",
        groups: [
            {
                storeUrl: "lux-lumiere-paris",
                status: "Refunded",
                items: [
                    {
                        productSlug: "lux-lumiere-lambskin-driving-gloves",
                        variantSlug: "lux-lumiere-driving-gloves-black",
                        size: "L",
                        quantity: 1,
                        status: "Delivered",
                    },
                    {
                        productSlug: "lux-lumiere-boucle-cropped-jacket",
                        variantSlug: "lux-lumiere-boucle-jacket-pink",
                        size: "38",
                        quantity: 2,
                        status: "Delivered",
                    },
                ],
            },
            {
                storeUrl: "lux-noir-elegance",
                status: "Refunded",
                couponCode: "LUXNOIRELEGANCE2026",
                items: [
                    {
                        productSlug: "lux-noir-cashmere-double-breasted-coat",
                        variantSlug: "lux-noir-cashmere-coat-charcoal",
                        size: "S",
                        quantity: 1,
                        status: "Delivered",
                    },
                ],
            },
        ],
    },
    {
        seedKey: "order-013",
        userEmail: "lux-seed-customer-03@example.com",
        shippingAddressIndex: 0,
        orderStatus: "Delivered",
        paymentStatus: "Paid",
        paymentMethod: "Stripe",
        groups: [
            {
                storeUrl: "lux-noir-elegance",
                status: "Delivered",
                couponCode: "LUXNOIRELEGANCE2026",
                items: [
                    {
                        productSlug: "lux-noir-cashmere-double-breasted-coat",
                        variantSlug: "lux-noir-cashmere-coat-black",
                        size: "XS",
                        quantity: 1,
                        status: "Delivered",
                    },
                ],
            },
        ],
    },
    {
        seedKey: "order-014",
        userEmail: "lux-seed-customer-04@example.com",
        shippingAddressIndex: 0,
        orderStatus: "Shipped",
        paymentStatus: "Paid",
        paymentMethod: "PayPal",
        groups: [
            {
                storeUrl: "lux-maison-luxe",
                status: "Shipped",
                items: [
                    {
                        productSlug: "lux-maison-embroidered-tulle-blouse",
                        variantSlug: "lux-maison-tulle-blouse-ivory",
                        size: "M",
                        quantity: 1,
                        status: "Shipped",
                    },
                    {
                        productSlug: "lux-maison-structured-tweed-jacket",
                        variantSlug: "lux-maison-tweed-jacket-navy",
                        size: "42",
                        quantity: 2,
                        status: "Shipped",
                    },
                ],
            },
            {
                storeUrl: "lux-atelier-divine",
                status: "Shipped",
                couponCode: "LUXATELIERDIVINE2026",
                items: [
                    {
                        productSlug: "lux-atelier-hammered-silver-cuff",
                        variantSlug: "lux-atelier-silver-cuff-oxidized",
                        size: "L (19cm)",
                        quantity: 1,
                        status: "Shipped",
                    },
                ],
            },
        ],
    },
    {
        seedKey: "order-015",
        userEmail: "lux-seed-customer-05@example.com",
        shippingAddressIndex: 0,
        orderStatus: "Processing",
        paymentStatus: "Paid",
        paymentMethod: "Stripe",
        groups: [
            {
                storeUrl: "lux-atelier-divine",
                status: "Processing",
                couponCode: "LUXATELIERDIVINE2026",
                items: [
                    {
                        productSlug: "lux-atelier-hammered-silver-cuff",
                        variantSlug: "lux-atelier-silver-cuff-oxidized",
                        size: "L (19cm)",
                        quantity: 1,
                        status: "Processing",
                    },
                ],
            },
        ],
    },
];
