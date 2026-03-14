/**
 * Seed ヘルパー関数
 * slug生成、SKU生成、決定論的ID生成
 */

import { createHash } from "crypto";

/** seedデータのプレフィクス（URL/slug用） */
export const SEED_PREFIX = "lux-";

/** seedデータのプレフィクス（email用） */
export const SEED_EMAIL_PREFIX = "lux-seed-";

/**
 * 文字列をURL安全なslugに変換する
 * @param input - 変換元の文字列
 * @param prefix - slugに付与するプレフィクス（デフォルト: SEED_PREFIX）
 * @returns URL安全なslug文字列
 */
export function slugify(input: string, prefix: string = SEED_PREFIX): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // 英数字・スペース・ハイフン以外を除去
    .replace(/[\s-]+/g, "-") // スペース・連続ハイフンを1つのハイフンに
    .replace(/^-+|-+$/g, ""); // 先頭・末尾のハイフンを除去

  return `${prefix}${slug}`;
}

/**
 * SKU（Stock Keeping Unit）を生成する
 * @param storeCode - 店舗コード（例: "NOIR"）
 * @param categoryCode - カテゴリコード（例: "WC" = Women's Coats）
 * @param sequence - 連番
 * @param variantSuffix - バリアントサフィックス（例: "BLK"）
 * @returns SKU文字列（例: "NOIR-WC-001-BLK"）
 */
export function generateSku(
  storeCode: string,
  categoryCode: string,
  sequence: number,
  variantSuffix?: string
): string {
  const seq = String(sequence).padStart(3, "0");
  const base = `${storeCode}-${categoryCode}-${seq}`;
  return variantSuffix ? `${base}-${variantSuffix}` : base;
}

/**
 * 決定論的なUUID形式のIDを生成する
 * 同一入力に対して常に同一のIDを返す（冪等性のため）
 * @param seedKey - ID生成のシードキー
 * @returns UUID形式の文字列
 */
export function generateDeterministicId(seedKey: string): string {
  const namespace = "lux-seed-namespace";
  const hash = createHash("sha256")
    .update(`${namespace}:${seedKey}`)
    .digest("hex");

  // SHA-256ハッシュからUUID形式に変換
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32),
  ].join("-");
}
