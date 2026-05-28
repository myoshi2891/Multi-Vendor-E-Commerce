/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";

describe("HoverCard (snapshot)", () => {
    it("renders trigger in closed state", () => {
        const { container } = render(
            <HoverCard>
                <HoverCardTrigger>Hover</HoverCardTrigger>
                <HoverCardContent>Card body</HoverCardContent>
            </HoverCard>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders HoverCardContent in defaultOpen state", () => {
        render(
            <HoverCard defaultOpen>
                <HoverCardTrigger>Hover</HoverCardTrigger>
                <HoverCardContent>Card body</HoverCardContent>
            </HoverCard>
        );
        // HoverCardContent には role が無いため、テキストノード ("Card body") を直接含む styled div
        // (= HoverCardContent 自体) を getByText で取得する。document.body 全体や popper wrapper を含めると
        // Radix の floating-ui 由来の transform / focus-guard を取り込み flake 源となる。
        expect(screen.getByText("Card body")).toMatchSnapshot();
    });
});
