import type { SeedProduct } from "../../types";

import { STORE_PRODUCTS as NOIR_ELEGANCE_PRODUCTS } from "./noir-elegance";
import { STORE_PRODUCTS as MAISON_LUXE_PRODUCTS } from "./maison-luxe";
import { STORE_PRODUCTS as ATELIER_DIVINE_PRODUCTS } from "./atelier-divine";
import { STORE_PRODUCTS as VELVET_CROWN_PRODUCTS } from "./velvet-crown";
import { STORE_PRODUCTS as ORO_PALAZZO_PRODUCTS } from "./oro-palazzo";
import { STORE_PRODUCTS as LUMIERE_PARIS_PRODUCTS } from "./lumiere-paris";

/** 全店舗の商品データを結合した配列（36商品） */
export const ALL_SEED_PRODUCTS: SeedProduct[] = [
  ...NOIR_ELEGANCE_PRODUCTS,
  ...MAISON_LUXE_PRODUCTS,
  ...ATELIER_DIVINE_PRODUCTS,
  ...VELVET_CROWN_PRODUCTS,
  ...ORO_PALAZZO_PRODUCTS,
  ...LUMIERE_PARIS_PRODUCTS,
];

export {
  NOIR_ELEGANCE_PRODUCTS,
  MAISON_LUXE_PRODUCTS,
  ATELIER_DIVINE_PRODUCTS,
  VELVET_CROWN_PRODUCTS,
  ORO_PALAZZO_PRODUCTS,
  LUMIERE_PARIS_PRODUCTS,
};
