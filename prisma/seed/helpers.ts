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
 * Zod制約の正規表現定数
 * src/lib/schemas.ts と同一パターン（"use client" のため直接 import できない）
 */
export const NAME_REGEX = /^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_ -]+$/;
export const URL_REGEX = /^(?!.*(?:[-_ ]){2,})[a-zA-Z0-9_-]+$/;
export const CATEGORY_NAME_REGEX = /^[a-zA-Z0-9\s]+$/;
export const PHONE_REGEX = /^\+?\d+$/;

/**
 * Convert a string into a URL-safe slug and prepend an optional prefix.
 *
 * @param input - The source string to convert into a slug
 * @param prefix - Prefix to prepend to the slug (default: `SEED_PREFIX`)
 * @returns The resulting URL-safe slug string
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
 * Build a SKU string in the form "STORE-CATEGORY-SEQ[-VARIANT]".
 *
 * @param storeCode - Store code (e.g., "NOIR")
 * @param categoryCode - Category code (e.g., "WC" for Women's Coats)
 * @param sequence - Numeric sequence, padded to three digits (e.g., 1 -> "001")
 * @param variantSuffix - Optional variant suffix appended after a final hyphen (e.g., "BLK")
 * @returns The formatted SKU string, for example "NOIR-WC-001" or "NOIR-WC-001-BLK"
 * @throws Error if the resulting SKU length is less than 6 or greater than 50 characters
 */
export function generateSku(
  storeCode: string,
  categoryCode: string,
  sequence: number,
  variantSuffix?: string
): string {
  const seq = String(sequence).padStart(3, "0");
  const base = `${storeCode}-${categoryCode}-${seq}`;
  const sku = variantSuffix ? `${base}-${variantSuffix}` : base;

  // Zod 制約チェック（SKU は 6-50字）
  if (sku.length < 6 || sku.length > 50) {
    throw new Error(
      `SKU長が範囲外です（6-50字）: "${sku}" (${sku.length}字)`
    );
  }

  return sku;
}

/**
 * Generate a deterministic RFC4122 UUID v5–style identifier from a seed key.
 *
 * Uses SHA-1 over a fixed namespace and the provided `seedKey` to produce a
 * UUID-like string with version 5 and RFC4122 variant bits set; the same
 * `seedKey` always yields the same identifier.
 *
 * @param seedKey - The seed value used to derive the identifier; identical seeds produce identical IDs
 * @returns A UUID-like string formatted with UUID v5 version and RFC4122 variant bits
 */
export function generateDeterministicId(seedKey: string): string {
  const namespace = "lux-seed-namespace";
  const hash = createHash("sha1")
    .update(`${namespace}:${seedKey}`)
    .digest("hex");

  // RFC4122 UUID v5 形式に変換（SHA-1の最初の16バイト = 32 hex文字を使用）
  const uuid = [
    hash.substring(0, 8),
    hash.substring(8, 12),
    // version bits: 5xxx (UUID v5)
    `5${hash.substring(13, 16)}`,
    // variant bits: [89ab]xxx (RFC4122)
    `${(parseInt(hash.substring(16, 18), 16) & 0x3f | 0x80).toString(16).padStart(2, "0")}${hash.substring(18, 20)}`,
    hash.substring(20, 32),
  ].join("-");

  return uuid;
}
