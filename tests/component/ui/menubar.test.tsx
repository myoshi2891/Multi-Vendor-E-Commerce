/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarShortcut,
    MenubarTrigger,
} from "@/components/ui/menubar";

describe("Menubar (snapshot)", () => {
    it("renders Menubar in closed state", () => {
        const { container } = render(
            <Menubar>
                <MenubarMenu value="file">
                    <MenubarTrigger>File</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem>New</MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
            </Menubar>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders MenubarContent in defaultValue-opened state", () => {
        render(
            <Menubar defaultValue="file">
                <MenubarMenu value="file">
                    <MenubarTrigger>File</MenubarTrigger>
                    <MenubarContent>
                        <MenubarItem>
                            New
                            <MenubarShortcut>⌘N</MenubarShortcut>
                        </MenubarItem>
                        <MenubarSeparator />
                        <MenubarItem>Open...</MenubarItem>
                    </MenubarContent>
                </MenubarMenu>
            </Menubar>
        );
        // MenubarContent は role="menu" の styled div として描画される。
        expect(screen.getByRole("menu")).toMatchSnapshot();
    });
});
