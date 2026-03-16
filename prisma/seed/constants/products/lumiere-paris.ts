import type { SeedProduct } from "../../types";

const img = "/assets/images/no_image.png";

/** LUMIERE PARIS — パリジェンヌシック（6商品） */
export const STORE_PRODUCTS: SeedProduct[] = [
  // ── 1. Boucle Cropped Jacket ──
  {
    name: "Boucle Cropped Jacket",
    description:
      "The Boucle Cropped Jacket from LUMIERE PARIS captures the effortless chic that defines Parisian street style. Woven from a textured boucle fabric blending Italian wool with touches of lurex for a subtle shimmer, this cropped silhouette sits perfectly at the waist to create a flattering proportion with high-waisted trousers or skirts. The jacket features raw-edge seaming that gives a deconstructed modern feel, while the structure is maintained through careful tailoring with French seams throughout. Jeweled buttons inspired by vintage Parisian flea market finds add a whimsical touch of personality. Fully lined in cotton voile for comfortable all-season layering.",
    slug: "lux-lumiere-boucle-cropped-jacket",
    brand: "LUMIERE PARIS",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-lumiere-paris",
    categoryUrl: "lux-women",
    subCategoryUrl: "lux-women-coats",
    offerTagUrl: "lux-new-arrival",
    variants: [
      {
        variantName: "Powder Pink",
        variantDescription:
          "Boucle cropped jacket in powder pink with lurex shimmer and jeweled buttons.",
        slug: "lux-lumiere-boucle-jacket-pink",
        sku: "LUMI-WC-001-PNK",
        weight: 0.6,
        isSale: false,
        keywords: [
          "boucle jacket",
          "cropped jacket",
          "pink jacket",
          "Parisian jacket",
          "luxury jacket",
          "women jacket",
          "tweed jacket",
        ],
        colors: [{ name: "Powder Pink" }],
        sizes: [
          { size: "34", quantity: 8, price: 1450, discount: 0 },
          { size: "36", quantity: 12, price: 1450, discount: 0 },
          { size: "38", quantity: 14, price: 1450, discount: 0 },
          { size: "40", quantity: 10, price: 1450, discount: 0 },
          { size: "42", quantity: 6, price: 1450, discount: 0 },
        ],
        images: [
          { url: img, alt: "Boucle Cropped Jacket Pink - Front View" },
          { url: img, alt: "Boucle Cropped Jacket Pink - Button Detail" },
          { url: img, alt: "Boucle Cropped Jacket Pink - Texture Detail" },
        ],
        specs: [
          { name: "Material", value: "Wool/Lurex Boucle Blend" },
          { name: "Lining", value: "100% Cotton Voile" },
          { name: "Origin", value: "France" },
        ],
      },
      {
        variantName: "Classic Ivory",
        variantDescription:
          "Boucle cropped jacket in classic ivory with gold lurex thread and vintage-inspired buttons.",
        slug: "lux-lumiere-boucle-jacket-ivory",
        sku: "LUMI-WC-001-IVR",
        weight: 0.6,
        isSale: true,
        keywords: [
          "boucle jacket",
          "ivory jacket",
          "cropped jacket",
          "Parisian style",
          "luxury outerwear",
          "designer jacket",
        ],
        colors: [{ name: "Ivory" }],
        sizes: [
          { size: "36", quantity: 10, price: 1450, discount: 10 },
          { size: "38", quantity: 12, price: 1450, discount: 10 },
          { size: "40", quantity: 8, price: 1450, discount: 10 },
        ],
        images: [
          { url: img, alt: "Boucle Cropped Jacket Ivory - Front View" },
          { url: img, alt: "Boucle Cropped Jacket Ivory - Side View" },
          { url: img, alt: "Boucle Cropped Jacket Ivory - Seam Detail" },
        ],
        specs: [
          { name: "Material", value: "Wool/Lurex Boucle Blend" },
          { name: "Lining", value: "100% Cotton Voile" },
          { name: "Origin", value: "France" },
        ],
      },
    ],
    questions: [
      {
        question: "Does the lurex thread make this jacket sparkle too much for daytime?",
        answer:
          "The lurex is very subtle and adds just a gentle shimmer rather than obvious sparkle. It catches light beautifully in both daylight and evening settings, making this jacket truly versatile.",
      },
      {
        question: "How cropped is this jacket?",
        answer:
          "The jacket falls at the natural waist, approximately 45-48cm in length depending on size. It pairs perfectly with high-waisted trousers or midi skirts for a balanced silhouette.",
      },
    ],
  },

  // ── 2. Silk Camisole Top ──
  {
    name: "Silk Camisole Top",
    description:
      "The Silk Camisole Top from LUMIERE PARIS is an essential foundation piece that elevates everyday dressing with quiet luxury. Cut from washed silk crepe de chine with a naturally soft hand feel, this camisole features a flattering V-neckline with delicate lace trim handmade by artisans in Calais, Frances historic lace-making region. Adjustable spaghetti straps allow for personalized fit, while the relaxed yet refined cut skims the body without clinging. The bias-cut front panel creates a subtle drape that moves gracefully with the body. This camisole works beautifully alone with tailored trousers, layered under blazers, or as an elegant base for evening ensembles.",
    slug: "lux-lumiere-silk-camisole-top",
    brand: "LUMIERE PARIS",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-lumiere-paris",
    categoryUrl: "lux-women",
    subCategoryUrl: "lux-women-blouses",
    variants: [
      {
        variantName: "Champagne",
        variantDescription:
          "Washed silk crepe de chine camisole in champagne with Calais lace trim.",
        slug: "lux-lumiere-silk-camisole-champagne",
        sku: "LUMI-WB-002-CHP",
        weight: 0.15,
        isSale: false,
        keywords: [
          "silk camisole",
          "luxury top",
          "camisole top",
          "champagne silk",
          "lace trim top",
          "French fashion",
        ],
        colors: [{ name: "Champagne" }],
        sizes: [
          { size: "XS", quantity: 12, price: 520, discount: 0 },
          { size: "S", quantity: 18, price: 520, discount: 0 },
          { size: "M", quantity: 20, price: 520, discount: 0 },
          { size: "L", quantity: 14, price: 520, discount: 0 },
        ],
        images: [
          { url: img, alt: "Silk Camisole Top Champagne - Front View" },
          { url: img, alt: "Silk Camisole Top Champagne - Lace Detail" },
          { url: img, alt: "Silk Camisole Top Champagne - Strap Detail" },
        ],
        specs: [
          { name: "Material", value: "100% Silk Crepe de Chine (washed)" },
          { name: "Trim", value: "Calais Lace (Cotton/Silk blend)" },
          { name: "Origin", value: "France" },
        ],
      },
      {
        variantName: "Noir",
        variantDescription:
          "Washed silk crepe de chine camisole in noir with contrast Calais lace trim.",
        slug: "lux-lumiere-silk-camisole-noir",
        sku: "LUMI-WB-002-NOR",
        weight: 0.15,
        isSale: false,
        keywords: [
          "silk camisole",
          "black camisole",
          "luxury lingerie",
          "French silk top",
          "lace camisole",
          "designer top",
        ],
        colors: [{ name: "Noir" }],
        sizes: [
          { size: "XS", quantity: 10, price: 520, discount: 0 },
          { size: "S", quantity: 16, price: 520, discount: 0 },
          { size: "M", quantity: 18, price: 520, discount: 0 },
          { size: "L", quantity: 12, price: 520, discount: 0 },
        ],
        images: [
          { url: img, alt: "Silk Camisole Top Noir - Front View" },
          { url: img, alt: "Silk Camisole Top Noir - Back View" },
          { url: img, alt: "Silk Camisole Top Noir - Fabric Detail" },
        ],
        specs: [
          { name: "Material", value: "100% Silk Crepe de Chine (washed)" },
          { name: "Trim", value: "Calais Lace (Cotton/Silk blend)" },
          { name: "Origin", value: "France" },
        ],
      },
    ],
    questions: [
      {
        question: "What is washed silk and how does it differ from regular silk?",
        answer:
          "Washed silk has undergone a special garment-washing process that softens the fabric and gives it a relaxed, lived-in texture. It is more forgiving than traditional silk and easier to care for at home.",
      },
      {
        question: "Can this camisole be worn as outerwear?",
        answer:
          "Absolutely. The silk crepe de chine has enough opacity and structure to be worn confidently on its own. The lace trim adds an elegant detail that makes it appropriate for both casual and dressy occasions.",
      },
    ],
  },

  // ── 3. High Waisted Palazzo Trousers ──
  {
    name: "High Waisted Palazzo Trousers",
    description:
      "The High Waisted Palazzo Trousers from LUMIERE PARIS redefine power dressing with an architectural silhouette that commands attention. Tailored from fluid Italian crepe with a slight stretch for comfortable movement, these wide-leg trousers feature a dramatically high waist that elongates the figure and creates a striking proportion. The front pleats flow into generous wide legs that puddle slightly at the ankle for a runway-worthy effect. A concealed side zipper with hook-and-bar closure ensures a clean front line, while the front and back welt pockets add subtle functional detail without interrupting the smooth drape of the fabric.",
    slug: "lux-lumiere-high-waisted-palazzo-trousers",
    brand: "LUMIERE PARIS",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-lumiere-paris",
    categoryUrl: "lux-women",
    subCategoryUrl: "lux-women-trousers",
    variants: [
      {
        variantName: "Classic Black",
        variantDescription:
          "Italian crepe high-waisted palazzo trousers in classic black with front pleats.",
        slug: "lux-lumiere-palazzo-trousers-black",
        sku: "LUMI-WS-003-BLK",
        weight: 0.5,
        isSale: false,
        keywords: [
          "palazzo trousers",
          "wide leg pants",
          "high waisted",
          "luxury trousers",
          "black trousers",
          "designer pants",
          "French fashion",
        ],
        colors: [{ name: "Black" }],
        sizes: [
          { size: "34", quantity: 8, price: 780, discount: 0 },
          { size: "36", quantity: 12, price: 780, discount: 0 },
          { size: "38", quantity: 16, price: 780, discount: 0 },
          { size: "40", quantity: 12, price: 780, discount: 0 },
          { size: "42", quantity: 8, price: 780, discount: 0 },
        ],
        images: [
          { url: img, alt: "High Waisted Palazzo Trousers - Front View" },
          { url: img, alt: "High Waisted Palazzo Trousers - Side View" },
          { url: img, alt: "High Waisted Palazzo Trousers - Pleat Detail" },
        ],
        specs: [
          { name: "Material", value: "Italian Crepe (95% Polyester / 5% Elastane)" },
          { name: "Rise", value: "High rise (32cm)" },
          { name: "Origin", value: "France" },
        ],
      },
    ],
    questions: [
      {
        question: "What heel height do you recommend with these trousers?",
        answer:
          "We recommend heels of 80-100mm to achieve the ideal length where the trouser hem just touches the floor. For a more casual look, they also work beautifully with pointed-toe flats at a slightly tailored length.",
      },
      {
        question: "Do these trousers wrinkle easily?",
        answer:
          "The Italian crepe fabric is naturally wrinkle-resistant due to its polyester base with elastane. Simply hang after wearing and any minor creases will fall out naturally overnight.",
      },
    ],
  },

  // ── 4. Vintage Inspired Sunglasses ──
  {
    name: "Vintage Inspired Sunglasses",
    description:
      "The Vintage Inspired Sunglasses from LUMIERE PARIS pay homage to the golden age of French cinema with a contemporary twist that appeals to the modern sophisticate. The oversized cat-eye frame is handcrafted from premium Italian acetate in a multi-layered construction that reveals different tonal depths as light passes through. Fitted with polarized Carl Zeiss lenses providing 100 percent UV protection, these sunglasses deliver both optical excellence and aesthetic distinction. The temple arms feature the signature LUMIERE star motif in gold-plated metal, while spring hinges ensure a comfortable universal fit. Each pair arrives in a leather hard case with a microfiber cleaning cloth.",
    slug: "lux-lumiere-vintage-inspired-sunglasses",
    brand: "LUMIERE PARIS",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-lumiere-paris",
    categoryUrl: "lux-accessories",
    subCategoryUrl: "lux-acc-sunglasses",
    offerTagUrl: "lux-best-seller",
    variants: [
      {
        variantName: "Tortoiseshell",
        variantDescription:
          "Oversized cat-eye sunglasses in Italian acetate tortoiseshell with polarized Zeiss lenses.",
        slug: "lux-lumiere-sunglasses-tortoiseshell",
        sku: "LUMI-AG-004-TRT",
        weight: 0.04,
        isSale: false,
        keywords: [
          "sunglasses",
          "cat eye sunglasses",
          "vintage sunglasses",
          "luxury eyewear",
          "tortoiseshell",
          "designer sunglasses",
        ],
        colors: [{ name: "Tortoiseshell" }],
        sizes: [
          { size: "One Size", quantity: 18, price: 450, discount: 0 },
        ],
        images: [
          { url: img, alt: "Vintage Inspired Sunglasses Tortoiseshell - Front View" },
          { url: img, alt: "Vintage Inspired Sunglasses Tortoiseshell - Side View" },
          { url: img, alt: "Vintage Inspired Sunglasses Tortoiseshell - Temple Detail" },
        ],
        specs: [
          { name: "Frame", value: "Italian Acetate (handcrafted)" },
          { name: "Lenses", value: "Polarized Carl Zeiss, 100% UV Protection" },
          { name: "Origin", value: "Italy (frames), Germany (lenses)" },
        ],
      },
      {
        variantName: "Jet Black",
        variantDescription:
          "Oversized cat-eye sunglasses in jet black Italian acetate with smoke gradient lenses.",
        slug: "lux-lumiere-sunglasses-black",
        sku: "LUMI-AG-004-BLK",
        weight: 0.04,
        isSale: false,
        keywords: [
          "sunglasses",
          "black sunglasses",
          "cat eye sunglasses",
          "luxury eyewear",
          "designer sunglasses",
          "French eyewear",
        ],
        colors: [{ name: "Jet Black" }],
        sizes: [
          { size: "One Size", quantity: 15, price: 450, discount: 0 },
        ],
        images: [
          { url: img, alt: "Vintage Inspired Sunglasses Black - Front View" },
          { url: img, alt: "Vintage Inspired Sunglasses Black - Angled View" },
          { url: img, alt: "Vintage Inspired Sunglasses Black - Star Motif Detail" },
        ],
        specs: [
          { name: "Frame", value: "Italian Acetate (handcrafted)" },
          { name: "Lenses", value: "Polarized Carl Zeiss, Smoke Gradient" },
          { name: "Origin", value: "Italy (frames), Germany (lenses)" },
        ],
      },
    ],
    questions: [
      {
        question: "Are prescription lenses available for these frames?",
        answer:
          "Yes, we offer a prescription lens service through our optical partners. Contact our customer service with your prescription details and we will arrange custom lenses fitted to your chosen frames.",
      },
      {
        question: "How do I clean the polarized lenses without damaging them?",
        answer:
          "Use only the provided microfiber cloth or lukewarm water with mild soap. Avoid paper towels, clothing, or harsh chemical cleaners, as these can scratch the polarized coating.",
      },
    ],
  },

  // ── 5. Monogrammed Canvas Tote ──
  {
    name: "Monogrammed Canvas Tote",
    description:
      "The Monogrammed Canvas Tote from LUMIERE PARIS is a masterful blend of practicality and Parisian elegance. The body is constructed from heavyweight cotton canvas printed with the signature LUMIERE monogram pattern, treated with a protective coating that resists water and staining while maintaining the natural canvas texture. Leather reinforcements at the base, corners, and handles ensure structural longevity, while the natural vegetable-tanned cowhide develops a beautiful honey patina with age and use. The spacious interior features a removable zippered pouch in matching canvas, a padded pocket for electronics, and an open compartment for daily essentials. Solid brass feet protect the base from surface wear.",
    slug: "lux-lumiere-monogrammed-canvas-tote",
    brand: "LUMIERE PARIS",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-lumiere-paris",
    categoryUrl: "lux-bags",
    subCategoryUrl: "lux-bags-totes",
    variants: [
      {
        variantName: "Natural Canvas with Tan Leather",
        variantDescription:
          "Monogrammed heavyweight canvas tote with vegetable-tanned leather trim and brass feet.",
        slug: "lux-lumiere-canvas-tote-natural",
        sku: "LUMI-BT-005-NAT",
        weight: 0.9,
        isSale: false,
        keywords: [
          "canvas tote",
          "monogram bag",
          "luxury tote",
          "Parisian bag",
          "designer tote",
          "everyday bag",
          "work tote",
        ],
        colors: [{ name: "Natural / Tan" }],
        sizes: [
          { size: "One Size", quantity: 14, price: 1100, discount: 0 },
        ],
        images: [
          { url: img, alt: "Monogrammed Canvas Tote - Front View" },
          { url: img, alt: "Monogrammed Canvas Tote - Interior View" },
          { url: img, alt: "Monogrammed Canvas Tote - Leather Detail" },
        ],
        specs: [
          { name: "Material", value: "Coated Canvas, Vegetable-Tanned Cowhide" },
          { name: "Hardware", value: "Solid Brass" },
          { name: "Dimensions", value: "38cm x 32cm x 16cm" },
        ],
      },
    ],
    questions: [
      {
        question: "Is this tote large enough for a laptop?",
        answer:
          "Yes, the padded interior pocket accommodates laptops up to 14 inches. The overall dimensions comfortably fit all daily essentials including A4 documents, water bottle, and personal items.",
      },
      {
        question: "How does the canvas age over time?",
        answer:
          "The coated canvas maintains its print clarity over time while the vegetable-tanned leather trim develops a rich honey patina with use. This natural aging process makes each bag uniquely personal.",
      },
    ],
  },

  // ── 6. Lambskin Driving Gloves ──
  {
    name: "Lambskin Driving Gloves",
    description:
      "The Lambskin Driving Gloves from LUMIERE PARIS are a refined nod to the golden era of grand touring, reimagined for the contemporary woman of distinction. Crafted from ultra-soft Italian lambskin with an unlined interior that allows for maximum tactile sensitivity and dexterity, these gloves feature the classic open-back design with ventilation holes and a snap closure at the wrist. The knuckle perforations are arranged in the signature LUMIERE star pattern, adding a distinctive design element that sets these gloves apart from conventional driving gloves. Each pair is hand-cut and hand-sewn using traditional Punto Selleria stitching that ensures exceptional durability and a beautifully finished appearance.",
    slug: "lux-lumiere-lambskin-driving-gloves",
    brand: "LUMIERE PARIS",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-lumiere-paris",
    categoryUrl: "lux-accessories",
    subCategoryUrl: "lux-acc-gloves",
    variants: [
      {
        variantName: "Cognac",
        variantDescription:
          "Unlined Italian lambskin driving gloves in cognac with star-pattern perforations.",
        slug: "lux-lumiere-driving-gloves-cognac",
        sku: "LUMI-AB-006-COG",
        weight: 0.1,
        isSale: false,
        keywords: [
          "driving gloves",
          "lambskin gloves",
          "luxury gloves",
          "Italian leather",
          "women gloves",
          "cognac gloves",
        ],
        colors: [{ name: "Cognac" }],
        sizes: [
          { size: "S", quantity: 10, price: 360, discount: 0 },
          { size: "M", quantity: 14, price: 360, discount: 0 },
          { size: "L", quantity: 8, price: 360, discount: 0 },
        ],
        images: [
          { url: img, alt: "Lambskin Driving Gloves Cognac - Pair View" },
          { url: img, alt: "Lambskin Driving Gloves Cognac - Back Detail" },
          { url: img, alt: "Lambskin Driving Gloves Cognac - Snap Closure Detail" },
        ],
        specs: [
          { name: "Material", value: "Italian Lambskin (unlined)" },
          { name: "Closure", value: "Brass snap button" },
          { name: "Origin", value: "Italy (Naples)" },
        ],
      },
      {
        variantName: "Black",
        variantDescription:
          "Unlined Italian lambskin driving gloves in classic black with star-pattern perforations.",
        slug: "lux-lumiere-driving-gloves-black",
        sku: "LUMI-AB-006-BLK",
        weight: 0.1,
        isSale: true,
        keywords: [
          "driving gloves",
          "black gloves",
          "lambskin gloves",
          "luxury accessory",
          "Italian gloves",
          "designer gloves",
        ],
        colors: [{ name: "Black" }],
        sizes: [
          { size: "S", quantity: 8, price: 360, discount: 15 },
          { size: "M", quantity: 12, price: 360, discount: 15 },
          { size: "L", quantity: 6, price: 360, discount: 15 },
        ],
        images: [
          { url: img, alt: "Lambskin Driving Gloves Black - Pair View" },
          { url: img, alt: "Lambskin Driving Gloves Black - Perforation Detail" },
          { url: img, alt: "Lambskin Driving Gloves Black - On Hand" },
        ],
        specs: [
          { name: "Material", value: "Italian Lambskin (unlined)" },
          { name: "Closure", value: "Brass snap button" },
          { name: "Origin", value: "Italy (Naples)" },
        ],
      },
    ],
    questions: [
      {
        question: "Are these gloves warm enough for winter?",
        answer:
          "These are designed as lightweight driving gloves and are unlined for maximum dexterity. They provide minimal warmth and are best suited for mild weather or indoor occasions. For winter warmth, see our cashmere-lined collection.",
      },
      {
        question: "Will the lambskin stretch over time?",
        answer:
          "Yes, lambskin naturally conforms to the shape of your hand with wear. We recommend choosing your exact size for the best fit, as the leather will mold to your hand within the first few uses.",
      },
    ],
  },
];
