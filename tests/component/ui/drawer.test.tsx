/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";

describe("Drawer (snapshot)", () => {
    it("renders trigger in closed state", () => {
        const { container } = render(
            <Drawer>
                <DrawerTrigger>Open</DrawerTrigger>
                <DrawerContent>
                    <DrawerHeader>
                        <DrawerTitle>Title</DrawerTitle>
                    </DrawerHeader>
                </DrawerContent>
            </Drawer>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders DrawerContent in defaultOpen state", () => {
        render(
            <Drawer defaultOpen>
                <DrawerTrigger>Open</DrawerTrigger>
                <DrawerContent>
                    <DrawerHeader>
                        <DrawerTitle>Title</DrawerTitle>
                        <DrawerDescription>Body</DrawerDescription>
                    </DrawerHeader>
                    <DrawerFooter>
                        <button type="button">OK</button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        );
        // vaul の Drawer.Content は role="dialog" の styled div として描画される。
        expect(screen.getByRole("dialog")).toMatchSnapshot();
    });
});
