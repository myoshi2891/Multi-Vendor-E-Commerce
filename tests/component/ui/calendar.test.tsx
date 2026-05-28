/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Calendar } from "@/components/ui/calendar";

// 固定日付で「今日」依存の非決定性を排除する。month を渡さないと day_today
// クラスが現在日に付与され、スナップショットが日次で破綻する。
// new Date("2026-01-15") は UTC 解釈で TZ オフセットにより前日にずれるため、
// ローカル時刻のコンストラクタ (year, monthIndex, day) を使う（month は 0-indexed）。
const FIXED_DATE = new Date(2026, 0, 15);

describe("Calendar (snapshot)", () => {
    it("renders single-month with fixed selected date", () => {
        const { container } = render(
            <Calendar
                mode="single"
                month={FIXED_DATE}
                selected={FIXED_DATE}
            />
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
