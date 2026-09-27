import type { SeedProduct } from "../../types";

import { STORE_PRODUCTS as NOIR_ELEGANCE_PRODUCTS } from "./noir-elegance";
import { STORE_PRODUCTS as MAISON_LUXE_PRODUCTS } from "./maison-luxe";
import { STORE_PRODUCTS as ATELIER_DIVINE_PRODUCTS } from "./atelier-divine";
import { STORE_PRODUCTS as VELVET_CROWN_PRODUCTS } from "./velvet-crown";
import { STORE_PRODUCTS as ORO_PALAZZO_PRODUCTS } from "./oro-palazzo";
import { STORE_PRODUCTS as LUMIERE_PARIS_PRODUCTS } from "./lumiere-paris";
import { PILOT_PRODUCTS } from "./pilot";

/** ファッション 6 店舗の商品（各 6 商品 = 36 商品） */
export const FASHION_SEED_PRODUCTS: SeedProduct[] = [
  ...NOIR_ELEGANCE_PRODUCTS,
  ...MAISON_LUXE_PRODUCTS,
  ...ATELIER_DIVINE_PRODUCTS,
  ...VELVET_CROWN_PRODUCTS,
  ...ORO_PALAZZO_PRODUCTS,
  ...LUMIERE_PARIS_PRODUCTS,
];

/** 全商品（ファッション 36 + カテゴリ別属性のパイロット 2 = 38 商品） */
export const ALL_SEED_PRODUCTS: SeedProduct[] = [
  ...FASHION_SEED_PRODUCTS,
  ...PILOT_PRODUCTS,
];

export {
  NOIR_ELEGANCE_PRODUCTS,
  MAISON_LUXE_PRODUCTS,
  ATELIER_DIVINE_PRODUCTS,
  VELVET_CROWN_PRODUCTS,
  ORO_PALAZZO_PRODUCTS,
  LUMIERE_PARIS_PRODUCTS,
  PILOT_PRODUCTS,
};
