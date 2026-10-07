/** @jest-environment node */

/**
 * seller の商品フォーム（`product-details.tsx`）が SSR で評価できること（OI-11・plan 083）。
 *
 * `"use client"` のモジュールも SSR 時にはサーバーで評価される。`jodit-react` の UMD は
 * モジュール評価時に `self` を参照するため、静的 import のままだと `self` の無い
 * サーバーで `ReferenceError: self is not defined` になる。node 環境で import を
 * 実行し、エディタの読み込みが評価時に走らないことを固定する。
 *
 * `jodit-react` は**モックしない**（モックすると検証対象の評価そのものが消える）。
 * Server Action は DB 接続を伴うため、配線に関係しない範囲でだけ差し替える。
 * `uuid` は ESM 配布で Jest が変換できないため差し替える（本番の SSR とは無関係）。
 */

jest.mock("@/queries/product", () => ({ upsertProduct: jest.fn() }));
jest.mock("@/queries/attribute", () => ({
    getEffectiveAttributeDefinitions: jest.fn(async () => []),
}));
jest.mock("uuid", () => ({ v4: () => "generated-uuid" }));

describe("ProductDetails の SSR 評価", () => {
    it("正常系: self の無い環境でもモジュールを評価できる", async () => {
        // Arrange
        expect(typeof globalThis.self).toBe("undefined");

        // Act
        const load = import("@/components/dashboard/forms/product-details");

        // Assert
        await expect(load).resolves.toHaveProperty("default");
    });
});
