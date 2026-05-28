/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

describe("DropdownMenu (snapshot)", () => {
    it("renders trigger in closed state", () => {
        const { container } = render(
            <DropdownMenu>
                <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem>Profile</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders DropdownMenuContent in defaultOpen state", () => {
        render(
            <DropdownMenu defaultOpen>
                <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        Profile
                        <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuCheckboxItem checked>
                        Show toolbar
                    </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
        // DropdownMenuContent は role="menu" の styled div として描画される。
        expect(screen.getByRole("menu")).toMatchSnapshot();
    });
});
