import type { SeedStore } from "../types";
import { SEED_EMAIL_PREFIX } from "../helpers";

const p = SEED_EMAIL_PREFIX;
const defaultImage = "/assets/images/no_image.png";

/** ラグジュアリーファッション店舗（6店舗） */
export const SEED_STORES: SeedStore[] = [
  {
    name: "NOIR ELEGANCE",
    description:
      "Discover the epitome of sophisticated luxury at NOIR ELEGANCE. Our curated collection features timeless pieces crafted from the finest materials, designed for those who appreciate understated refinement and impeccable craftsmanship.",
    email: `${p}store-noir@example.com`,
    phone: "+81312345601",
    url: "lux-noir-elegance",
    logo: defaultImage,
    cover: defaultImage,
    status: "ACTIVE",
    ownerEmail: `${p}seller-noir@example.com`,
    defaultShippingService: "Premium Express",
    defaultShippingFeePerItem: 15.0,
    defaultShippingFeeForAdditionalItem: 5.0,
    defaultShippingFeePerKg: 3.0,
    defaultShippingFeeFixed: 25.0,
    defaultDeliveryTimeMin: 3,
    defaultDeliveryTimeMax: 7,
    returnPolicy:
      "Return within 14 days. Items must be in original condition with all tags attached.",
  },
  {
    name: "MAISON LUXE",
    description:
      "MAISON LUXE brings you an exquisite selection of haute couture and ready-to-wear fashion from the worlds most prestigious ateliers. Experience the art of dressing with pieces that blend classic elegance and contemporary vision.",
    email: `${p}store-maison@example.com`,
    phone: "+33142345602",
    url: "lux-maison-luxe",
    logo: defaultImage,
    cover: defaultImage,
    status: "ACTIVE",
    ownerEmail: `${p}seller-maison@example.com`,
    defaultShippingService: "Luxury Courier",
    defaultShippingFeePerItem: 20.0,
    defaultShippingFeeForAdditionalItem: 8.0,
    defaultShippingFeePerKg: 4.0,
    defaultShippingFeeFixed: 30.0,
    defaultDeliveryTimeMin: 5,
    defaultDeliveryTimeMax: 10,
    returnPolicy:
      "Return within 30 days. Items must be unworn with original packaging.",
  },
  {
    name: "ATELIER DIVINE",
    description:
      "At ATELIER DIVINE we celebrate the artistry of handcrafted luxury accessories. Each piece in our collection is meticulously crafted by master artisans using heritage techniques passed down through generations of skilled craftspeople.",
    email: `${p}store-atelier@example.com`,
    phone: "+39065345603",
    url: "lux-atelier-divine",
    logo: defaultImage,
    cover: defaultImage,
    status: "ACTIVE",
    ownerEmail: `${p}seller-atelier@example.com`,
    defaultShippingService: "Artisan Delivery",
    defaultShippingFeePerItem: 12.0,
    defaultShippingFeeForAdditionalItem: 4.0,
    defaultShippingFeePerKg: 2.5,
    defaultShippingFeeFixed: 20.0,
    defaultDeliveryTimeMin: 4,
    defaultDeliveryTimeMax: 8,
    returnPolicy:
      "Return within 14 days. Jewelry items must be in unworn condition.",
  },
  {
    name: "VELVET CROWN",
    description:
      "VELVET CROWN presents a carefully curated selection of royal inspired luxury fashion and accessories. Our collections draw inspiration from noble heritage and aristocratic elegance reinterpreted for the modern sophisticated individual.",
    email: `${p}store-velvet@example.com`,
    phone: "+44207345604",
    url: "lux-velvet-crown",
    logo: defaultImage,
    cover: defaultImage,
    status: "ACTIVE",
    ownerEmail: `${p}seller-velvet@example.com`,
    defaultShippingService: "Royal Express",
    defaultShippingFeePerItem: 18.0,
    defaultShippingFeeForAdditionalItem: 6.0,
    defaultShippingFeePerKg: 3.5,
    defaultShippingFeeFixed: 28.0,
    defaultDeliveryTimeMin: 3,
    defaultDeliveryTimeMax: 7,
    returnPolicy:
      "Return within 21 days. Bags and shoes must include original dust bags.",
  },
  {
    name: "ORO PALAZZO",
    description:
      "ORO PALAZZO specializes in Italian crafted luxury goods that embody the spirit of Mediterranean glamour and artisanal excellence. From sumptuous leathers to precious metals every piece tells a story of unparalleled craftsmanship.",
    email: `${p}store-oro@example.com`,
    phone: "+39024345605",
    url: "lux-oro-palazzo",
    logo: defaultImage,
    cover: defaultImage,
    status: "ACTIVE",
    ownerEmail: `${p}seller-oro@example.com`,
    defaultShippingService: "Italian Express",
    defaultShippingFeePerItem: 16.0,
    defaultShippingFeeForAdditionalItem: 5.0,
    defaultShippingFeePerKg: 3.0,
    defaultShippingFeeFixed: 22.0,
    defaultDeliveryTimeMin: 4,
    defaultDeliveryTimeMax: 9,
    returnPolicy:
      "Return within 14 days. Watches must include warranty card and all accessories.",
  },
  {
    name: "LUMIERE PARIS",
    description:
      "LUMIERE PARIS captures the essence of Parisian chic with a collection that balances effortless sophistication and bold contemporary design. Our pieces are designed for those who seek to illuminate every room with timeless French elegance.",
    email: `${p}store-lumiere@example.com`,
    phone: "+33156345606",
    url: "lux-lumiere-paris",
    logo: defaultImage,
    cover: defaultImage,
    status: "ACTIVE",
    ownerEmail: `${p}seller-lumiere@example.com`,
    defaultShippingService: "Paris Express",
    defaultShippingFeePerItem: 14.0,
    defaultShippingFeeForAdditionalItem: 5.0,
    defaultShippingFeePerKg: 2.8,
    defaultShippingFeeFixed: 24.0,
    defaultDeliveryTimeMin: 3,
    defaultDeliveryTimeMax: 8,
    returnPolicy:
      "Return within 30 days. All items must be in original condition.",
  },
];
