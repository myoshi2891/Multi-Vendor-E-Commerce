"use client";

import { AreaChart } from "@tremor/react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { SalesPoint } from "@/queries/dashboard";

interface Props {
    data: SalesPoint[];
    period?: "daily" | "monthly";
}

export function SalesChart({ data, period = "monthly" }: Props) {
    const title = period === "daily" ? "直近 30 日の売上推移" : "直近 12 ヶ月の売上推移";

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <AreaChart
                    className="h-56"
                    data={data}
                    index="label"
                    categories={["revenue"]}
                    colors={["slate"]}
                    valueFormatter={(v: number) =>
                        `$${v.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}`
                    }
                    showLegend={false}
                />
            </CardContent>
        </Card>
    );
}
