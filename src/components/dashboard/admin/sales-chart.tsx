"use client";

import styles from "../design/seller.module.css";
import { AreaChart } from "@tremor/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SalesPoint } from "@/queries/dashboard";

interface Props {
    data: SalesPoint[];
    design?: "seller";
    period?: "daily" | "monthly";
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
                        valueFormatter={(v: number) =>
                            `$${v.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}`
                        }
                        showLegend={false}
                    />
                )}
            </CardContent>
        </Card>
    );
}
