/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";

describe("Sheet (snapshot)", () => {
    it("renders trigger in closed state", () => {
        const { container } = render(
            <Sheet>
                <SheetTrigger>Open</SheetTrigger>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Title</SheetTitle>
                    </SheetHeader>
                </SheetContent>
            </Sheet>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders SheetContent in defaultOpen state (right side)", () => {
        render(
            <Sheet defaultOpen>
                <SheetTrigger>Open</SheetTrigger>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Title</SheetTitle>
                        <SheetDescription>Body</SheetDescription>
                    </SheetHeader>
                    <SheetFooter>
                        <button type="button">OK</button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        );
        // SheetContent は Radix Dialog 由来で role="dialog" の styled div として描画される。
        expect(screen.getByRole("dialog")).toMatchSnapshot();
    });

    it("renders SheetContent with side=left variant", () => {
        render(
            <Sheet defaultOpen>
                <SheetTrigger>Open</SheetTrigger>
                <SheetContent side="left">
                    <SheetHeader>
                        <SheetTitle>Left side</SheetTitle>
                    </SheetHeader>
                </SheetContent>
            </Sheet>
        );
        expect(screen.getByRole("dialog")).toMatchSnapshot();
    });
});
