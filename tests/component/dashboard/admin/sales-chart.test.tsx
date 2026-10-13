/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { AreaChartProps, CustomTooltipProps } from "@tremor/react";
import { SalesChart } from "@/components/dashboard/admin/sales-chart";
import type { SalesPoint } from "@/queries/dashboard";

// AreaChart は SVG/Canvas を多用するため jsdom では動作しない。
// 描画は差し替えるが、渡された props（valueFormatter / customTooltip 等）は捕捉して検証する。
const mockAreaChart = jest.fn((_props: AreaChartProps) => (
    <div data-testid="area-chart" />
));
jest.mock("@tremor/react", () => ({
    AreaChart: (props: AreaChartProps) => mockAreaChart(props),
}));

const sampleData: SalesPoint[] = [
    { label: "2024-01", revenue: 100 },
    { label: "2024-02", revenue: 200 },
];

/** 直近の AreaChart 呼び出しで渡された props を返す */
const lastChartProps = (): AreaChartProps => {
    const props = mockAreaChart.mock.calls.at(-1)?.[0];
    if (!props) throw new Error("AreaChart が描画されていません");
    return props;
};

/** seller 描画で渡されたカスタムツールチップを取り出す */
const renderSellerTooltip = () => {
    render(<SalesChart data={sampleData} design="seller" />);
    const Tooltip = lastChartProps().customTooltip;
    if (!Tooltip) throw new Error("customTooltip が渡されていません");
    return Tooltip;
};

type TooltipPayload = NonNullable<CustomTooltipProps["payload"]>;

describe("SalesChart", () => {
    beforeEach(() => {
        mockAreaChart.mockClear();
    });

    it("正常系: period='monthly' のとき「直近 12 ヶ月の売上推移」を表示する", () => {
        // Arrange & Act
        render(<SalesChart data={sampleData} period="monthly" />);

        // Assert
        expect(screen.getByText("直近 12 ヶ月の売上推移")).toBeInTheDocument();
        expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    });

    it("正常系: period='daily' のとき「直近 30 日の売上推移」を表示する", () => {
        // Arrange & Act — period === "daily" 分岐をカバー
        render(<SalesChart data={sampleData} period="daily" />);

        // Assert
        expect(screen.getByText("直近 30 日の売上推移")).toBeInTheDocument();
    });

    it("正常系: デフォルト period は monthly になる", () => {
        // Arrange & Act — period 省略
        render(<SalesChart data={sampleData} />);

        // Assert
        expect(screen.getByText("直近 12 ヶ月の売上推移")).toBeInTheDocument();
    });

    it("正常系: データが空の場合でも描画エラーにならない", () => {
        // Arrange & Act
        render(<SalesChart data={[]} period="monthly" />);

        // Assert
        expect(screen.getByText("直近 12 ヶ月の売上推移")).toBeInTheDocument();
        expect(screen.getByTestId("area-chart")).toBeInTheDocument();
    });

    it("正常系: 既定デザインは slate 配色でカスタムツールチップと Y 軸幅を指定しない", () => {
        // Arrange & Act
        render(<SalesChart data={sampleData} />);

        // Assert — design !== "seller" 側の分岐
        const props = lastChartProps();
        expect(props.colors).toEqual(["slate"]);
        expect(props.customTooltip).toBeUndefined();
        expect(props.yAxisWidth).toBeUndefined();
    });

    it("正常系: seller デザインは amber 配色・カスタムツールチップ・Y 軸幅 80 を指定する", () => {
        // Arrange & Act
        render(<SalesChart data={sampleData} design="seller" />);

        // Assert
        const props = lastChartProps();
        expect(props.colors).toEqual(["amber"]);
        expect(props.customTooltip).toEqual(expect.any(Function));
        expect(props.yAxisWidth).toBe(80);
    });

    it("正常系: valueFormatter は USD 表記で小数 2 桁・桁区切り付きに整形する", () => {
        // Arrange
        render(<SalesChart data={sampleData} />);
        const format = lastChartProps().valueFormatter;

        // Act & Assert
        expect(format?.(1234.5)).toBe("$1,234.50");
        expect(format?.(0)).toBe("$0.00");
    });

    it("正常系: seller デザインでデータが空のときはチャートの代わりに空状態を表示する", () => {
        // Arrange & Act
        render(<SalesChart data={[]} design="seller" />);

        // Assert
        expect(screen.getByText("売上データがありません。")).toBeInTheDocument();
        expect(mockAreaChart).not.toHaveBeenCalled();
    });

    describe("SalesTooltip（seller）", () => {
        it("正常系: ラベルと数値系列を USD 表記で表示し、type='none' の系列は除外する", () => {
            // Arrange
            const Tooltip = renderSellerTooltip();
            const payload = [
                { name: "revenue", value: 1234.5, type: undefined },
                { name: "hidden", value: 99, type: "none" },
            ] as TooltipPayload;

            // Act
            render(<Tooltip active payload={payload} label="2024-01" />);

            // Assert
            const tooltip = screen.getByRole("tooltip");
            expect(tooltip).toHaveTextContent("2024-01");
            expect(tooltip).toHaveTextContent("revenue $1,234.50");
            expect(tooltip).not.toHaveTextContent("hidden");
        });

        it("正常系: 数値以外の値は文字列化し、値が無い場合は空で表示する", () => {
            // Arrange
            const Tooltip = renderSellerTooltip();
            const payload = [
                { name: "note", value: "n/a" },
                { name: "empty", value: undefined },
            ] as TooltipPayload;

            // Act
            render(<Tooltip active payload={payload} label="2024-02" />);

            // Assert
            const rows = screen.getByRole("tooltip").querySelectorAll("strong");
            expect(rows[0]).toHaveTextContent("n/a");
            expect(rows[1]).toBeEmptyDOMElement();
        });

        it("異常系: 非アクティブのときは何も描画しない", () => {
            // Arrange
            const Tooltip = renderSellerTooltip();
            const payload = [{ name: "revenue", value: 1 }] as TooltipPayload;

            // Act
            render(<Tooltip active={false} payload={payload} label="2024-01" />);

            // Assert
            expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
        });

        it("異常系: payload が空・未定義のときは何も描画しない", () => {
            // Arrange
            const Tooltip = renderSellerTooltip();

            // Act
            render(<Tooltip active payload={[]} label="2024-01" />);
            render(<Tooltip active payload={undefined} label="2024-01" />);

            // Assert
            expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
        });
    });
});
