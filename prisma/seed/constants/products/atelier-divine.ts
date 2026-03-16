import type { SeedProduct } from "../../types";

const img = "/assets/images/no_image.png";

/** ATELIER DIVINE — 職人のハンドクラフト（6商品） */
export const STORE_PRODUCTS: SeedProduct[] = [
  // ── 1. Artisan Gold Chain Necklace ──
  {
    name: "Artisan Gold Chain Necklace",
    description:
      "The Artisan Gold Chain Necklace from ATELIER DIVINE is a stunning testament to the enduring art of goldsmithing. Handcrafted from solid 18-karat yellow gold, each link in this substantial chain is individually formed and polished by master artisans using techniques that date back centuries. The necklace features a distinctive Byzantine weave pattern that catches the light from every angle, creating a warm luminous glow against the skin. Secured with a robust lobster clasp bearing the ATELIER DIVINE hallmark, this necklace is designed to become a treasured heirloom passed down through generations.",
    slug: "lux-atelier-artisan-gold-chain-necklace",
    brand: "ATELIER DIVINE",
    shippingFeeMethod: "FIXED",
    storeUrl: "lux-atelier-divine",
    categoryUrl: "lux-jewelry",
    subCategoryUrl: "lux-jewelry-necklaces",
    offerTagUrl: "lux-exclusive",
    variants: [
      {
        variantName: "18K Yellow Gold",
        variantDescription:
          "Solid 18-karat yellow gold Byzantine weave chain necklace with hallmarked clasp.",
        slug: "lux-atelier-gold-chain-18k",
        sku: "ATEL-JN-001-18K",
        weight: 0.08,
        isSale: false,
        keywords: [
          "gold necklace",
          "chain necklace",
          "18K gold",
          "artisan jewelry",
          "Byzantine chain",
          "luxury necklace",
          "handcrafted",
        ],
        colors: [{ name: "Yellow Gold" }],
        sizes: [
          { size: "45cm", quantity: 8, price: 1850, discount: 0 },
          { size: "50cm", quantity: 10, price: 1850, discount: 0 },
        ],
        images: [
          { url: img, alt: "Artisan Gold Chain Necklace - Full View" },
          { url: img, alt: "Artisan Gold Chain Necklace - Link Detail" },
          { url: img, alt: "Artisan Gold Chain Necklace - Clasp Detail" },
        ],
        specs: [
          { name: "Material", value: "18K Yellow Gold (750)" },
          { name: "Weight", value: "28g (45cm) / 32g (50cm)" },
          { name: "Origin", value: "Italy (Florence)" },
        ],
      },
    ],
    questions: [
      {
        question: "Does this necklace come with a certificate of authenticity?",
        answer:
          "Yes, every piece from ATELIER DIVINE includes a certificate of authenticity with the hallmark number, gold purity, and the name of the master artisan who crafted it.",
      },
      {
        question: "Can the chain length be customized?",
        answer:
          "We offer standard lengths of 45cm and 50cm. Custom lengths between 40cm and 60cm can be ordered through our bespoke service with a 4-6 week lead time.",
      },
    ],
  },

  // ── 2. Diamond Pave Ring ──
  {
    name: "Diamond Pave Ring",
    description:
      "The Diamond Pave Ring is a breathtaking display of precision craftsmanship, featuring over fifty individually set brilliant-cut diamonds arranged in a continuous pave setting across the band. Each diamond is carefully selected for exceptional clarity and fire, then hand-set by our master gem setters to create a seamless carpet of scintillating light. The 18-karat white gold band is rhodium-plated for enhanced brilliance and scratch resistance. This ring makes an extraordinary statement piece for special occasions or a magnificent addition to a curated stack of fine jewelry.",
    slug: "lux-atelier-diamond-pave-ring",
    brand: "ATELIER DIVINE",
    shippingFeeMethod: "FIXED",
    storeUrl: "lux-atelier-divine",
    categoryUrl: "lux-jewelry",
    subCategoryUrl: "lux-jewelry-rings",
    variants: [
      {
        variantName: "White Gold Pave",
        variantDescription:
          "18K white gold ring with 50+ brilliant-cut diamonds in full pave setting.",
        slug: "lux-atelier-diamond-pave-ring-wg",
        sku: "ATEL-JR-002-WG",
        weight: 0.01,
        isSale: false,
        keywords: [
          "diamond ring",
          "pave ring",
          "white gold ring",
          "luxury ring",
          "designer ring",
          "statement ring",
        ],
        colors: [{ name: "White Gold" }],
        sizes: [
          { size: "5", quantity: 6, price: 1200, discount: 0 },
          { size: "6", quantity: 8, price: 1200, discount: 0 },
          { size: "7", quantity: 10, price: 1200, discount: 0 },
          { size: "8", quantity: 6, price: 1200, discount: 0 },
        ],
        images: [
          { url: img, alt: "Diamond Pave Ring - Top View" },
          { url: img, alt: "Diamond Pave Ring - Side View" },
          { url: img, alt: "Diamond Pave Ring - Sparkle Detail" },
        ],
        specs: [
          { name: "Material", value: "18K White Gold, Rhodium-plated" },
          { name: "Stones", value: "50+ Brilliant-cut Diamonds (0.75ct total)" },
          { name: "Origin", value: "Belgium (Antwerp)" },
        ],
      },
    ],
    questions: [
      {
        question: "What is the total carat weight of the diamonds?",
        answer:
          "The total carat weight is approximately 0.75ct, with each diamond individually graded for VS clarity and F-G color grade before being set.",
      },
      {
        question: "Can this ring be resized?",
        answer:
          "Due to the full pave setting, resizing is limited to half a size up or down. We strongly recommend visiting a jeweler for precise sizing before ordering.",
      },
    ],
  },

  // ── 3. Hammered Silver Cuff Bracelet ──
  {
    name: "Hammered Silver Cuff Bracelet",
    description:
      "Our Hammered Silver Cuff Bracelet celebrates the raw beauty of artisanal metalwork. Forged from a single piece of sterling silver and hand-hammered to create a distinctive organic texture, this cuff bracelet embodies the wabi-sabi aesthetic of imperfect beauty. Each hammer mark is deliberately placed by our silversmiths, ensuring that no two pieces are exactly alike. The gently tapered design allows for comfortable daily wear while the substantial weight provides a satisfying presence on the wrist. The interior is mirror-polished for a smooth feel against the skin, creating an elegant contrast with the textured exterior.",
    slug: "lux-atelier-hammered-silver-cuff",
    brand: "ATELIER DIVINE",
    shippingFeeMethod: "FIXED",
    storeUrl: "lux-atelier-divine",
    categoryUrl: "lux-jewelry",
    subCategoryUrl: "lux-jewelry-bracelets",
    variants: [
      {
        variantName: "Oxidized Sterling Silver",
        variantDescription:
          "Hand-hammered sterling silver cuff bracelet with oxidized finish and mirror-polished interior.",
        slug: "lux-atelier-silver-cuff-oxidized",
        sku: "ATEL-JE-003-OXD",
        weight: 0.06,
        isSale: false,
        keywords: [
          "silver cuff",
          "hammered bracelet",
          "sterling silver",
          "artisan bracelet",
          "luxury bracelet",
          "cuff bracelet",
        ],
        colors: [{ name: "Oxidized Silver" }],
        sizes: [
          { size: "S (15cm)", quantity: 10, price: 680, discount: 0 },
          { size: "M (17cm)", quantity: 12, price: 680, discount: 0 },
          { size: "L (19cm)", quantity: 8, price: 680, discount: 0 },
        ],
        images: [
          { url: img, alt: "Hammered Silver Cuff Bracelet - Front View" },
          { url: img, alt: "Hammered Silver Cuff Bracelet - Texture Detail" },
          { url: img, alt: "Hammered Silver Cuff Bracelet - Interior View" },
        ],
        specs: [
          { name: "Material", value: "925 Sterling Silver with Oxidized Finish" },
          { name: "Width", value: "2.5cm at widest point" },
          { name: "Origin", value: "Italy (Florence)" },
        ],
      },
    ],
    questions: [
      {
        question: "Will the oxidized finish wear off over time?",
        answer:
          "The oxidized finish may lighten slightly with regular wear, which adds character to the piece. If desired, we offer a complimentary re-oxidation service at any ATELIER DIVINE boutique.",
      },
      {
        question: "Is this cuff adjustable?",
        answer:
          "The cuff has a small opening that allows gentle adjustment for a comfortable fit. However, we recommend choosing the closest size to your wrist measurement for optimal comfort.",
      },
    ],
  },

  // ── 4. Pearl Drop Earrings ──
  {
    name: "Pearl Drop Earrings",
    description:
      "Our Pearl Drop Earrings showcase the ethereal beauty of South Sea cultured pearls suspended from delicate 18-karat gold findings. Each pearl is hand-selected for its exceptional lustre, smooth surface, and perfectly round shape, with a minimum diameter of 10mm that ensures commanding presence without overwhelming the wearer. The earrings feature a contemporary minimalist design where the pearls appear to float effortlessly below the earlobe, connected by a slender gold bar and secured with comfortable push-back closures. These earrings embody the perfect marriage of natural beauty and refined design that defines the ATELIER DIVINE aesthetic.",
    slug: "lux-atelier-pearl-drop-earrings",
    brand: "ATELIER DIVINE",
    shippingFeeMethod: "FIXED",
    storeUrl: "lux-atelier-divine",
    categoryUrl: "lux-jewelry",
    subCategoryUrl: "lux-jewelry-earrings",
    offerTagUrl: "lux-new-arrival",
    variants: [
      {
        variantName: "White Pearl Gold",
        variantDescription:
          "South Sea cultured pearl drop earrings with 18K yellow gold findings.",
        slug: "lux-atelier-pearl-earrings-white",
        sku: "ATEL-JE-004-WPG",
        weight: 0.01,
        isSale: false,
        keywords: [
          "pearl earrings",
          "drop earrings",
          "South Sea pearl",
          "gold earrings",
          "luxury earrings",
          "designer earrings",
        ],
        colors: [{ name: "White Pearl" }],
        sizes: [
          { size: "One Size", quantity: 15, price: 520, discount: 0 },
        ],
        images: [
          { url: img, alt: "Pearl Drop Earrings - Pair View" },
          { url: img, alt: "Pearl Drop Earrings - Pearl Detail" },
          { url: img, alt: "Pearl Drop Earrings - On Model" },
        ],
        specs: [
          { name: "Material", value: "South Sea Cultured Pearl, 18K Yellow Gold" },
          { name: "Pearl Size", value: "10-11mm diameter" },
          { name: "Origin", value: "Australia (pearls), Italy (setting)" },
        ],
      },
    ],
    questions: [
      {
        question: "How should I care for these pearl earrings?",
        answer:
          "Pearls should be the last thing you put on and the first thing you take off. Avoid contact with perfume, hairspray, and cosmetics. Wipe gently with a soft cloth after wearing.",
      },
      {
        question: "Are these suitable for sensitive ears?",
        answer:
          "Yes, the 18K gold posts and push-back closures are hypoallergenic. Gold purity of 750/1000 is well-suited for those with metal sensitivities.",
      },
    ],
  },

  // ── 5. Leather Portfolio Briefcase ──
  {
    name: "Leather Portfolio Briefcase",
    description:
      "The Leather Portfolio Briefcase from ATELIER DIVINE is the ultimate expression of professional luxury. Hand-stitched from full-grain vegetable-tanned Italian calfskin, this briefcase develops a rich patina over time that tells the story of its owners journey. The interior is organized with a padded laptop compartment fitting up to a 15-inch device, multiple document slots, and a zippered security pocket lined in suede. The hand-burnished edges and blind-stamped monogram on the flap demonstrate the exceptional attention to detail that defines every ATELIER DIVINE creation. Solid brass hardware with an antique finish adds timeless sophistication.",
    slug: "lux-atelier-leather-portfolio-briefcase",
    brand: "ATELIER DIVINE",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-atelier-divine",
    categoryUrl: "lux-bags",
    subCategoryUrl: "lux-bags-totes",
    variants: [
      {
        variantName: "Cognac Brown",
        variantDescription:
          "Full-grain Italian calfskin portfolio briefcase in rich cognac brown with brass hardware.",
        slug: "lux-atelier-portfolio-briefcase-cognac",
        sku: "ATEL-BT-005-COG",
        weight: 1.5,
        isSale: false,
        keywords: [
          "leather briefcase",
          "portfolio bag",
          "luxury briefcase",
          "Italian leather",
          "men bag",
          "professional bag",
          "calfskin",
        ],
        colors: [{ name: "Cognac Brown" }],
        sizes: [
          { size: "One Size", quantity: 10, price: 1450, discount: 0 },
        ],
        images: [
          { url: img, alt: "Leather Portfolio Briefcase - Front View" },
          { url: img, alt: "Leather Portfolio Briefcase - Interior View" },
          { url: img, alt: "Leather Portfolio Briefcase - Edge Detail" },
        ],
        specs: [
          { name: "Material", value: "Full-Grain Vegetable-Tanned Italian Calfskin" },
          { name: "Hardware", value: "Solid Brass with Antique Finish" },
          { name: "Dimensions", value: "40cm x 30cm x 8cm" },
        ],
      },
      {
        variantName: "Black Edition",
        variantDescription:
          "Full-grain Italian calfskin portfolio briefcase in classic black with gunmetal hardware.",
        slug: "lux-atelier-portfolio-briefcase-black",
        sku: "ATEL-BT-005-BLK",
        weight: 1.5,
        isSale: true,
        keywords: [
          "leather briefcase",
          "black briefcase",
          "luxury bag",
          "Italian leather",
          "professional briefcase",
          "calfskin bag",
        ],
        colors: [{ name: "Black" }],
        sizes: [
          { size: "One Size", quantity: 8, price: 1450, discount: 10 },
        ],
        images: [
          { url: img, alt: "Leather Portfolio Briefcase Black - Front View" },
          { url: img, alt: "Leather Portfolio Briefcase Black - Open View" },
          { url: img, alt: "Leather Portfolio Briefcase Black - Hardware Detail" },
        ],
        specs: [
          { name: "Material", value: "Full-Grain Vegetable-Tanned Italian Calfskin" },
          { name: "Hardware", value: "Solid Brass with Gunmetal Finish" },
          { name: "Dimensions", value: "40cm x 30cm x 8cm" },
        ],
      },
    ],
    questions: [
      {
        question: "Will the leather develop a patina over time?",
        answer:
          "Yes, the vegetable-tanned calfskin is specifically chosen for its ability to develop a beautiful rich patina with use. The cognac color will deepen and develop unique character over time.",
      },
      {
        question: "Can this briefcase fit a 15-inch laptop?",
        answer:
          "Yes, the padded interior compartment is designed to accommodate laptops up to 15 inches. The padding provides shock protection while maintaining the slim profile of the briefcase.",
      },
    ],
  },

  // ── 6. Hand Painted Silk Scarf ──
  {
    name: "Hand Painted Silk Scarf",
    description:
      "The Hand Painted Silk Scarf is a wearable masterpiece that showcases the extraordinary talent of our textile artists. Each scarf is individually painted on pure twill silk using traditional resist-dyeing techniques combined with freehand brushwork, resulting in a unique botanical composition inspired by Renaissance garden illustrations. The vibrant pigments are fixed through a specialized steaming process that ensures colorfastness and longevity. The generous square dimensions allow for countless styling possibilities, from a classic neck tie to an elegant head wrap or even a decorative bag accent. Hand-rolled edges complete this extraordinary accessory.",
    slug: "lux-atelier-hand-painted-silk-scarf",
    brand: "ATELIER DIVINE",
    shippingFeeMethod: "ITEM",
    storeUrl: "lux-atelier-divine",
    categoryUrl: "lux-accessories",
    subCategoryUrl: "lux-acc-scarves",
    offerTagUrl: "lux-limited-edition",
    variants: [
      {
        variantName: "Garden Botanica",
        variantDescription:
          "Hand-painted pure twill silk scarf with Renaissance botanical motifs and hand-rolled edges.",
        slug: "lux-atelier-silk-scarf-botanica",
        sku: "ATEL-AS-006-BOT",
        weight: 0.1,
        isSale: false,
        keywords: [
          "silk scarf",
          "hand painted scarf",
          "luxury scarf",
          "botanical scarf",
          "designer scarf",
          "art scarf",
        ],
        colors: [{ name: "Multi (Green/Gold/Burgundy)" }],
        sizes: [
          { size: "90cm x 90cm", quantity: 12, price: 380, discount: 0 },
        ],
        images: [
          { url: img, alt: "Hand Painted Silk Scarf - Full View" },
          { url: img, alt: "Hand Painted Silk Scarf - Paint Detail" },
          { url: img, alt: "Hand Painted Silk Scarf - Edge Detail" },
        ],
        specs: [
          { name: "Material", value: "100% Pure Twill Silk" },
          { name: "Technique", value: "Hand-painted with resist-dyeing" },
          { name: "Origin", value: "Italy" },
        ],
      },
    ],
    questions: [
      {
        question: "Is each scarf truly unique?",
        answer:
          "Yes, because each scarf is hand-painted individually, no two pieces are exactly identical. While the overall botanical theme remains consistent, the specific brush strokes and color nuances vary.",
      },
      {
        question: "How should I clean this scarf?",
        answer:
          "We recommend professional dry cleaning with a specialist experienced in silk. The pigments are heat-fixed for durability, but handwashing is not recommended to preserve the painted details.",
      },
    ],
  },
];
