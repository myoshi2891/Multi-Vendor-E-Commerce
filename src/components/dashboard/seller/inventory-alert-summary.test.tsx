/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import InventoryAlertSummary from "@/components/dashboard/seller/inventory-alert-summary";
import type { StoreInventoryRow } from "@/lib/types";

// F2 在庫アラートサマリー: 行データを getStockStatus（@/lib/utils）で集計し、
// 「在庫切れ（out）」「過小在庫（low）」の件数を表示するマッピングを検証する。
// 判定境界そのものは utils.test.ts / badge テストが担保するため、ここでは
// 「ステータス → 件数集計・表示」に集中し、行バッジと同じ境界で数えることを確認する。
describe("InventoryAlertSummary", () => {
    const THRESHOLD = 5;

    /** quantity だけ差し替えた最小 StoreInventoryRow を作る */
    function rowWithQuantity(quantity: number): StoreInventoryRow {
        return {
            sizeId: `size-${quantity}`,
            productName: "T-Shirt",
            variantName: "Red",
            size: "M",
            quantity,
            price: 19.9,
            sku: `SKU-${quantity}`,
            productSlug: "t-shirt",
            variantId: "variant-1",
        };
    }

    /** ラベル（「在庫切れ」等）を起点に、同じカード内の件数テキストを取得する */
    function countForLabel(label: string): string {
        const card = screen.getByText(label).closest("div");
        if (!card) throw new Error(`card not found for label: ${label}`);
        // カードは <p>ラベル</p><p>件数</p> 構成。ラベル以外の <p> を件数とみなす。
        const paragraphs = Array.from(card.querySelectorAll("p"));
        const countNode = paragraphs.find((p) => p.textContent !== label);
        if (!countNode) throw new Error(`count not found for label: ${label}`);
        return countNode.textContent ?? "";
    }

    it("counts out-of-stock and low-stock rows from a mixed inventory", () => {
        // Arrange: out=2(0,0) / low=3(threshold ちょうど) / ok=1(threshold+1)
        const rows = [
            rowWithQuantity(0),
            rowWithQuantity(0),
            rowWithQuantity(THRESHOLD),
            rowWithQuantity(THRESHOLD),
            rowWithQuantity(THRESHOLD),
            rowWithQuantity(THRESHOLD + 1),
        ];

        // Act
        render(<InventoryAlertSummary rows={rows} threshold={THRESHOLD} />);

        // Assert
        expect(countForLabel("在庫切れ")).toBe("2");
        expect(countForLabel("過小在庫")).toBe("3");
    });

    it("counts the threshold boundary as low and threshold+1 as in-stock (excluded)", () => {
        // Arrange: 境界一致を行バッジと揃える（0→out / threshold→low / threshold+1→ok）
        const rows = [
            rowWithQuantity(0),
            rowWithQuantity(THRESHOLD),
            rowWithQuantity(THRESHOLD + 1),
        ];

        // Act
        render(<InventoryAlertSummary rows={rows} threshold={THRESHOLD} />);

        // Assert: ok 行はどちらにも算入されない
        expect(countForLabel("在庫切れ")).toBe("1");
        expect(countForLabel("過小在庫")).toBe("1");
    });

    it("renders zero counts for an empty inventory", () => {
        // Arrange / Act
        render(<InventoryAlertSummary rows={[]} threshold={THRESHOLD} />);

        // Assert
        expect(countForLabel("在庫切れ")).toBe("0");
        expect(countForLabel("過小在庫")).toBe("0");
    });
});
