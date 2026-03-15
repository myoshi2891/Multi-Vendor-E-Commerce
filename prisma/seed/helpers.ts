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
 * 決定論的なUUID形式のIDを生成する（RFC4122 UUID v5 準拠、SHA-1使用）
 * 同一入力に対して常に同一のIDを返す（冪等性のため）
 * @param seedKey - ID生成のシードキー
 * @returns RFC4122 UUID v5形式の文字列
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
