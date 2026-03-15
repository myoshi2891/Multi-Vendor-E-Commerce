import type { SeedProduct } from "../../types";

const img = "/assets/images/no_image.png";

/** NOIR ELEGANCE — 洗練されたモノトーンラグジュアリー（6商品） */
export const STORE_PRODUCTS: SeedProduct[] = [
  // ── 1. Cashmere Double Breasted Coat ──
  {
    name: "Cashmere Double Breasted Coat",
    description:
      "Indulge in the timeless sophistication of our Cashmere Double Breasted Coat, meticulously crafted from premium Mongolian cashmere. This exquisite outerwear piece features a classic double-breasted silhouette with hand-finished lapels and horn buttons, offering an effortlessly polished look for any occasion. The fully lined interior ensures warmth without bulk, while the tailored cut provides a flattering drape that moves gracefully with every step. Ideal for transitional seasons and formal winter events alike.",
    slug: "lux-noir-cashmere-double-breasted-coat",
    brand: "NOIR ELEGANCE",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-noir-elegance",
    categoryUrl: "lux-women",
    subCategoryUrl: "lux-women-coats",
    offerTagUrl: "lux-new-arrival",
    variants: [
      {
        variantName: "Classic Black",
        variantDescription:
          "Deep black cashmere double breasted coat with satin-lined interior.",
        slug: "lux-noir-cashmere-coat-black",
        sku: "NOIR-WC-001-BLK",
        weight: 1.8,
        isSale: false,
        keywords: [
          "cashmere coat",
          "double breasted",
          "luxury outerwear",
          "women coat",
          "black coat",
          "winter coat",
          "designer coat",
        ],
        colors: [{ name: "Black" }],
        sizes: [
          { size: "XS", quantity: 8, price: 2450, discount: 0 },
          { size: "S", quantity: 12, price: 2450, discount: 0 },
          { size: "M", quantity: 15, price: 2450, discount: 0 },
          { size: "L", quantity: 10, price: 2450, discount: 0 },
        ],
        images: [
          { url: img, alt: "Cashmere Double Breasted Coat - Front View" },
          { url: img, alt: "Cashmere Double Breasted Coat - Back View" },
          { url: img, alt: "Cashmere Double Breasted Coat - Detail" },
        ],
        specs: [
          { name: "Material", value: "100% Mongolian Cashmere" },
          { name: "Origin", value: "Italy" },
          { name: "Care", value: "Dry clean only" },
        ],
      },
      {
        variantName: "Charcoal Grey",
        variantDescription:
          "Sophisticated charcoal grey cashmere coat with a subtle heathered texture.",
        slug: "lux-noir-cashmere-coat-charcoal",
        sku: "NOIR-WC-001-CHR",
        weight: 1.8,
        isSale: false,
        keywords: [
          "cashmere coat",
          "charcoal grey",
          "luxury outerwear",
          "women coat",
          "grey coat",
          "designer coat",
          "winter coat",
        ],
        colors: [{ name: "Charcoal Grey" }],
        sizes: [
          { size: "S", quantity: 10, price: 2450, discount: 0 },
          { size: "M", quantity: 12, price: 2450, discount: 0 },
          { size: "L", quantity: 8, price: 2450, discount: 0 },
        ],
        images: [
          { url: img, alt: "Cashmere Coat Charcoal Grey - Front View" },
          { url: img, alt: "Cashmere Coat Charcoal Grey - Side View" },
          { url: img, alt: "Cashmere Coat Charcoal Grey - Button Detail" },
        ],
        specs: [
          { name: "Material", value: "100% Mongolian Cashmere" },
          { name: "Origin", value: "Italy" },
          { name: "Care", value: "Dry clean only" },
        ],
      },
    ],
    questions: [
      {
        question: "Is this coat suitable for extremely cold winters?",
        answer:
          "Yes, the premium Mongolian cashmere provides excellent insulation. For temperatures below -10C, we recommend layering with our Merino Wool Turtleneck for optimal warmth.",
      },
      {
        question: "How should I store this coat during warmer months?",
        answer:
          "We recommend storing it in the provided breathable garment bag with cedar blocks to protect against moths. Avoid plastic bags as they can trap moisture.",
      },
    ],
  },

  // ── 2. Silk Charmeuse Evening Dress ──
  {
    name: "Silk Charmeuse Evening Dress",
    description:
      "Our Silk Charmeuse Evening Dress is the embodiment of refined evening elegance. Cut from the finest Italian silk charmeuse, this floor-length gown features a graceful cowl neckline and a subtly draped back that captures the light beautifully with every movement. The bias-cut construction ensures a fluid silhouette that flatters every figure, while the concealed side zipper provides a seamless finish. Perfect for black-tie galas, exclusive dinners, and sophisticated soirees where making a lasting impression is essential.",
    slug: "lux-noir-silk-charmeuse-evening-dress",
    brand: "NOIR ELEGANCE",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-noir-elegance",
    categoryUrl: "lux-women",
    subCategoryUrl: "lux-women-dresses",
    offerTagUrl: "lux-exclusive",
    variants: [
      {
        variantName: "Midnight Black",
        variantDescription:
          "Floor-length silk charmeuse evening dress in midnight black with cowl neckline.",
        slug: "lux-noir-silk-evening-dress-black",
        sku: "NOIR-WD-002-BLK",
        weight: 0.6,
        isSale: false,
        keywords: [
          "silk dress",
          "evening gown",
          "black dress",
          "luxury dress",
          "charmeuse silk",
          "formal dress",
        ],
        colors: [{ name: "Midnight Black" }],
        sizes: [
          { size: "XS", quantity: 6, price: 1890, discount: 0 },
          { size: "S", quantity: 10, price: 1890, discount: 0 },
          { size: "M", quantity: 12, price: 1890, discount: 0 },
          { size: "L", quantity: 8, price: 1890, discount: 0 },
        ],
        images: [
          { url: img, alt: "Silk Charmeuse Evening Dress - Front View" },
          { url: img, alt: "Silk Charmeuse Evening Dress - Back View" },
          { url: img, alt: "Silk Charmeuse Evening Dress - Fabric Detail" },
        ],
        specs: [
          { name: "Material", value: "100% Italian Silk Charmeuse" },
          { name: "Origin", value: "France" },
          { name: "Care", value: "Professional dry clean only" },
        ],
      },
    ],
    questions: [
      {
        question: "Can this dress be altered for a custom fit?",
        answer:
          "Yes, we recommend having the dress altered by a professional tailor experienced with silk fabrics. The generous seam allowances allow for adjustments to length and bodice fit.",
      },
      {
        question: "What undergarments do you recommend with this dress?",
        answer:
          "Due to the fluid nature of silk charmeuse, we recommend seamless undergarments in a nude shade matching your skin tone. A built-in bra shelf provides additional support.",
      },
    ],
  },

  // ── 3. Italian Wool Tailored Suit ──
  {
    name: "Italian Wool Tailored Suit",
    description:
      "Elevate your formal wardrobe with our Italian Wool Tailored Suit, constructed from Super 150s merino wool sourced from the finest Italian mills. This impeccably tailored two-piece suit features a half-canvas construction for a natural drape, hand-sewn buttonholes, and a fully lined interior with contrast piping. The single-breasted jacket offers a modern slim fit while the flat-front trousers include a comfort waistband and hemmed finish. Designed for the discerning gentleman who demands nothing less than sartorial perfection.",
    slug: "lux-noir-italian-wool-tailored-suit",
    brand: "NOIR ELEGANCE",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-noir-elegance",
    categoryUrl: "lux-men",
    subCategoryUrl: "lux-men-suits",
    variants: [
      {
        variantName: "Jet Black",
        variantDescription:
          "Two-piece Italian wool suit in jet black with half-canvas construction.",
        slug: "lux-noir-wool-suit-black",
        sku: "NOIR-MS-003-BLK",
        weight: 2.2,
        isSale: false,
        keywords: [
          "wool suit",
          "Italian suit",
          "tailored suit",
          "men suit",
          "black suit",
          "formal suit",
          "Super 150s",
        ],
        colors: [{ name: "Jet Black" }],
        sizes: [
          { size: "46", quantity: 8, price: 2800, discount: 0 },
          { size: "48", quantity: 12, price: 2800, discount: 0 },
          { size: "50", quantity: 15, price: 2800, discount: 0 },
          { size: "52", quantity: 10, price: 2800, discount: 0 },
          { size: "54", quantity: 6, price: 2800, discount: 0 },
        ],
        images: [
          { url: img, alt: "Italian Wool Tailored Suit - Full View" },
          { url: img, alt: "Italian Wool Tailored Suit - Jacket Detail" },
          { url: img, alt: "Italian Wool Tailored Suit - Fabric Texture" },
        ],
        specs: [
          { name: "Material", value: "Super 150s Merino Wool" },
          { name: "Construction", value: "Half-canvas, hand-sewn buttonholes" },
          { name: "Origin", value: "Italy" },
        ],
      },
      {
        variantName: "Anthracite",
        variantDescription:
          "Two-piece Italian wool suit in deep anthracite with subtle pinstripe detailing.",
        slug: "lux-noir-wool-suit-anthracite",
        sku: "NOIR-MS-003-ANT",
        weight: 2.2,
        isSale: true,
        keywords: [
          "wool suit",
          "anthracite suit",
          "pinstripe suit",
          "men suit",
          "Italian tailoring",
          "designer suit",
        ],
        colors: [{ name: "Anthracite" }],
        sizes: [
          { size: "48", quantity: 10, price: 2800, discount: 10 },
          { size: "50", quantity: 12, price: 2800, discount: 10 },
          { size: "52", quantity: 8, price: 2800, discount: 10 },
        ],
        images: [
          { url: img, alt: "Italian Wool Suit Anthracite - Front View" },
          { url: img, alt: "Italian Wool Suit Anthracite - Back View" },
          { url: img, alt: "Italian Wool Suit Anthracite - Pinstripe Detail" },
        ],
        specs: [
          { name: "Material", value: "Super 150s Merino Wool" },
          { name: "Construction", value: "Half-canvas, hand-sewn buttonholes" },
          { name: "Origin", value: "Italy" },
        ],
      },
    ],
    questions: [
      {
        question: "Does this suit come with trousers?",
        answer:
          "Yes, this is a complete two-piece suit including a single-breasted jacket and flat-front trousers. Both pieces are size-matched for a cohesive fit.",
      },
      {
        question: "Can I order the jacket and trousers in different sizes?",
        answer:
          "We offer size separation upon request. Please contact our customer service team to arrange a split-size order at no additional charge.",
      },
    ],
  },

  // ── 4. Merino Wool Turtleneck Sweater ──
  {
    name: "Merino Wool Turtleneck Sweater",
    description:
      "Wrap yourself in the unparalleled softness of our Merino Wool Turtleneck Sweater, knitted from extra-fine 18.5 micron merino wool sourced from Australian highlands. This versatile layering piece features a ribbed turtleneck collar, reinforced shoulder seams, and a relaxed yet refined fit that transitions seamlessly from weekend leisure to weekday sophistication. The naturally breathable merino fiber regulates temperature throughout the day, making it an indispensable addition to any luxury wardrobe regardless of season.",
    slug: "lux-noir-merino-turtleneck-sweater",
    brand: "NOIR ELEGANCE",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-noir-elegance",
    categoryUrl: "lux-men",
    subCategoryUrl: "lux-men-outerwear",
    variants: [
      {
        variantName: "Obsidian Black",
        variantDescription:
          "Extra-fine merino wool turtleneck in deep obsidian black with ribbed detailing.",
        slug: "lux-noir-merino-turtleneck-black",
        sku: "NOIR-MO-004-BLK",
        weight: 0.5,
        isSale: false,
        keywords: [
          "merino wool",
          "turtleneck",
          "men sweater",
          "luxury knitwear",
          "black sweater",
          "wool sweater",
        ],
        colors: [{ name: "Obsidian Black" }],
        sizes: [
          { size: "S", quantity: 15, price: 680, discount: 0 },
          { size: "M", quantity: 20, price: 680, discount: 0 },
          { size: "L", quantity: 18, price: 680, discount: 0 },
          { size: "XL", quantity: 10, price: 680, discount: 0 },
        ],
        images: [
          { url: img, alt: "Merino Wool Turtleneck - Front View" },
          { url: img, alt: "Merino Wool Turtleneck - Side View" },
          { url: img, alt: "Merino Wool Turtleneck - Collar Detail" },
        ],
        specs: [
          { name: "Material", value: "100% Extra-Fine Merino Wool (18.5 micron)" },
          { name: "Origin", value: "Scotland" },
          { name: "Care", value: "Hand wash cold or dry clean" },
        ],
      },
    ],
    questions: [
      {
        question: "Is this sweater prone to pilling?",
        answer:
          "Our extra-fine merino wool is specially treated to resist pilling. We recommend gentle hand washing and laying flat to dry for the best longevity.",
      },
      {
        question: "Can I wear this as a standalone piece or is it meant for layering?",
        answer:
          "This turtleneck is designed to work beautifully both as a standalone piece and as a layering garment under blazers or coats. Its refined gauge knit keeps the profile sleek.",
      },
    ],
  },

  // ── 5. Satin Midi Skirt ──
  {
    name: "Satin Midi Skirt",
    description:
      "Our Satin Midi Skirt combines understated luxury with effortless wearability. Crafted from heavyweight duchess satin with a subtle sheen, this midi-length skirt features an invisible side zipper, a smooth waistband with grosgrain ribbon lining for comfort, and a graceful bias cut that creates beautiful movement as you walk. The carefully calibrated length falls just below the knee, making it appropriate for both professional and social settings. Pair with a tucked blouse for daytime elegance or a delicate camisole for evening allure.",
    slug: "lux-noir-satin-midi-skirt",
    brand: "NOIR ELEGANCE",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-noir-elegance",
    categoryUrl: "lux-women",
    subCategoryUrl: "lux-women-skirts",
    variants: [
      {
        variantName: "Ivory",
        variantDescription:
          "Heavyweight duchess satin midi skirt in soft ivory with bias-cut drape.",
        slug: "lux-noir-satin-midi-skirt-ivory",
        sku: "NOIR-WS-005-IVR",
        weight: 0.4,
        isSale: true,
        keywords: [
          "satin skirt",
          "midi skirt",
          "ivory skirt",
          "luxury skirt",
          "women skirt",
          "duchess satin",
        ],
        colors: [{ name: "Ivory" }],
        sizes: [
          { size: "XS", quantity: 10, price: 520, discount: 15 },
          { size: "S", quantity: 15, price: 520, discount: 15 },
          { size: "M", quantity: 12, price: 520, discount: 15 },
          { size: "L", quantity: 8, price: 520, discount: 15 },
        ],
        images: [
          { url: img, alt: "Satin Midi Skirt Ivory - Front View" },
          { url: img, alt: "Satin Midi Skirt Ivory - Movement Shot" },
          { url: img, alt: "Satin Midi Skirt Ivory - Fabric Detail" },
        ],
        specs: [
          { name: "Material", value: "Heavyweight Duchess Satin (Polyester/Silk blend)" },
          { name: "Origin", value: "France" },
          { name: "Care", value: "Dry clean recommended" },
        ],
      },
      {
        variantName: "Jet Black",
        variantDescription:
          "Classic jet black heavyweight duchess satin midi skirt with invisible zip.",
        slug: "lux-noir-satin-midi-skirt-black",
        sku: "NOIR-WS-005-BLK",
        weight: 0.4,
        isSale: false,
        keywords: [
          "satin skirt",
          "midi skirt",
          "black skirt",
          "luxury skirt",
          "women skirt",
          "duchess satin",
        ],
        colors: [{ name: "Jet Black" }],
        sizes: [
          { size: "XS", quantity: 10, price: 520, discount: 0 },
          { size: "S", quantity: 14, price: 520, discount: 0 },
          { size: "M", quantity: 16, price: 520, discount: 0 },
          { size: "L", quantity: 10, price: 520, discount: 0 },
        ],
        images: [
          { url: img, alt: "Satin Midi Skirt Black - Front View" },
          { url: img, alt: "Satin Midi Skirt Black - Side View" },
          { url: img, alt: "Satin Midi Skirt Black - Waistband Detail" },
        ],
        specs: [
          { name: "Material", value: "Heavyweight Duchess Satin (Polyester/Silk blend)" },
          { name: "Origin", value: "France" },
          { name: "Care", value: "Dry clean recommended" },
        ],
      },
    ],
    questions: [
      {
        question: "Is this skirt see-through?",
        answer:
          "No, our heavyweight duchess satin is fully opaque. The fabric has substantial body that prevents any transparency while maintaining a beautiful drape.",
      },
      {
        question: "What tops pair best with this skirt?",
        answer:
          "For a polished look, pair with our Silk Charmeuse blouse or a cashmere knit tucked in. For evening, a structured corset top or delicate camisole creates a stunning ensemble.",
      },
    ],
  },

  // ── 6. Cashmere Blend Scarf ──
  {
    name: "Cashmere Blend Scarf",
    description:
      "Complete your look with our Cashmere Blend Scarf, a luxurious accessory woven from a sumptuous blend of fine cashmere and mulberry silk. The generous dimensions allow for multiple styling options, from a classic drape over the shoulders to an elegantly knotted neck wrap. Finished with delicate hand-rolled edges and subtle tonal monogram detailing, this scarf represents the perfect balance of warmth and sophistication. Each piece is individually inspected by our quality artisans to ensure the highest standard of craftsmanship and material integrity.",
    slug: "lux-noir-cashmere-blend-scarf",
    brand: "NOIR ELEGANCE",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-noir-elegance",
    categoryUrl: "lux-accessories",
    subCategoryUrl: "lux-acc-scarves",
    offerTagUrl: "lux-best-seller",
    variants: [
      {
        variantName: "Classic Black",
        variantDescription:
          "Cashmere and silk blend scarf in classic black with tonal monogram detailing.",
        slug: "lux-noir-cashmere-scarf-black",
        sku: "NOIR-AS-006-BLK",
        weight: 0.2,
        isSale: false,
        keywords: [
          "cashmere scarf",
          "luxury scarf",
          "silk blend scarf",
          "black scarf",
          "designer scarf",
          "winter accessory",
        ],
        colors: [{ name: "Black" }],
        sizes: [
          { size: "One Size", quantity: 20, price: 340, discount: 0 },
        ],
        images: [
          { url: img, alt: "Cashmere Blend Scarf Black - Folded View" },
          { url: img, alt: "Cashmere Blend Scarf Black - Draped View" },
          { url: img, alt: "Cashmere Blend Scarf Black - Monogram Detail" },
        ],
        specs: [
          { name: "Material", value: "70% Cashmere / 30% Mulberry Silk" },
          { name: "Dimensions", value: "200cm x 70cm" },
          { name: "Care", value: "Dry clean only" },
        ],
      },
    ],
    questions: [
      {
        question: "Does this scarf come in a gift box?",
        answer:
          "Yes, each scarf is beautifully presented in a signature NOIR ELEGANCE gift box with tissue paper and a care card, making it an ideal gift.",
      },
      {
        question: "Will the scarf shed or pill over time?",
        answer:
          "The silk blend provides additional strength and reduces pilling. With proper care, this scarf will maintain its luxurious texture for years to come.",
      },
    ],
  },
];
