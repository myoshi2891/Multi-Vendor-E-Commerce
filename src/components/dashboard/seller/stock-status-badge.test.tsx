/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import StockStatusBadge from "@/components/dashboard/seller/stock-status-badge";

// F2-5 在庫ステータスバッジ: getStockStatus の境界（0→out / threshold→low / threshold+1→ok）を
// ラベルと variant（色）の両面で検証する。判定ロジック自体は utils.test.ts が担保するため、
// ここでは「ステータス → 表示」のマッピングに集中する。
describe("StockStatusBadge", () => {
    const THRESHOLD = 5;

    it("renders the out-of-stock badge (quantity <= 0) with destructive styling", () => {
        render(<StockStatusBadge quantity={0} threshold={THRESHOLD} />);
        const badge = screen.getByText("在庫切れ");
        expect(badge).toBeInTheDocument();
        expect(badge.className).toContain("destructive");
    });

    it("renders the low-stock badge at the threshold boundary with warning styling", () => {
        render(<StockStatusBadge quantity={THRESHOLD} threshold={THRESHOLD} />);
        const badge = screen.getByText("残りわずか");
        expect(badge).toBeInTheDocument();
        expect(badge.className).toContain("warning");
    });

    it("renders the in-stock badge just above the threshold", () => {
        render(
            <StockStatusBadge quantity={THRESHOLD + 1} threshold={THRESHOLD} />
        );
        expect(screen.getByText("在庫あり")).toBeInTheDocument();
    });
});
