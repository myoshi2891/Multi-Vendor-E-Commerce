import type { SeedProduct } from "../../types";

const img = "/assets/images/no_image.png";

/** MAISON LUXE — オートクチュール・レディーツーウェア（6商品） */
export const STORE_PRODUCTS: SeedProduct[] = [
  // ── 1. Hand Draped Silk Gown ──
  {
    name: "Hand Draped Silk Gown",
    description:
      "The Hand Draped Silk Gown from MAISON LUXE is a masterpiece of couture craftsmanship, created through an elaborate process of hand-draping pure mulberry silk directly on the dress form. Each gown requires over forty hours of meticulous handwork by our Parisian atelier artisans, resulting in a truly one-of-a-kind silhouette that cascades beautifully from shoulder to floor. The asymmetric draping creates an organic sculptural quality, while the hidden boning structure provides support without compromising the ethereal fluidity of the design.",
    slug: "lux-maison-hand-draped-silk-gown",
    brand: "MAISON LUXE",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-maison-luxe",
    categoryUrl: "lux-women",
    subCategoryUrl: "lux-women-dresses",
    offerTagUrl: "lux-exclusive",
    variants: [
      {
        variantName: "Champagne Gold",
        variantDescription:
          "Hand-draped mulberry silk gown in luminous champagne gold with asymmetric draping.",
        slug: "lux-maison-silk-gown-champagne",
        sku: "MAIS-WD-001-CHP",
        weight: 0.8,
        isSale: false,
        keywords: [
          "silk gown",
          "couture dress",
          "hand draped",
          "evening gown",
          "champagne dress",
          "luxury gown",
          "formal dress",
        ],
        colors: [{ name: "Champagne Gold" }],
        sizes: [
          { size: "XS", quantity: 5, price: 3200, discount: 0 },
          { size: "S", quantity: 8, price: 3200, discount: 0 },
          { size: "M", quantity: 10, price: 3200, discount: 0 },
          { size: "L", quantity: 6, price: 3200, discount: 0 },
        ],
        images: [
          { url: img, alt: "Hand Draped Silk Gown - Front View" },
          { url: img, alt: "Hand Draped Silk Gown - Draping Detail" },
          { url: img, alt: "Hand Draped Silk Gown - Back View" },
        ],
        specs: [
          { name: "Material", value: "100% Mulberry Silk" },
          { name: "Origin", value: "France (Paris Atelier)" },
          { name: "Care", value: "Professional couture cleaning only" },
        ],
      },
    ],
    questions: [
      {
        question: "How long does it take to produce each gown?",
        answer:
          "Each Hand Draped Silk Gown requires approximately 40-50 hours of handwork by our skilled Parisian artisans, ensuring every piece is truly unique.",
      },
      {
        question: "Is custom sizing available for this gown?",
        answer:
          "Yes, we offer bespoke sizing for an additional fee. Please contact our atelier directly with your measurements for a personalized consultation.",
      },
    ],
  },

  // ── 2. Embroidered Tulle Blouse ──
  {
    name: "Embroidered Tulle Blouse",
    description:
      "Our Embroidered Tulle Blouse is a delicate expression of artistry and femininity. Crafted from fine French tulle with hand-applied floral embroidery using silk thread and micro-sequins, this blouse brings an enchanting dimension to any ensemble. The sheer fabric is lined with a silk camisole layer for modest coverage, while the bishop sleeves with elasticated cuffs add a romantic volume. The meticulous embroidery pattern draws inspiration from vintage Parisian botanical illustrations, making each blouse a wearable work of art.",
    slug: "lux-maison-embroidered-tulle-blouse",
    brand: "MAISON LUXE",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-maison-luxe",
    categoryUrl: "lux-women",
    subCategoryUrl: "lux-women-blouses",
    variants: [
      {
        variantName: "Blush Pink",
        variantDescription:
          "French tulle blouse in blush pink with hand-applied floral embroidery and silk lining.",
        slug: "lux-maison-tulle-blouse-blush",
        sku: "MAIS-WB-002-BLS",
        weight: 0.3,
        isSale: false,
        keywords: [
          "tulle blouse",
          "embroidered blouse",
          "luxury blouse",
          "pink blouse",
          "French tulle",
          "designer blouse",
        ],
        colors: [{ name: "Blush Pink" }],
        sizes: [
          { size: "XS", quantity: 8, price: 890, discount: 0 },
          { size: "S", quantity: 12, price: 890, discount: 0 },
          { size: "M", quantity: 14, price: 890, discount: 0 },
          { size: "L", quantity: 8, price: 890, discount: 0 },
        ],
        images: [
          { url: img, alt: "Embroidered Tulle Blouse - Front View" },
          { url: img, alt: "Embroidered Tulle Blouse - Embroidery Detail" },
          { url: img, alt: "Embroidered Tulle Blouse - Sleeve Detail" },
        ],
        specs: [
          { name: "Material", value: "French Tulle with Silk Thread Embroidery" },
          { name: "Lining", value: "100% Silk Camisole" },
          { name: "Care", value: "Dry clean only" },
        ],
      },
      {
        variantName: "Ivory White",
        variantDescription:
          "French tulle blouse in ivory white with tonal embroidery and micro-sequin accents.",
        slug: "lux-maison-tulle-blouse-ivory",
        sku: "MAIS-WB-002-IVR",
        weight: 0.3,
        isSale: true,
        keywords: [
          "tulle blouse",
          "embroidered blouse",
          "ivory blouse",
          "luxury top",
          "French tulle",
          "sequin blouse",
        ],
        colors: [{ name: "Ivory White" }],
        sizes: [
          { size: "S", quantity: 10, price: 890, discount: 12 },
          { size: "M", quantity: 12, price: 890, discount: 12 },
          { size: "L", quantity: 6, price: 890, discount: 12 },
        ],
        images: [
          { url: img, alt: "Embroidered Tulle Blouse Ivory - Front View" },
          { url: img, alt: "Embroidered Tulle Blouse Ivory - Back View" },
          { url: img, alt: "Embroidered Tulle Blouse Ivory - Sequin Detail" },
        ],
        specs: [
          { name: "Material", value: "French Tulle with Silk Thread Embroidery" },
          { name: "Lining", value: "100% Silk Camisole" },
          { name: "Care", value: "Dry clean only" },
        ],
      },
    ],
    questions: [
      {
        question: "Is the embroidery durable enough for regular wear?",
        answer:
          "Yes, the hand-applied embroidery is secured with reinforced stitching. However, we recommend dry cleaning to preserve the delicate sequin and thread work for years of enjoyment.",
      },
      {
        question: "Does the blouse come with the silk camisole attached?",
        answer:
          "The silk camisole is attached at the neckline and shoulders for easy wearing but can be detached if desired, offering versatile styling options.",
      },
    ],
  },

  // ── 3. Structured Tweed Jacket ──
  {
    name: "Structured Tweed Jacket",
    description:
      "Our Structured Tweed Jacket pays homage to the grand tradition of French couture tailoring. Woven from a bespoke boucle tweed blend featuring threads of metallic gold, this jacket combines timeless structure with contemporary sophistication. The collarless design features raw edges trimmed with contrast grosgrain ribbon, while the patch pockets add a touch of casual refinement. The interior is fully lined in silk with a chain weight at the hem ensuring the jacket hangs perfectly. Gold-toned lion head buttons complete this iconic piece that transcends seasons and trends.",
    slug: "lux-maison-structured-tweed-jacket",
    brand: "MAISON LUXE",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-maison-luxe",
    categoryUrl: "lux-women",
    subCategoryUrl: "lux-women-coats",
    offerTagUrl: "lux-best-seller",
    variants: [
      {
        variantName: "Navy and Gold",
        variantDescription:
          "Boucle tweed jacket in navy with metallic gold thread and lion head buttons.",
        slug: "lux-maison-tweed-jacket-navy",
        sku: "MAIS-WC-003-NVY",
        weight: 0.9,
        isSale: false,
        keywords: [
          "tweed jacket",
          "boucle jacket",
          "luxury jacket",
          "French jacket",
          "navy jacket",
          "designer jacket",
          "couture jacket",
        ],
        colors: [{ name: "Navy" }, { name: "Gold" }],
        sizes: [
          { size: "34", quantity: 6, price: 1650, discount: 0 },
          { size: "36", quantity: 10, price: 1650, discount: 0 },
          { size: "38", quantity: 12, price: 1650, discount: 0 },
          { size: "40", quantity: 10, price: 1650, discount: 0 },
          { size: "42", quantity: 6, price: 1650, discount: 0 },
        ],
        images: [
          { url: img, alt: "Structured Tweed Jacket - Front View" },
          { url: img, alt: "Structured Tweed Jacket - Button Detail" },
          { url: img, alt: "Structured Tweed Jacket - Fabric Texture" },
        ],
        specs: [
          { name: "Material", value: "Boucle Tweed (Wool/Cotton/Metallic blend)" },
          { name: "Lining", value: "100% Silk" },
          { name: "Origin", value: "France" },
        ],
      },
    ],
    questions: [
      {
        question: "Does the metallic thread make the jacket uncomfortable?",
        answer:
          "Not at all. The metallic thread is woven into the tweed blend and fully lined with silk, so you only feel the smooth silk against your skin. The chain hem weight also ensures comfortable drape.",
      },
      {
        question: "Can I wear this jacket casually?",
        answer:
          "Absolutely. This jacket pairs beautifully with jeans and a simple tee for a chic casual look, or with a pencil skirt for more formal occasions. Its versatility is one of its greatest strengths.",
      },
    ],
  },

  // ── 4. Crystal Embellished Clutch ──
  {
    name: "Crystal Embellished Clutch",
    description:
      "The Crystal Embellished Clutch from MAISON LUXE is an extraordinary evening accessory that commands attention with its intricate crystal work. Hundreds of hand-set Swarovski crystals are arranged in an Art Deco inspired geometric pattern across the Italian satin body, creating a mesmerizing play of light with every movement. The interior features a silk-lined compartment with a mirror and card slot, while the detachable gold chain allows the clutch to be worn as a shoulder bag. A hidden magnetic closure ensures your essentials remain secure throughout the evening.",
    slug: "lux-maison-crystal-embellished-clutch",
    brand: "MAISON LUXE",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-maison-luxe",
    categoryUrl: "lux-bags",
    subCategoryUrl: "lux-bags-clutches",
    offerTagUrl: "lux-limited-edition",
    variants: [
      {
        variantName: "Silver Crystal",
        variantDescription:
          "Italian satin clutch with hand-set Swarovski crystals in silver-toned Art Deco pattern.",
        slug: "lux-maison-crystal-clutch-silver",
        sku: "MAIS-BC-004-SLV",
        weight: 0.4,
        isSale: false,
        keywords: [
          "crystal clutch",
          "evening bag",
          "Swarovski clutch",
          "luxury clutch",
          "embellished bag",
          "designer clutch",
        ],
        colors: [{ name: "Silver" }],
        sizes: [
          { size: "One Size", quantity: 12, price: 1200, discount: 0 },
        ],
        images: [
          { url: img, alt: "Crystal Embellished Clutch - Front View" },
          { url: img, alt: "Crystal Embellished Clutch - Crystal Detail" },
          { url: img, alt: "Crystal Embellished Clutch - Interior View" },
        ],
        specs: [
          { name: "Material", value: "Italian Satin with Swarovski Crystals" },
          { name: "Hardware", value: "Gold-toned brass" },
          { name: "Dimensions", value: "22cm x 12cm x 5cm" },
        ],
      },
    ],
    questions: [
      {
        question: "Are the crystals securely attached?",
        answer:
          "Yes, each crystal is individually hand-set and secured with industrial-grade adhesive. We recommend avoiding harsh impact, but under normal use the crystals will remain firmly in place.",
      },
      {
        question: "Can this clutch fit a smartphone?",
        answer:
          "Yes, the clutch comfortably fits a standard smartphone, lipstick, compact mirror, and several cards. The interior dimensions are 20cm x 10cm x 4cm.",
      },
    ],
  },

  // ── 5. Leather Gloves with Gold Hardware ──
  {
    name: "Leather Gloves with Gold Hardware",
    description:
      "Our Leather Gloves with Gold Hardware combine function and fashion in the finest Italian leather tradition. Crafted from supple Nappa lambskin with a butter-soft interior lining of pure cashmere, these gloves offer unmatched warmth and dexterity. The signature gold-plated hardware details at the wrist include a small adjustable buckle and engraved MAISON LUXE logo clasp. The precision cut and hand-sewn seams ensure a glove-like fit that molds to the hand over time, creating a truly personalized accessory that only improves with wear.",
    slug: "lux-maison-leather-gloves-gold-hardware",
    brand: "MAISON LUXE",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-maison-luxe",
    categoryUrl: "lux-accessories",
    subCategoryUrl: "lux-acc-gloves",
    variants: [
      {
        variantName: "Black with Gold",
        variantDescription:
          "Nappa lambskin gloves in black with cashmere lining and gold-plated hardware.",
        slug: "lux-maison-leather-gloves-blk-gold",
        sku: "MAIS-AB-005-BLK",
        weight: 0.2,
        isSale: false,
        keywords: [
          "leather gloves",
          "lambskin gloves",
          "luxury gloves",
          "gold hardware",
          "winter gloves",
          "designer gloves",
        ],
        colors: [{ name: "Black" }],
        sizes: [
          { size: "S", quantity: 12, price: 420, discount: 0 },
          { size: "M", quantity: 15, price: 420, discount: 0 },
          { size: "L", quantity: 10, price: 420, discount: 0 },
        ],
        images: [
          { url: img, alt: "Leather Gloves with Gold Hardware - Pair View" },
          { url: img, alt: "Leather Gloves with Gold Hardware - Detail View" },
          { url: img, alt: "Leather Gloves with Gold Hardware - Buckle Detail" },
        ],
        specs: [
          { name: "Material", value: "Nappa Lambskin, Cashmere Lining" },
          { name: "Hardware", value: "Gold-plated brass" },
          { name: "Origin", value: "Italy" },
        ],
      },
    ],
    questions: [
      {
        question: "Are these gloves touchscreen compatible?",
        answer:
          "The current version is not touchscreen compatible, as the natural lambskin prioritizes the most luxurious feel and warmth. A touchscreen-compatible version is planned for a future release.",
      },
      {
        question: "How do I determine my glove size?",
        answer:
          "Measure around the widest part of your palm excluding the thumb. S fits 17-18cm, M fits 19-20cm, L fits 21-22cm. If between sizes, we recommend sizing up for comfort.",
      },
    ],
  },

  // ── 6. Pleated Chiffon Maxi Dress ──
  {
    name: "Pleated Chiffon Maxi Dress",
    description:
      "The Pleated Chiffon Maxi Dress from MAISON LUXE is a vision of floating elegance that embodies the romantic spirit of French haute couture. The dress features meticulously knife-pleated silk chiffon that flows from a structured bodice to a sweeping floor-length hem, creating a mesmerizing cascade of fabric with every step. A hand-embroidered waist sash cinches the silhouette while adding an artisanal touch of refinement. The layered construction includes a silk slip dress underneath for comfortable wear, and the concealed back zipper ensures a clean uninterrupted silhouette from every angle.",
    slug: "lux-maison-pleated-chiffon-maxi-dress",
    brand: "MAISON LUXE",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-maison-luxe",
    categoryUrl: "lux-women",
    subCategoryUrl: "lux-women-dresses",
    offerTagUrl: "lux-new-arrival",
    variants: [
      {
        variantName: "Dusty Rose",
        variantDescription:
          "Knife-pleated silk chiffon maxi dress in dusty rose with embroidered waist sash.",
        slug: "lux-maison-chiffon-maxi-dusty-rose",
        sku: "MAIS-WD-006-RSE",
        weight: 0.5,
        isSale: false,
        keywords: [
          "chiffon dress",
          "maxi dress",
          "pleated dress",
          "luxury dress",
          "rose dress",
          "formal dress",
          "silk chiffon",
        ],
        colors: [{ name: "Dusty Rose" }],
        sizes: [
          { size: "XS", quantity: 6, price: 2100, discount: 0 },
          { size: "S", quantity: 10, price: 2100, discount: 0 },
          { size: "M", quantity: 12, price: 2100, discount: 0 },
          { size: "L", quantity: 8, price: 2100, discount: 0 },
        ],
        images: [
          { url: img, alt: "Pleated Chiffon Maxi Dress - Front View" },
          { url: img, alt: "Pleated Chiffon Maxi Dress - Movement Shot" },
          { url: img, alt: "Pleated Chiffon Maxi Dress - Waist Sash Detail" },
        ],
        specs: [
          { name: "Material", value: "100% Silk Chiffon (outer), 100% Silk (slip)" },
          { name: "Origin", value: "France" },
          { name: "Care", value: "Professional dry clean only" },
        ],
      },
      {
        variantName: "Midnight Blue",
        variantDescription:
          "Knife-pleated silk chiffon maxi dress in midnight blue with gold-thread waist sash.",
        slug: "lux-maison-chiffon-maxi-midnight",
        sku: "MAIS-WD-006-MID",
        weight: 0.5,
        isSale: true,
        keywords: [
          "chiffon dress",
          "maxi dress",
          "blue dress",
          "luxury dress",
          "midnight blue",
          "evening dress",
          "silk chiffon",
        ],
        colors: [{ name: "Midnight Blue" }],
        sizes: [
          { size: "S", quantity: 8, price: 2100, discount: 15 },
          { size: "M", quantity: 10, price: 2100, discount: 15 },
          { size: "L", quantity: 6, price: 2100, discount: 15 },
        ],
        images: [
          { url: img, alt: "Pleated Chiffon Maxi Midnight Blue - Front View" },
          { url: img, alt: "Pleated Chiffon Maxi Midnight Blue - Back View" },
          { url: img, alt: "Pleated Chiffon Maxi Midnight Blue - Pleat Detail" },
        ],
        specs: [
          { name: "Material", value: "100% Silk Chiffon (outer), 100% Silk (slip)" },
          { name: "Origin", value: "France" },
          { name: "Care", value: "Professional dry clean only" },
        ],
      },
    ],
    questions: [
      {
        question: "Will the pleats hold their shape after cleaning?",
        answer:
          "Yes, the knife pleats are heat-set during production and will maintain their shape with proper professional dry cleaning. Avoid folding the dress for storage; use a padded hanger instead.",
      },
      {
        question: "Is the waist sash removable?",
        answer:
          "The waist sash is sewn on at the side seams but ties at the back, allowing you to adjust the fit. It cannot be fully removed, as it is integral to the design structure.",
      },
    ],
  },
];
