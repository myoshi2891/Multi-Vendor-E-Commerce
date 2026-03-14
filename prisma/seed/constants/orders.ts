import type { SeedOrder } from "../types";

/** 注文データ */
export const SEED_ORDERS: SeedOrder[] = [
  {
    "seedKey": "order-001",
    "userEmail": "lux-seed-customer-02@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Processing",
    "paymentStatus": "Paid",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-noir-elegance",
        "status": "Processing",
        "couponCode": "LUXNOIRELEGANCE2026",
        "items": [
          {
            "productSlug": "lux-noir-leather-chelsea-boots",
            "variantSlug": "lux-noir-leather-chelsea-boots-black-calfskin",
            "size": "37",
            "quantity": 2,
            "status": "Pending"
          },
          {
            "productSlug": "lux-noir-leather-chelsea-boots",
            "variantSlug": "lux-noir-leather-chelsea-boots-black-calfskin",
            "size": "36",
            "quantity": 1,
            "status": "Pending"
          }
        ]
      },
      {
        "storeUrl": "lux-atelier-divine",
        "status": "Processing",
        "items": [
          {
            "productSlug": "lux-atelier-diamond-pave-ring",
            "variantSlug": "lux-atelier-diamond-pave-ring-white-gold-pave",
            "size": "8",
            "quantity": 2,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-002",
    "userEmail": "lux-seed-customer-03@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Shipped",
    "paymentStatus": "Paid",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-oro-palazzo",
        "status": "Shipped",
        "items": [
          {
            "productSlug": "lux-oro-gold-cufflinks",
            "variantSlug": "lux-oro-gold-cufflinks-yellow-gold",
            "size": "One Size",
            "quantity": 1,
            "status": "Pending"
          },
          {
            "productSlug": "lux-oro-gold-cufflinks",
            "variantSlug": "lux-oro-gold-cufflinks-yellow-gold",
            "size": "One Size",
            "quantity": 1,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-003",
    "userEmail": "lux-seed-customer-03@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Delivered",
    "paymentStatus": "Paid",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-velvet-crown",
        "status": "Delivered",
        "couponCode": "LUXVELVETCROWN2026",
        "items": [
          {
            "productSlug": "lux-velvet-patent-leather-pumps",
            "variantSlug": "lux-velvet-patent-leather-pumps-black-patent",
            "size": "40",
            "quantity": 1,
            "status": "Pending"
          }
        ]
      },
      {
        "storeUrl": "lux-lumiere-paris",
        "status": "Delivered",
        "items": [
          {
            "productSlug": "lux-lumiere-crepe-tailored-trousers",
            "variantSlug": "lux-lumiere-crepe-tailored-trousers-black",
            "size": "10",
            "quantity": 1,
            "status": "Pending"
          },
          {
            "productSlug": "lux-lumiere-crepe-tailored-trousers",
            "variantSlug": "lux-lumiere-crepe-tailored-trousers-black",
            "size": "10",
            "quantity": 1,
            "status": "Pending"
          },
          {
            "productSlug": "lux-lumiere-crepe-tailored-trousers",
            "variantSlug": "lux-lumiere-crepe-tailored-trousers-black",
            "size": "8",
            "quantity": 1,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-004",
    "userEmail": "lux-seed-customer-05@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Canceled",
    "paymentStatus": "Cancelled",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-atelier-divine",
        "status": "Canceled",
        "items": [
          {
            "productSlug": "lux-atelier-artisan-gold-chain-necklace",
            "variantSlug": "lux-atelier-artisan-gold-chain-necklace-18k-yellow-gold",
            "size": "50cm",
            "quantity": 1,
            "status": "Pending"
          }
        ]
      },
      {
        "storeUrl": "lux-maison-luxe",
        "status": "Canceled",
        "items": [
          {
            "productSlug": "lux-maison-silk-organza-blouse",
            "variantSlug": "lux-maison-silk-organza-blouse-ivory",
            "size": "M",
            "quantity": 2,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-005",
    "userEmail": "lux-seed-customer-05@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Refunded",
    "paymentStatus": "Refunded",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-maison-luxe",
        "status": "Refunded",
        "items": [
          {
            "productSlug": "lux-maison-embroidered-cocktail-dress",
            "variantSlug": "lux-maison-embroidered-cocktail-dress-navy",
            "size": "XS",
            "quantity": 2,
            "status": "Pending"
          },
          {
            "productSlug": "lux-maison-tailored-blazer",
            "variantSlug": "lux-maison-tailored-blazer-black",
            "size": "34",
            "quantity": 1,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-006",
    "userEmail": "lux-seed-customer-04@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Pending",
    "paymentStatus": "Pending",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-velvet-crown",
        "status": "Pending",
        "couponCode": "LUXVELVETCROWN2026",
        "items": [
          {
            "productSlug": "lux-velvet-structured-tote-bag",
            "variantSlug": "lux-velvet-structured-tote-bag-camel",
            "size": "One Size",
            "quantity": 1,
            "status": "Pending"
          },
          {
            "productSlug": "lux-velvet-patent-leather-pumps",
            "variantSlug": "lux-velvet-patent-leather-pumps-black-patent",
            "size": "40",
            "quantity": 1,
            "status": "Pending"
          }
        ]
      },
      {
        "storeUrl": "lux-oro-palazzo",
        "status": "Pending",
        "items": [
          {
            "productSlug": "lux-oro-gold-cufflinks",
            "variantSlug": "lux-oro-gold-cufflinks-rose-gold",
            "size": "One Size",
            "quantity": 1,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-007",
    "userEmail": "lux-seed-customer-05@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Processing",
    "paymentStatus": "Paid",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-atelier-divine",
        "status": "Processing",
        "couponCode": "LUXATELIERDIVINE2026",
        "items": [
          {
            "productSlug": "lux-atelier-hammered-silver-cuff",
            "variantSlug": "lux-atelier-hammered-silver-cuff-oxidized-sterling-silver",
            "size": "L (19cm)",
            "quantity": 1,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-008",
    "userEmail": "lux-seed-customer-01@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Shipped",
    "paymentStatus": "Paid",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-maison-luxe",
        "status": "Shipped",
        "couponCode": "LUXMAISONLUXE2026",
        "items": [
          {
            "productSlug": "lux-maison-leather-shoulder-bag",
            "variantSlug": "lux-maison-leather-shoulder-bag-cognac",
            "size": "One Size",
            "quantity": 2,
            "status": "Pending"
          },
          {
            "productSlug": "lux-maison-silk-organza-blouse",
            "variantSlug": "lux-maison-silk-organza-blouse-ivory",
            "size": "XL",
            "quantity": 2,
            "status": "Pending"
          },
          {
            "productSlug": "lux-maison-pleated-midi-skirt",
            "variantSlug": "lux-maison-pleated-midi-skirt-black",
            "size": "S",
            "quantity": 2,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-009",
    "userEmail": "lux-seed-customer-02@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Delivered",
    "paymentStatus": "Paid",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-maison-luxe",
        "status": "Delivered",
        "couponCode": "LUXMAISONLUXE2026",
        "items": [
          {
            "productSlug": "lux-maison-tailored-blazer",
            "variantSlug": "lux-maison-tailored-blazer-black",
            "size": "36",
            "quantity": 2,
            "status": "Pending"
          },
          {
            "productSlug": "lux-maison-silk-organza-blouse",
            "variantSlug": "lux-maison-silk-organza-blouse-ivory",
            "size": "XS",
            "quantity": 1,
            "status": "Pending"
          },
          {
            "productSlug": "lux-maison-leather-shoulder-bag",
            "variantSlug": "lux-maison-leather-shoulder-bag-cognac",
            "size": "One Size",
            "quantity": 1,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-010",
    "userEmail": "lux-seed-customer-04@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Canceled",
    "paymentStatus": "Cancelled",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-oro-palazzo",
        "status": "Canceled",
        "couponCode": "LUXOROPALAZZO2026",
        "items": [
          {
            "productSlug": "lux-oro-gold-cufflinks",
            "variantSlug": "lux-oro-gold-cufflinks-yellow-gold",
            "size": "One Size",
            "quantity": 1,
            "status": "Pending"
          },
          {
            "productSlug": "lux-oro-gold-cufflinks",
            "variantSlug": "lux-oro-gold-cufflinks-yellow-gold",
            "size": "One Size",
            "quantity": 1,
            "status": "Pending"
          },
          {
            "productSlug": "lux-oro-cashmere-overcoat",
            "variantSlug": "lux-oro-cashmere-overcoat-charcoal",
            "size": "52",
            "quantity": 1,
            "status": "Pending"
          }
        ]
      },
      {
        "storeUrl": "lux-maison-luxe",
        "status": "Canceled",
        "items": [
          {
            "productSlug": "lux-maison-tailored-blazer",
            "variantSlug": "lux-maison-tailored-blazer-navy",
            "size": "42",
            "quantity": 1,
            "status": "Pending"
          },
          {
            "productSlug": "lux-maison-embroidered-cocktail-dress",
            "variantSlug": "lux-maison-embroidered-cocktail-dress-navy",
            "size": "L",
            "quantity": 2,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-011",
    "userEmail": "lux-seed-customer-03@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Refunded",
    "paymentStatus": "Refunded",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-oro-palazzo",
        "status": "Refunded",
        "couponCode": "LUXOROPALAZZO2026",
        "items": [
          {
            "productSlug": "lux-oro-chronograph-dress-watch",
            "variantSlug": "lux-oro-chronograph-dress-watch-steel-bracelet",
            "size": "One Size",
            "quantity": 2,
            "status": "Pending"
          }
        ]
      },
      {
        "storeUrl": "lux-noir-elegance",
        "status": "Refunded",
        "items": [
          {
            "productSlug": "lux-noir-leather-chelsea-boots",
            "variantSlug": "lux-noir-leather-chelsea-boots-brown-suede",
            "size": "38",
            "quantity": 2,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-012",
    "userEmail": "lux-seed-customer-01@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Pending",
    "paymentStatus": "Pending",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-lumiere-paris",
        "status": "Pending",
        "items": [
          {
            "productSlug": "lux-lumiere-lambskin-driving-gloves",
            "variantSlug": "lux-lumiere-lambskin-driving-gloves-cognac",
            "size": "L",
            "quantity": 2,
            "status": "Pending"
          },
          {
            "productSlug": "lux-lumiere-lambskin-driving-gloves",
            "variantSlug": "lux-lumiere-lambskin-driving-gloves-black",
            "size": "M",
            "quantity": 1,
            "status": "Pending"
          },
          {
            "productSlug": "lux-lumiere-monogrammed-canvas-tote",
            "variantSlug": "lux-lumiere-monogrammed-canvas-tote-natural-canvas-with-tan-leather",
            "size": "One Size",
            "quantity": 2,
            "status": "Pending"
          }
        ]
      },
      {
        "storeUrl": "lux-maison-luxe",
        "status": "Pending",
        "items": [
          {
            "productSlug": "lux-maison-cashmere-wrap-coat",
            "variantSlug": "lux-maison-cashmere-wrap-coat-charcoal",
            "size": "M",
            "quantity": 1,
            "status": "Pending"
          },
          {
            "productSlug": "lux-maison-pleated-midi-skirt",
            "variantSlug": "lux-maison-pleated-midi-skirt-black",
            "size": "L",
            "quantity": 2,
            "status": "Pending"
          },
          {
            "productSlug": "lux-maison-embroidered-cocktail-dress",
            "variantSlug": "lux-maison-embroidered-cocktail-dress-burgundy",
            "size": "S",
            "quantity": 2,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-013",
    "userEmail": "lux-seed-customer-05@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Processing",
    "paymentStatus": "Paid",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-oro-palazzo",
        "status": "Processing",
        "items": [
          {
            "productSlug": "lux-oro-silk-pocket-square-set",
            "variantSlug": "lux-oro-silk-pocket-square-set-classic-collection",
            "size": "One Size",
            "quantity": 1,
            "status": "Pending"
          },
          {
            "productSlug": "lux-oro-silk-pocket-square-set",
            "variantSlug": "lux-oro-silk-pocket-square-set-classic-collection",
            "size": "One Size",
            "quantity": 1,
            "status": "Pending"
          }
        ]
      },
      {
        "storeUrl": "lux-lumiere-paris",
        "status": "Processing",
        "items": [
          {
            "productSlug": "lux-lumiere-crepe-tailored-trousers",
            "variantSlug": "lux-lumiere-crepe-tailored-trousers-navy",
            "size": "4",
            "quantity": 2,
            "status": "Pending"
          },
          {
            "productSlug": "lux-lumiere-monogrammed-canvas-tote",
            "variantSlug": "lux-lumiere-monogrammed-canvas-tote-natural-canvas-with-tan-leather",
            "size": "One Size",
            "quantity": 2,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-014",
    "userEmail": "lux-seed-customer-01@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Shipped",
    "paymentStatus": "Paid",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-oro-palazzo",
        "status": "Shipped",
        "items": [
          {
            "productSlug": "lux-oro-silk-pocket-square-set",
            "variantSlug": "lux-oro-silk-pocket-square-set-classic-collection",
            "size": "One Size",
            "quantity": 2,
            "status": "Pending"
          },
          {
            "productSlug": "lux-oro-italian-leather-loafers",
            "variantSlug": "lux-oro-italian-leather-loafers-black",
            "size": "44",
            "quantity": 1,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-015",
    "userEmail": "lux-seed-customer-03@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Delivered",
    "paymentStatus": "Paid",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-noir-elegance",
        "status": "Delivered",
        "items": [
          {
            "productSlug": "lux-noir-tailored-wide-leg-trousers",
            "variantSlug": "lux-noir-tailored-wide-leg-trousers-black-crepe",
            "size": "10",
            "quantity": 1,
            "status": "Pending"
          },
          {
            "productSlug": "lux-noir-leather-chelsea-boots",
            "variantSlug": "lux-noir-leather-chelsea-boots-brown-suede",
            "size": "41",
            "quantity": 1,
            "status": "Pending"
          },
          {
            "productSlug": "lux-noir-cashmere-double-breasted-coat",
            "variantSlug": "lux-noir-cashmere-double-breasted-coat-ivory",
            "size": "XS",
            "quantity": 2,
            "status": "Pending"
          }
        ]
      },
      {
        "storeUrl": "lux-maison-luxe",
        "status": "Delivered",
        "items": [
          {
            "productSlug": "lux-maison-leather-shoulder-bag",
            "variantSlug": "lux-maison-leather-shoulder-bag-cognac",
            "size": "One Size",
            "quantity": 1,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-016",
    "userEmail": "lux-seed-customer-04@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Canceled",
    "paymentStatus": "Cancelled",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-noir-elegance",
        "status": "Canceled",
        "couponCode": "LUXNOIRELEGANCE2026",
        "items": [
          {
            "productSlug": "lux-noir-leather-chelsea-boots",
            "variantSlug": "lux-noir-leather-chelsea-boots-black-calfskin",
            "size": "36",
            "quantity": 2,
            "status": "Pending"
          },
          {
            "productSlug": "lux-noir-italian-wool-three-piece-suit",
            "variantSlug": "lux-noir-italian-wool-three-piece-suit-charcoal-grey",
            "size": "52",
            "quantity": 1,
            "status": "Pending"
          },
          {
            "productSlug": "lux-noir-tailored-wide-leg-trousers",
            "variantSlug": "lux-noir-tailored-wide-leg-trousers-black-crepe",
            "size": "8",
            "quantity": 2,
            "status": "Pending"
          }
        ]
      },
      {
        "storeUrl": "lux-maison-luxe",
        "status": "Canceled",
        "items": [
          {
            "productSlug": "lux-maison-silk-organza-blouse",
            "variantSlug": "lux-maison-silk-organza-blouse-ivory",
            "size": "XS",
            "quantity": 2,
            "status": "Pending"
          },
          {
            "productSlug": "lux-maison-leather-shoulder-bag",
            "variantSlug": "lux-maison-leather-shoulder-bag-cognac",
            "size": "One Size",
            "quantity": 2,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-017",
    "userEmail": "lux-seed-customer-01@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Refunded",
    "paymentStatus": "Refunded",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-lumiere-paris",
        "status": "Refunded",
        "items": [
          {
            "productSlug": "lux-lumiere-crepe-tailored-trousers",
            "variantSlug": "lux-lumiere-crepe-tailored-trousers-black",
            "size": "10",
            "quantity": 2,
            "status": "Pending"
          }
        ]
      }
    ]
  },
  {
    "seedKey": "order-018",
    "userEmail": "lux-seed-customer-03@example.com",
    "shippingAddressIndex": 0,
    "orderStatus": "Pending",
    "paymentStatus": "Pending",
    "paymentMethod": "Stripe",
    "groups": [
      {
        "storeUrl": "lux-lumiere-paris",
        "status": "Pending",
        "items": [
          {
            "productSlug": "lux-lumiere-monogrammed-canvas-tote",
            "variantSlug": "lux-lumiere-monogrammed-canvas-tote-natural-canvas-with-tan-leather",
            "size": "One Size",
            "quantity": 2,
            "status": "Pending"
          },
          {
            "productSlug": "lux-lumiere-vintage-inspired-sunglasses",
            "variantSlug": "lux-lumiere-vintage-inspired-sunglasses-jet-black",
            "size": "One Size",
            "quantity": 2,
            "status": "Pending"
          },
          {
            "productSlug": "lux-lumiere-satin-midi-skirt",
            "variantSlug": "lux-lumiere-satin-midi-skirt-champagne",
            "size": "XS",
            "quantity": 2,
            "status": "Pending"
          }
        ]
      }
    ]
  }
];
