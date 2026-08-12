import { ShippingFeeMethod } from "@prisma/client";

import { computeShippingTotal } from "./shipping-utils";

/**
 * computeShippingTotal の直接ユニットテスト (plan 010)
 *
 * `computeShippingTotal` は本リポジトリにおける配送料計算の SSOT であり、
 * `.claude/steering/tech.md` は「すべての配送料計算はこの関数を使う」ことを規約化している。
 * にもかかわらず**直接のユニットテストが存在せず**、統合テスト内でのみ間接的に実行されていた。
 *
 * そこでは期待値の算出にも `computeShippingTotal` 自身が使われている（自分自身をオラクルに
 * している）ため、**関数が一貫して間違っていても検出できない**。本ファイルはその穴を塞ぐ:
 * 期待値はすべて**手計算した定数をハードコード**しており、`computeShippingTotal` を呼んで
 * 導出したものは 1 つも無い。
 *
 * 関連:
 * - plans/010-unit-test-compute-shipping-total.md
 * - src/lib/shipping-utils.ts（検証対象。本テストでは 1 行も変更しない）
 */
describe("computeShippingTotal", () => {
    // ==================================================
    // quantity ガード（早期リターン）
    // ==================================================
    describe("quantity ガード", () => {
        it("[P1] quantity が 0 のとき 0 を返す", () => {
            // Arrange & Act
            const actual = computeShippingTotal(
                ShippingFeeMethod.ITEM,
                10,
                2,
                1,
                0
            );

            // Assert
            expect(actual).toBe(0);
        });

        it("[P1] quantity が負のとき 0 を返す", () => {
            // Arrange & Act
            const actual = computeShippingTotal(
                ShippingFeeMethod.FIXED,
                10,
                2,
                1,
                -3
            );

            // Assert
            expect(actual).toBe(0);
        });
    });

    // ==================================================
    // ITEM 方式: base + (quantity - 1) * extra
    // ==================================================
    describe("ITEM 方式", () => {
        it("[P1] 単数 (quantity=1) は追加料金が乗らず base のみ", () => {
            // Arrange & Act
            const actual = computeShippingTotal(
                ShippingFeeMethod.ITEM,
                10,
                2,
                1,
                1
            );

            // Assert: 追加分は (1 - 1) = 0 個なので base の 10 のみ
            expect(actual).toBe(10);
        });

        it("[P1] 複数は base + (quantity-1) * extra", () => {
            // Arrange & Act
            const actual = computeShippingTotal(
                ShippingFeeMethod.ITEM,
                10,
                2,
                1,
                3
            );

            // Assert: 10 + (3 - 1) * 2 = 14
            expect(actual).toBe(14);
        });
    });

    // ==================================================
    // WEIGHT 方式: fee * weight * quantity
    // ==================================================
    describe("WEIGHT 方式", () => {
        it("[P1] fee * weight * quantity を返す", () => {
            // Arrange & Act
            const actual = computeShippingTotal(
                ShippingFeeMethod.WEIGHT,
                5,
                0,
                2,
                3
            );

            // Assert: 5 * 2 * 3 = 30
            expect(actual).toBe(30);
        });

        it("[P1] 浮動小数点誤差を 2 桁に正規化する", () => {
            // Arrange & Act
            const actual = computeShippingTotal(
                ShippingFeeMethod.WEIGHT,
                0.1,
                0,
                0.1,
                3
            );

            // Assert: 0.1 * 0.1 * 3 は IEEE 754 では 0.030000000000000006 になる。
            // EPSILON 補正付きの 2 桁正規化で 0.03 に丸められること。
            expect(actual).toBe(0.03);
        });

        it("[P1] 丸め境界 (.xx5) は half-up で切り上げる", () => {
            // Arrange & Act
            const actual = computeShippingTotal(
                ShippingFeeMethod.WEIGHT,
                0.25,
                0,
                0.5,
                1
            );

            // Assert: 0.25 * 0.5 * 1 = 0.125。2 桁目の直後がちょうど 5 の丸め境界で、
            // Math.round は half-up のため 0.13 になる（0.12 への切り捨てではない）。
            // 上の float 正規化ケースとは別の分岐を突く入力であることに注意。
            expect(actual).toBe(0.13);
        });
    });

    // ==================================================
    // FIXED 方式: fee をそのまま返す
    // ==================================================
    describe("FIXED 方式", () => {
        it("[P1] weight / quantity / extra に依存せず fee を返す", () => {
            // Arrange & Act
            const actual = computeShippingTotal(
                ShippingFeeMethod.FIXED,
                25,
                99,
                99,
                4
            );

            // Assert: extra=99 / weight=99 / quantity=4 のいずれも無視され base の 25 のみ
            expect(actual).toBe(25);
        });
    });
});
