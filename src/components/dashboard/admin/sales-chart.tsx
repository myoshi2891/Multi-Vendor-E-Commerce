"use client";

import styles from "../design/seller.module.css";
import { AreaChart, type CustomTooltipProps } from "@tremor/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SalesPoint } from "@/queries/dashboard";

interface Props {
    data: SalesPoint[];
    design?: "seller";
    period?: "daily" | "monthly";
}

const formatRevenue = (value: number) =>
    `$${value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

// Y 軸目盛り用。8 桁の売上（$12,345,678.90）は yAxisWidth に収まらないため短縮表記にする。
// 全額は SalesTooltip が formatRevenue で表示する。
const compactRevenueFormat = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
});
const formatCompactRevenue = (value: number) => compactRevenueFormat.format(value);

function SalesTooltip({ active, payload, label }: CustomTooltipProps) {
    if (!active || !payload?.length) return null;
    return (
        <div role="tooltip" className={styles.chartTooltip}>
            <p>{label}</p>
            {payload.filter((entry) => entry.type !== "none").map((entry, index) => (
                <p key={index}>
                    <span>{entry.name}</span>{" "}
                    <strong>{typeof entry.value === "number" ? formatRevenue(entry.value) : String(entry.value ?? "")}</strong>
                </p>
            ))}
        </div>
    );
}

/**
 * Renders a chart card displaying sales revenue trends with values formatted as USD currency.
 *
 * @param props.period - The time period for the chart; "daily" displays the last 30 days, "monthly" displays the last 12 months. Defaults to "monthly".
 */
export function SalesChart({ data, period = "monthly", design }: Props) {
    const title =
        period === "daily" ? "直近 30 日の売上推移" : "直近 12 ヶ月の売上推移";

    return (
        <Card className={design === "seller" ? styles.chart : undefined}>
            <CardHeader>
                {design === "seller" ? (
                    <h2>{title}</h2>
                ) : (
                    <CardTitle>{title}</CardTitle>
                )}
            </CardHeader>
            <CardContent>
                {design === "seller" && data.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        売上データがありません。
                    </p>
                ) : (
                    <AreaChart
                        className="h-56"
                        data={data}
                        index="label"
                        categories={["revenue"]}
                        colors={[design === "seller" ? "amber" : "slate"]}
                        valueFormatter={design === "seller" ? formatCompactRevenue : formatRevenue}
                        customTooltip={design === "seller" ? SalesTooltip : undefined}
                        yAxisWidth={design === "seller" ? 80 : undefined}
                        showLegend={false}
                    />
                )}
            </CardContent>
        </Card>
    );
}
