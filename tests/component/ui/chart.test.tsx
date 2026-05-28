/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Bar, BarChart, Line, LineChart } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

const data = [
    { name: "A", value: 30 },
    { name: "B", value: 80 },
    { name: "C", value: 45 },
];

const config: ChartConfig = {
    value: { label: "Value", color: "hsl(220, 70%, 50%)" },
};

describe("Chart (snapshot)", () => {
    // recharts ResponsiveContainer は jsdom で親要素サイズを 0×0 と読み、警告を出す。
    // この警告はテスト出力ノイズになるが、ChartContainer の class 合成 / ChartStyle 注入の
    // スナップショット検証には影響しない。
    let warnSpy: jest.SpyInstance;
    beforeEach(() => {
        warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => {
        warnSpy.mockRestore();
    });

    it("renders BarChart container", () => {
        const { container } = render(
            <ChartContainer config={config} id="bar-fixture">
                <BarChart data={data} width={300} height={200}>
                    <Bar dataKey="value" fill="var(--color-value)" />
                </BarChart>
            </ChartContainer>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders LineChart container", () => {
        const { container } = render(
            <ChartContainer config={config} id="line-fixture">
                <LineChart data={data} width={300} height={200}>
                    <Line dataKey="value" stroke="var(--color-value)" />
                </LineChart>
            </ChartContainer>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
