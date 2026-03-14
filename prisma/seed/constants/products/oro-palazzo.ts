import type { SeedProduct } from "../../types";

const img = "/assets/images/no_image.png";

/** ORO PALAZZO — イタリアンクラフト（6商品） */
export const STORE_PRODUCTS: SeedProduct[] = [
  // ── 1. Italian Linen Summer Suit ──
  {
    name: "Italian Linen Summer Suit",
    description:
      "The Italian Linen Summer Suit from ORO PALAZZO is the definitive warm-weather tailoring piece, crafted from the finest Belgian linen woven in the historic mills of Lombardy. This unstructured two-piece suit features a half-lined jacket with patch pockets and a natural shoulder construction that drapes effortlessly in the summer heat. The accompanying flat-front trousers include a self-adjusting side tab waistband for all-day comfort without the need for a belt. The linen fabric has been enzyme-washed during production to minimize creasing while preserving the natural texture that linen aficionados cherish. An essential addition to the Mediterranean-inspired wardrobe.",
    slug: "lux-oro-italian-linen-summer-suit",
    brand: "ORO PALAZZO",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-oro-palazzo",
    categoryUrl: "lux-men",
    subCategoryUrl: "lux-men-suits",
    offerTagUrl: "lux-seasonal-sale",
    variants: [
      {
        variantName: "Natural Ecru",
        variantDescription:
          "Unstructured Belgian linen two-piece suit in natural ecru with enzyme-washed finish.",
        slug: "lux-oro-linen-suit-ecru",
        sku: "ORO-MS-001-ECR",
        weight: 1.4,
        isSale: true,
        keywords: [
          "linen suit",
          "summer suit",
          "Italian suit",
          "unstructured suit",
          "ecru suit",
          "men suit",
          "lightweight suit",
        ],
        colors: [{ name: "Natural Ecru" }],
        sizes: [
          { size: "46", quantity: 8, price: 2400, discount: 15 },
          { size: "48", quantity: 12, price: 2400, discount: 15 },
          { size: "50", quantity: 14, price: 2400, discount: 15 },
          { size: "52", quantity: 10, price: 2400, discount: 15 },
          { size: "54", quantity: 6, price: 2400, discount: 15 },
        ],
        images: [
          { url: img, alt: "Italian Linen Summer Suit Ecru - Full View" },
          { url: img, alt: "Italian Linen Summer Suit Ecru - Jacket Detail" },
          { url: img, alt: "Italian Linen Summer Suit Ecru - Fabric Texture" },
        ],
        specs: [
          { name: "Material", value: "100% Belgian Linen (enzyme-washed)" },
          { name: "Construction", value: "Unstructured, half-lined" },
          { name: "Origin", value: "Italy (Lombardy)" },
        ],
      },
      {
        variantName: "Coastal Blue",
        variantDescription:
          "Unstructured Belgian linen two-piece suit in soft coastal blue with natural shoulder.",
        slug: "lux-oro-linen-suit-blue",
        sku: "ORO-MS-001-BLU",
        weight: 1.4,
        isSale: false,
        keywords: [
          "linen suit",
          "blue suit",
          "summer suit",
          "Italian tailoring",
          "coastal blue",
          "men suit",
        ],
        colors: [{ name: "Coastal Blue" }],
        sizes: [
          { size: "48", quantity: 10, price: 2400, discount: 0 },
          { size: "50", quantity: 12, price: 2400, discount: 0 },
          { size: "52", quantity: 8, price: 2400, discount: 0 },
        ],
        images: [
          { url: img, alt: "Italian Linen Suit Coastal Blue - Full View" },
          { url: img, alt: "Italian Linen Suit Coastal Blue - Side View" },
          { url: img, alt: "Italian Linen Suit Coastal Blue - Pocket Detail" },
        ],
        specs: [
          { name: "Material", value: "100% Belgian Linen (enzyme-washed)" },
          { name: "Construction", value: "Unstructured, half-lined" },
          { name: "Origin", value: "Italy (Lombardy)" },
        ],
      },
    ],
    questions: [
      {
        question: "Will this linen suit wrinkle easily?",
        answer:
          "Our enzyme-washed linen is treated to significantly reduce wrinkling compared to traditional linen. Some natural creasing is characteristic of linen and adds to its relaxed luxury aesthetic.",
      },
      {
        question: "Is this suit appropriate for business settings?",
        answer:
          "Yes, the tailored construction and refined finish make it suitable for business casual and smart casual environments, particularly during warmer months. Pair with a crisp shirt and loafers for a polished look.",
      },
    ],
  },

  // ── 2. Hand Stitched Leather Loafers ──
  {
    name: "Hand Stitched Leather Loafers",
    description:
      "The Hand Stitched Leather Loafers from ORO PALAZZO are the pinnacle of Italian footwear craftsmanship. Each pair is constructed using the traditional Blake stitch method, where master cobblers hand-stitch the upper directly to the leather sole for a supremely flexible and lightweight feel. The uppers are cut from hand-selected Italian calfskin with a subtle hand-burnished finish that develops richer character over time. A hand-sewn apron front and penny strap detail reference classic American style through an Italian artisanal lens. The unlined interior allows the leather to breathe naturally, making these loafers ideal for sockless summer wear.",
    slug: "lux-oro-hand-stitched-leather-loafers",
    brand: "ORO PALAZZO",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-oro-palazzo",
    categoryUrl: "lux-shoes",
    subCategoryUrl: "lux-shoes-loafers",
    offerTagUrl: "lux-best-seller",
    variants: [
      {
        variantName: "Tobacco Brown",
        variantDescription:
          "Blake-stitched Italian calfskin penny loafers in tobacco brown with hand-burnished finish.",
        slug: "lux-oro-leather-loafers-tobacco",
        sku: "ORO-SL-002-TOB",
        weight: 0.7,
        isSale: false,
        keywords: [
          "leather loafers",
          "penny loafers",
          "Italian shoes",
          "hand stitched",
          "men loafers",
          "luxury shoes",
          "Blake stitch",
        ],
        colors: [{ name: "Tobacco Brown" }],
        sizes: [
          { size: "40", quantity: 8, price: 890, discount: 0 },
          { size: "41", quantity: 12, price: 890, discount: 0 },
          { size: "42", quantity: 14, price: 890, discount: 0 },
          { size: "43", quantity: 12, price: 890, discount: 0 },
          { size: "44", quantity: 8, price: 890, discount: 0 },
          { size: "45", quantity: 6, price: 890, discount: 0 },
        ],
        images: [
          { url: img, alt: "Hand Stitched Loafers Tobacco - Side View" },
          { url: img, alt: "Hand Stitched Loafers Tobacco - Top View" },
          { url: img, alt: "Hand Stitched Loafers Tobacco - Stitch Detail" },
        ],
        specs: [
          { name: "Material", value: "Hand-selected Italian Calfskin" },
          { name: "Construction", value: "Blake stitch, hand-sewn apron" },
          { name: "Origin", value: "Italy (Naples)" },
        ],
      },
    ],
    questions: [
      {
        question: "Can these loafers be worn without socks?",
        answer:
          "Absolutely. The unlined interior is designed for barefoot wear in warmer months. The natural leather breathes well and develops a comfortable patina with sockless use.",
      },
      {
        question: "How long does the break-in period take?",
        answer:
          "Due to the Blake stitch construction, these loafers are flexible from the first wear. Most clients report a fully personalized fit within 2-3 wears as the calfskin molds to the foot.",
      },
    ],
  },

  // ── 3. Automatic Chronograph Watch ──
  {
    name: "Automatic Chronograph Watch",
    description:
      "The Automatic Chronograph Watch from ORO PALAZZO is a horological masterpiece that combines Swiss precision engineering with Italian design sensibility. Powered by a self-winding mechanical movement with a 72-hour power reserve, this chronograph features three sub-dials for elapsed seconds, minutes, and hours, all protected beneath a scratch-resistant sapphire crystal with anti-reflective coating. The 42mm case is crafted from 316L surgical-grade stainless steel with a satin-brushed finish and polished chamfered edges. Water-resistant to 100 meters, this watch transitions seamlessly from boardroom to yacht deck with effortless sophistication and enduring mechanical reliability.",
    slug: "lux-oro-automatic-chronograph-watch",
    brand: "ORO PALAZZO",
    shippingFeeMethod: "FIXED",
    storeUrl: "lux-oro-palazzo",
    categoryUrl: "lux-watches",
    subCategoryUrl: "lux-watches-classic",
    offerTagUrl: "lux-exclusive",
    variants: [
      {
        variantName: "Steel with Blue Dial",
        variantDescription:
          "42mm stainless steel automatic chronograph with sunburst blue dial and steel bracelet.",
        slug: "lux-oro-chronograph-steel-blue",
        sku: "ORO-WC-003-BLU",
        weight: 0.18,
        isSale: false,
        keywords: [
          "automatic watch",
          "chronograph",
          "luxury watch",
          "steel watch",
          "blue dial",
          "Swiss movement",
          "men watch",
        ],
        colors: [{ name: "Steel / Blue Dial" }],
        sizes: [
          { size: "42mm", quantity: 8, price: 3200, discount: 0 },
        ],
        images: [
          { url: img, alt: "Automatic Chronograph Watch - Dial View" },
          { url: img, alt: "Automatic Chronograph Watch - Side Profile" },
          { url: img, alt: "Automatic Chronograph Watch - Caseback View" },
        ],
        specs: [
          { name: "Movement", value: "Swiss Automatic, 72-hour power reserve" },
          { name: "Case", value: "316L Stainless Steel, 42mm, 100m WR" },
          { name: "Crystal", value: "Sapphire with AR coating" },
        ],
      },
    ],
    questions: [
      {
        question: "Does this watch require a battery?",
        answer:
          "No, this is a self-winding automatic mechanical watch. It is powered by the natural motion of your wrist. If unworn for more than 72 hours, simply wind the crown clockwise 30-40 times to restart.",
      },
      {
        question: "Is the bracelet adjustable?",
        answer:
          "Yes, the steel bracelet includes removable links and a micro-adjustment clasp that allows fine-tuning in 5mm increments. We recommend visiting an authorized dealer for professional sizing.",
      },
    ],
  },

  // ── 4. Dress Watch with Leather Strap ──
  {
    name: "Dress Watch with Leather Strap",
    description:
      "The Dress Watch with Leather Strap is the epitome of refined horological elegance, designed for the gentleman who appreciates the understated power of simplicity. The ultra-thin 39mm rose gold case, measuring just 7.2mm in height, houses a Swiss quartz movement with exceptional accuracy. The minimalist ivory dial features slim dauphine hands, applied hour markers in matching rose gold, and a subtle date window at six o clock. The hand-stitched alligator leather strap in dark brown develops a lustrous patina with wear and is fitted with a deployment clasp that preserves the strap shape. This timepiece is an exercise in restrained luxury at its finest.",
    slug: "lux-oro-dress-watch-leather-strap",
    brand: "ORO PALAZZO",
    shippingFeeMethod: "FIXED",
    storeUrl: "lux-oro-palazzo",
    categoryUrl: "lux-watches",
    subCategoryUrl: "lux-watches-classic",
    variants: [
      {
        variantName: "Rose Gold with Ivory Dial",
        variantDescription:
          "Ultra-thin 39mm rose gold dress watch with ivory dial and alligator strap.",
        slug: "lux-oro-dress-watch-rosegold",
        sku: "ORO-WC-004-RGD",
        weight: 0.08,
        isSale: false,
        keywords: [
          "dress watch",
          "rose gold watch",
          "luxury watch",
          "thin watch",
          "leather strap watch",
          "classic watch",
        ],
        colors: [{ name: "Rose Gold / Ivory" }],
        sizes: [
          { size: "39mm", quantity: 10, price: 2800, discount: 0 },
        ],
        images: [
          { url: img, alt: "Dress Watch Rose Gold - Dial View" },
          { url: img, alt: "Dress Watch Rose Gold - Profile View" },
          { url: img, alt: "Dress Watch Rose Gold - Strap Detail" },
        ],
        specs: [
          { name: "Movement", value: "Swiss Quartz" },
          { name: "Case", value: "Rose Gold PVD on Steel, 39mm x 7.2mm" },
          { name: "Strap", value: "Hand-stitched Alligator Leather" },
        ],
      },
    ],
    questions: [
      {
        question: "How often does the battery need to be replaced?",
        answer:
          "The Swiss quartz movement has an expected battery life of approximately 3-4 years. We recommend having the battery replaced by an authorized service center to maintain the water resistance seal.",
      },
      {
        question: "Can I replace the alligator strap with a different one?",
        answer:
          "Yes, the strap uses standard 20mm lugs and can be easily swapped. We offer additional straps in various colors and materials through our accessories collection.",
      },
    ],
  },

  // ── 5. Silk Pocket Square Set ──
  {
    name: "Silk Pocket Square Set",
    description:
      "The Silk Pocket Square Set from ORO PALAZZO is the finishing touch that distinguishes the truly well-dressed gentleman. This curated collection of three pocket squares is crafted from the finest Como silk, each featuring a distinct hand-printed pattern inspired by classical Italian decorative motifs. The set includes a geometric medallion in navy, a paisley flourish in burgundy, and a micro-dot pattern in forest green, providing versatile options for any occasion or suit combination. Each square is hand-rolled at the edges by skilled artisans using the traditional rolled-hem technique that creates a beautifully rounded border. Presented in an elegant gift box with a folding guide booklet.",
    slug: "lux-oro-silk-pocket-square-set",
    brand: "ORO PALAZZO",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-oro-palazzo",
    categoryUrl: "lux-accessories",
    subCategoryUrl: "lux-acc-scarves",
    variants: [
      {
        variantName: "Classic Trio",
        variantDescription:
          "Set of three hand-printed Como silk pocket squares with hand-rolled edges in gift box.",
        slug: "lux-oro-pocket-square-set-classic",
        sku: "ORO-AS-005-CLS",
        weight: 0.1,
        isSale: false,
        keywords: [
          "pocket square",
          "silk pocket square",
          "men accessory",
          "Italian silk",
          "gift set",
          "luxury accessory",
        ],
        colors: [{ name: "Navy / Burgundy / Green" }],
        sizes: [
          { size: "33cm x 33cm", quantity: 20, price: 280, discount: 0 },
        ],
        images: [
          { url: img, alt: "Silk Pocket Square Set - All Three" },
          { url: img, alt: "Silk Pocket Square Set - Pattern Detail" },
          { url: img, alt: "Silk Pocket Square Set - Gift Box" },
        ],
        specs: [
          { name: "Material", value: "100% Como Silk (hand-printed)" },
          { name: "Finish", value: "Hand-rolled edges" },
          { name: "Origin", value: "Italy (Como)" },
        ],
      },
    ],
    questions: [
      {
        question: "Are these pocket squares machine washable?",
        answer:
          "We recommend dry cleaning to preserve the hand-printed patterns and hand-rolled edges. If needed, you can gently hand wash in cold water with a mild detergent and press while slightly damp.",
      },
      {
        question: "What size are the individual squares?",
        answer:
          "Each pocket square measures 33cm x 33cm, the ideal size for all classic pocket square folds including the presidential, puff, and multi-point styles detailed in the included folding guide.",
      },
    ],
  },

  // ── 6. Cashmere Blend Overcoat ──
  {
    name: "Cashmere Blend Overcoat",
    description:
      "The Cashmere Blend Overcoat from ORO PALAZZO is the definitive cold-weather statement piece for the discerning gentleman. Tailored from a luxurious blend of cashmere and virgin wool sourced from the finest Italian textile mills, this overcoat features a classic single-breasted silhouette with a notch lapel and three-button closure. The construction includes hand-stitched pick stitching along the lapel and pocket edges, a fully lined interior in silk satin, and a deep back vent for ease of movement. The generous length falls below the knee for maximum warmth and elegance. Horn buttons and a functional ticket pocket on the left front complete the sartorial details.",
    slug: "lux-oro-cashmere-blend-overcoat",
    brand: "ORO PALAZZO",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-oro-palazzo",
    categoryUrl: "lux-men",
    subCategoryUrl: "lux-men-outerwear",
    offerTagUrl: "lux-new-arrival",
    variants: [
      {
        variantName: "Camel",
        variantDescription:
          "Cashmere and virgin wool blend overcoat in classic camel with silk satin lining.",
        slug: "lux-oro-cashmere-overcoat-camel",
        sku: "ORO-MO-006-CML",
        weight: 2.0,
        isSale: false,
        keywords: [
          "cashmere overcoat",
          "men overcoat",
          "camel coat",
          "luxury coat",
          "Italian coat",
          "wool overcoat",
          "winter coat",
        ],
        colors: [{ name: "Camel" }],
        sizes: [
          { size: "46", quantity: 6, price: 2100, discount: 0 },
          { size: "48", quantity: 10, price: 2100, discount: 0 },
          { size: "50", quantity: 12, price: 2100, discount: 0 },
          { size: "52", quantity: 10, price: 2100, discount: 0 },
          { size: "54", quantity: 6, price: 2100, discount: 0 },
        ],
        images: [
          { url: img, alt: "Cashmere Blend Overcoat Camel - Front View" },
          { url: img, alt: "Cashmere Blend Overcoat Camel - Back View" },
          { url: img, alt: "Cashmere Blend Overcoat Camel - Lapel Detail" },
        ],
        specs: [
          { name: "Material", value: "80% Virgin Wool / 20% Cashmere" },
          { name: "Lining", value: "100% Silk Satin" },
          { name: "Origin", value: "Italy" },
        ],
      },
      {
        variantName: "Charcoal",
        variantDescription:
          "Cashmere and virgin wool blend overcoat in deep charcoal with pick stitch detailing.",
        slug: "lux-oro-cashmere-overcoat-charcoal",
        sku: "ORO-MO-006-CHR",
        weight: 2.0,
        isSale: true,
        keywords: [
          "cashmere overcoat",
          "charcoal coat",
          "luxury overcoat",
          "Italian overcoat",
          "winter coat",
          "men outerwear",
        ],
        colors: [{ name: "Charcoal" }],
        sizes: [
          { size: "48", quantity: 8, price: 2100, discount: 10 },
          { size: "50", quantity: 10, price: 2100, discount: 10 },
          { size: "52", quantity: 8, price: 2100, discount: 10 },
        ],
        images: [
          { url: img, alt: "Cashmere Blend Overcoat Charcoal - Front View" },
          { url: img, alt: "Cashmere Blend Overcoat Charcoal - Side View" },
          { url: img, alt: "Cashmere Blend Overcoat Charcoal - Button Detail" },
        ],
        specs: [
          { name: "Material", value: "80% Virgin Wool / 20% Cashmere" },
          { name: "Lining", value: "100% Silk Satin" },
          { name: "Origin", value: "Italy" },
        ],
      },
    ],
    questions: [
      {
        question: "Is this overcoat heavy to wear?",
        answer:
          "Despite its generous length, the cashmere-wool blend provides excellent warmth-to-weight ratio. The coat weighs approximately 2kg in size 50 and drapes comfortably without feeling bulky.",
      },
      {
        question: "What is the proper way to store this overcoat?",
        answer:
          "Store on a wide, padded hanger in a breathable garment bag. We recommend cedar blocks to naturally repel moths. Avoid wire hangers as they can distort the shoulder construction over time.",
      },
    ],
  },
];
