import type { SeedProduct } from "../../types";

const img = "/assets/images/no_image.png";

/** VELVET CROWN — ロイヤルインスパイア（6商品） */
export const STORE_PRODUCTS: SeedProduct[] = [
  // ── 1. Structured Leather Tote ──
  {
    name: "Structured Leather Tote",
    description:
      "The Structured Leather Tote from VELVET CROWN is the quintessential luxury day bag, engineered for the modern woman who demands both beauty and functionality. Constructed from rigid Saffiano-embossed calfskin leather that resists scratches and maintains its architectural shape, this tote features a spacious interior with a central zippered divider, two slip pockets, and a dedicated tablet sleeve. The top handles are reinforced with hand-stitched saddle stitch construction for lasting durability, while the optional crossbody strap offers versatile carrying options. Polished palladium hardware and the embossed crown logo add distinguished finishing touches.",
    slug: "lux-velvet-structured-leather-tote",
    brand: "VELVET CROWN",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-velvet-crown",
    categoryUrl: "lux-bags",
    subCategoryUrl: "lux-bags-handbags",
    offerTagUrl: "lux-best-seller",
    variants: [
      {
        variantName: "Burgundy",
        variantDescription:
          "Saffiano-embossed calfskin structured tote in deep burgundy with palladium hardware.",
        slug: "lux-velvet-leather-tote-burgundy",
        sku: "VLVT-BH-001-BRG",
        weight: 1.2,
        isSale: false,
        keywords: [
          "leather tote",
          "structured bag",
          "luxury tote",
          "Saffiano leather",
          "burgundy bag",
          "designer tote",
          "work bag",
        ],
        colors: [{ name: "Burgundy" }],
        sizes: [
          { size: "One Size", quantity: 12, price: 2200, discount: 0 },
        ],
        images: [
          { url: img, alt: "Structured Leather Tote Burgundy - Front View" },
          { url: img, alt: "Structured Leather Tote Burgundy - Interior View" },
          { url: img, alt: "Structured Leather Tote Burgundy - Handle Detail" },
        ],
        specs: [
          { name: "Material", value: "Saffiano-Embossed Calfskin Leather" },
          { name: "Hardware", value: "Polished Palladium" },
          { name: "Dimensions", value: "34cm x 28cm x 15cm" },
        ],
      },
      {
        variantName: "Noir",
        variantDescription:
          "Saffiano-embossed calfskin structured tote in classic noir with palladium hardware.",
        slug: "lux-velvet-leather-tote-noir",
        sku: "VLVT-BH-001-NOR",
        weight: 1.2,
        isSale: false,
        keywords: [
          "leather tote",
          "black tote",
          "luxury handbag",
          "Saffiano leather",
          "designer bag",
          "structured tote",
        ],
        colors: [{ name: "Noir" }],
        sizes: [
          { size: "One Size", quantity: 15, price: 2200, discount: 0 },
        ],
        images: [
          { url: img, alt: "Structured Leather Tote Noir - Front View" },
          { url: img, alt: "Structured Leather Tote Noir - Side View" },
          { url: img, alt: "Structured Leather Tote Noir - Logo Detail" },
        ],
        specs: [
          { name: "Material", value: "Saffiano-Embossed Calfskin Leather" },
          { name: "Hardware", value: "Polished Palladium" },
          { name: "Dimensions", value: "34cm x 28cm x 15cm" },
        ],
      },
    ],
    questions: [
      {
        question: "Is this tote large enough for daily work essentials?",
        answer:
          "Yes, the interior comfortably fits a 13-inch laptop, A4 documents, wallet, phone, cosmetics pouch, and water bottle. The central divider helps organize your belongings efficiently.",
      },
      {
        question: "How do I care for Saffiano leather?",
        answer:
          "Saffiano leather is remarkably low-maintenance. Simply wipe with a soft damp cloth to remove surface dust. For deeper cleaning, use a leather-specific cleaner and avoid excessive water exposure.",
      },
    ],
  },

  // ── 2. Python Embossed Crossbody ──
  {
    name: "Python Embossed Crossbody",
    description:
      "The Python Embossed Crossbody from VELVET CROWN brings exotic luxury into everyday elegance without the use of exotic skins. Our proprietary embossing technique recreates the distinctive scale pattern of python on premium Italian calfskin, resulting in a strikingly realistic texture that is both durable and ethically conscious. The compact yet thoughtfully designed interior features a suede-lined main compartment, card slots, and a rear slip pocket for quick access essentials. The adjustable chain-link strap with a leather shoulder pad allows comfortable crossbody or shoulder wear. Finished with the signature crown lock closure in polished gold tone.",
    slug: "lux-velvet-python-embossed-crossbody",
    brand: "VELVET CROWN",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-velvet-crown",
    categoryUrl: "lux-bags",
    subCategoryUrl: "lux-bags-handbags",
    offerTagUrl: "lux-limited-edition",
    variants: [
      {
        variantName: "Emerald Green",
        variantDescription:
          "Python-embossed calfskin crossbody in emerald green with gold-toned crown lock closure.",
        slug: "lux-velvet-python-crossbody-emerald",
        sku: "VLVT-BH-002-EMR",
        weight: 0.6,
        isSale: false,
        keywords: [
          "python bag",
          "crossbody bag",
          "luxury crossbody",
          "embossed leather",
          "emerald bag",
          "designer crossbody",
        ],
        colors: [{ name: "Emerald Green" }],
        sizes: [
          { size: "One Size", quantity: 10, price: 1800, discount: 0 },
        ],
        images: [
          { url: img, alt: "Python Embossed Crossbody Emerald - Front View" },
          { url: img, alt: "Python Embossed Crossbody Emerald - Texture Detail" },
          { url: img, alt: "Python Embossed Crossbody Emerald - Crown Lock Detail" },
        ],
        specs: [
          { name: "Material", value: "Python-Embossed Italian Calfskin" },
          { name: "Hardware", value: "Gold-toned Brass" },
          { name: "Dimensions", value: "24cm x 16cm x 7cm" },
        ],
      },
    ],
    questions: [
      {
        question: "Is this bag made from real python skin?",
        answer:
          "No, this bag uses our proprietary embossing technique on premium Italian calfskin to replicate the python scale pattern. It is entirely cruelty-free while maintaining the exotic aesthetic.",
      },
      {
        question: "Can the strap be adjusted for crossbody wear?",
        answer:
          "Yes, the chain-link strap is adjustable from 50cm to 130cm drop length, allowing both shoulder and crossbody wear. The leather shoulder pad ensures comfortable carrying throughout the day.",
      },
    ],
  },

  // ── 3. Suede Ankle Boots ──
  {
    name: "Suede Ankle Boots",
    description:
      "Our Suede Ankle Boots are the perfect fusion of regal sophistication and modern comfort. Crafted from the softest Italian suede with a luxuriously napped finish, these boots feature a sculpted 65mm block heel that provides stable elevation without sacrificing walkability. The Chelsea boot silhouette is updated with concealed elastic gore panels and a polished brass zipper at the inner ankle for easy entry. A cushioned leather insole with anatomical arch support ensures all-day comfort, while the Goodyear-welted leather sole can be resoled for years of continued wear. Each pair is treated with a protective coating to resist water and staining.",
    slug: "lux-velvet-suede-ankle-boots",
    brand: "VELVET CROWN",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-velvet-crown",
    categoryUrl: "lux-shoes",
    subCategoryUrl: "lux-shoes-boots",
    variants: [
      {
        variantName: "Camel Suede",
        variantDescription:
          "Italian suede ankle boots in warm camel with brass zipper and Goodyear-welted sole.",
        slug: "lux-velvet-suede-boots-camel",
        sku: "VLVT-SB-003-CML",
        weight: 0.9,
        isSale: false,
        keywords: [
          "suede boots",
          "ankle boots",
          "luxury boots",
          "Italian suede",
          "camel boots",
          "designer boots",
          "Chelsea boots",
        ],
        colors: [{ name: "Camel" }],
        sizes: [
          { size: "36", quantity: 8, price: 980, discount: 0 },
          { size: "37", quantity: 12, price: 980, discount: 0 },
          { size: "38", quantity: 14, price: 980, discount: 0 },
          { size: "39", quantity: 12, price: 980, discount: 0 },
          { size: "40", quantity: 8, price: 980, discount: 0 },
          { size: "41", quantity: 6, price: 980, discount: 0 },
        ],
        images: [
          { url: img, alt: "Suede Ankle Boots Camel - Side View" },
          { url: img, alt: "Suede Ankle Boots Camel - Heel Detail" },
          { url: img, alt: "Suede Ankle Boots Camel - Sole Detail" },
        ],
        specs: [
          { name: "Material", value: "Italian Suede (upper), Leather (sole)" },
          { name: "Heel Height", value: "65mm block heel" },
          { name: "Construction", value: "Goodyear welted" },
        ],
      },
    ],
    questions: [
      {
        question: "Are these boots waterproof?",
        answer:
          "The boots are treated with a water-resistant coating that provides protection against light rain and splashes. However, they are not fully waterproof and we recommend avoiding prolonged exposure to heavy rain.",
      },
      {
        question: "Can the soles be replaced when worn?",
        answer:
          "Yes, the Goodyear-welted construction allows for complete sole replacement by a skilled cobbler, extending the life of your boots for many years.",
      },
    ],
  },

  // ── 4. Patent Leather Stiletto Heels ──
  {
    name: "Patent Leather Stiletto Heels",
    description:
      "The Patent Leather Stiletto Heels from VELVET CROWN are the ultimate statement of feminine power and elegance. Crafted from mirror-finish Italian patent leather, these pointed-toe pumps feature a precision-engineered 100mm stiletto heel with a concealed platform for added comfort. The interior is lined with breathable kid leather and cushioned with memory foam for extended wear. The proprietary flex sole allows natural foot movement despite the elevated height, while the anti-slip rubber tip provides confidence on any surface. Each pair is hand-polished to achieve the flawless high-gloss finish that has become a signature of the VELVET CROWN footwear collection.",
    slug: "lux-velvet-patent-stiletto-heels",
    brand: "VELVET CROWN",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-velvet-crown",
    categoryUrl: "lux-shoes",
    subCategoryUrl: "lux-shoes-heels",
    variants: [
      {
        variantName: "Classic Red",
        variantDescription:
          "Mirror-finish patent leather stiletto pumps in classic red with 100mm heel and memory foam insole.",
        slug: "lux-velvet-patent-stiletto-red",
        sku: "VLVT-SH-004-RED",
        weight: 0.5,
        isSale: false,
        keywords: [
          "stiletto heels",
          "patent leather",
          "red heels",
          "luxury pumps",
          "high heels",
          "designer heels",
        ],
        colors: [{ name: "Classic Red" }],
        sizes: [
          { size: "35", quantity: 6, price: 750, discount: 0 },
          { size: "36", quantity: 10, price: 750, discount: 0 },
          { size: "37", quantity: 14, price: 750, discount: 0 },
          { size: "38", quantity: 14, price: 750, discount: 0 },
          { size: "39", quantity: 10, price: 750, discount: 0 },
          { size: "40", quantity: 6, price: 750, discount: 0 },
        ],
        images: [
          { url: img, alt: "Patent Leather Stiletto Red - Side View" },
          { url: img, alt: "Patent Leather Stiletto Red - Front View" },
          { url: img, alt: "Patent Leather Stiletto Red - Sole Detail" },
        ],
        specs: [
          { name: "Material", value: "Italian Patent Leather (upper), Kid Leather (lining)" },
          { name: "Heel Height", value: "100mm with concealed 10mm platform" },
          { name: "Origin", value: "Italy" },
        ],
      },
      {
        variantName: "Black Patent",
        variantDescription:
          "Mirror-finish patent leather stiletto pumps in classic black with 100mm heel.",
        slug: "lux-velvet-patent-stiletto-black",
        sku: "VLVT-SH-004-BLK",
        weight: 0.5,
        isSale: true,
        keywords: [
          "stiletto heels",
          "patent leather",
          "black heels",
          "luxury pumps",
          "designer heels",
          "evening shoes",
        ],
        colors: [{ name: "Black" }],
        sizes: [
          { size: "36", quantity: 12, price: 750, discount: 20 },
          { size: "37", quantity: 14, price: 750, discount: 20 },
          { size: "38", quantity: 14, price: 750, discount: 20 },
          { size: "39", quantity: 10, price: 750, discount: 20 },
        ],
        images: [
          { url: img, alt: "Patent Leather Stiletto Black - Side View" },
          { url: img, alt: "Patent Leather Stiletto Black - Pair View" },
          { url: img, alt: "Patent Leather Stiletto Black - Heel Detail" },
        ],
        specs: [
          { name: "Material", value: "Italian Patent Leather (upper), Kid Leather (lining)" },
          { name: "Heel Height", value: "100mm with concealed 10mm platform" },
          { name: "Origin", value: "Italy" },
        ],
      },
    ],
    questions: [
      {
        question: "Are these heels comfortable for extended wear?",
        answer:
          "Yes, the memory foam insole and concealed platform reduce the effective heel height to 90mm, providing surprising comfort. The flex sole technology allows natural foot movement. Most clients report comfortable wear for 4-6 hours.",
      },
      {
        question: "How do I maintain the patent leather finish?",
        answer:
          "Wipe with a soft damp cloth after each wear. For scuffs, use a small amount of patent leather cleaner. Store in the provided dust bags to prevent surface marks and keep the mirror finish pristine.",
      },
    ],
  },

  // ── 5. Calfskin Belt with Monogram Buckle ──
  {
    name: "Calfskin Belt with Monogram Buckle",
    description:
      "The Calfskin Belt with Monogram Buckle is a refined accessory that anchors any ensemble with quiet authority. Cut from a single piece of smooth Italian calfskin leather, this belt features clean edges that are hand-painted and burnished to a flawless finish. The signature VELVET CROWN monogram buckle is cast in solid brass and plated with palladium for a cool silver-toned luster that resists tarnishing. Five precisely spaced adjustment holes ensure a perfect fit, while the keeper loop features a subtle embossed crown motif. This is a belt that elevates everything from tailored trousers to denim with understated distinction and lasting quality.",
    slug: "lux-velvet-calfskin-belt-monogram",
    brand: "VELVET CROWN",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-velvet-crown",
    categoryUrl: "lux-accessories",
    subCategoryUrl: "lux-acc-belts",
    variants: [
      {
        variantName: "Tan with Silver Buckle",
        variantDescription:
          "Italian calfskin belt in warm tan with palladium-plated monogram buckle.",
        slug: "lux-velvet-calfskin-belt-tan",
        sku: "VLVT-AB-005-TAN",
        weight: 0.3,
        isSale: false,
        keywords: [
          "calfskin belt",
          "monogram belt",
          "luxury belt",
          "Italian leather belt",
          "designer belt",
          "men belt",
        ],
        colors: [{ name: "Tan" }],
        sizes: [
          { size: "80cm", quantity: 8, price: 490, discount: 0 },
          { size: "85cm", quantity: 12, price: 490, discount: 0 },
          { size: "90cm", quantity: 15, price: 490, discount: 0 },
          { size: "95cm", quantity: 12, price: 490, discount: 0 },
          { size: "100cm", quantity: 8, price: 490, discount: 0 },
        ],
        images: [
          { url: img, alt: "Calfskin Belt Tan - Full Length View" },
          { url: img, alt: "Calfskin Belt Tan - Buckle Detail" },
          { url: img, alt: "Calfskin Belt Tan - Edge Detail" },
        ],
        specs: [
          { name: "Material", value: "Italian Calfskin Leather" },
          { name: "Buckle", value: "Solid Brass, Palladium-plated" },
          { name: "Width", value: "3.5cm" },
        ],
      },
    ],
    questions: [
      {
        question: "Is the buckle interchangeable?",
        answer:
          "The monogram buckle is attached with a screw mechanism that allows for interchange with other VELVET CROWN buckles. Additional buckle styles are available separately.",
      },
      {
        question: "How do I determine my belt size?",
        answer:
          "Measure your waist at the point where you typically wear your belt and add 5cm. For example, if your waist measures 85cm, select the 90cm belt. The center hole provides the most aesthetically balanced look.",
      },
    ],
  },

  // ── 6. Quilted Lambskin Evening Bag ──
  {
    name: "Quilted Lambskin Evening Bag",
    description:
      "The Quilted Lambskin Evening Bag from VELVET CROWN is an icon of timeless evening elegance. Crafted from butter-soft lambskin leather with the signature diamond quilting pattern, this compact bag exudes luxury from every angle. The interior is lined in jewel-toned silk with a mirror pocket and lipstick loop for essentials. A woven leather and chain strap can be worn as a shoulder bag or doubled for a shorter handheld carry. The turn-lock closure features the crown emblem cast in antiqued gold, adding a regal finishing touch. This bag transitions effortlessly from intimate dinners to grand galas, making it the ultimate evening companion.",
    slug: "lux-velvet-quilted-lambskin-evening-bag",
    brand: "VELVET CROWN",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-velvet-crown",
    categoryUrl: "lux-bags",
    subCategoryUrl: "lux-bags-clutches",
    offerTagUrl: "lux-exclusive",
    variants: [
      {
        variantName: "Royal Purple",
        variantDescription:
          "Diamond-quilted lambskin evening bag in royal purple with antiqued gold crown lock.",
        slug: "lux-velvet-quilted-evening-bag-purple",
        sku: "VLVT-BC-006-PRP",
        weight: 0.4,
        isSale: false,
        keywords: [
          "quilted bag",
          "lambskin bag",
          "evening bag",
          "luxury bag",
          "purple bag",
          "designer bag",
          "chain bag",
        ],
        colors: [{ name: "Royal Purple" }],
        sizes: [
          { size: "One Size", quantity: 10, price: 1650, discount: 0 },
        ],
        images: [
          { url: img, alt: "Quilted Lambskin Evening Bag Purple - Front View" },
          { url: img, alt: "Quilted Lambskin Evening Bag Purple - Quilting Detail" },
          { url: img, alt: "Quilted Lambskin Evening Bag Purple - Chain Strap Detail" },
        ],
        specs: [
          { name: "Material", value: "Lambskin Leather (quilted)" },
          { name: "Hardware", value: "Antiqued Gold-tone Brass" },
          { name: "Dimensions", value: "20cm x 14cm x 6cm" },
        ],
      },
      {
        variantName: "Classic Black",
        variantDescription:
          "Diamond-quilted lambskin evening bag in classic black with antiqued gold crown lock.",
        slug: "lux-velvet-quilted-evening-bag-black",
        sku: "VLVT-BC-006-BLK",
        weight: 0.4,
        isSale: false,
        keywords: [
          "quilted bag",
          "lambskin bag",
          "black evening bag",
          "luxury clutch",
          "designer bag",
          "chain bag",
        ],
        colors: [{ name: "Black" }],
        sizes: [
          { size: "One Size", quantity: 12, price: 1650, discount: 0 },
        ],
        images: [
          { url: img, alt: "Quilted Lambskin Evening Bag Black - Front View" },
          { url: img, alt: "Quilted Lambskin Evening Bag Black - Interior View" },
          { url: img, alt: "Quilted Lambskin Evening Bag Black - Crown Lock Detail" },
        ],
        specs: [
          { name: "Material", value: "Lambskin Leather (quilted)" },
          { name: "Hardware", value: "Antiqued Gold-tone Brass" },
          { name: "Dimensions", value: "20cm x 14cm x 6cm" },
        ],
      },
    ],
    questions: [
      {
        question: "Is lambskin durable enough for regular use?",
        answer:
          "While lambskin is softer than calfskin, our quilted construction adds structural integrity. We recommend using the provided dust bag for storage and avoiding contact with sharp objects to maintain the pristine surface.",
      },
      {
        question: "Can this bag fit an evening essentials kit?",
        answer:
          "Yes, the interior comfortably holds a smartphone, compact, lipstick, keys, and several cards. The silk lining includes a mirror pocket and lipstick loop for organization.",
      },
    ],
  },
];
