/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuShortcut,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";

describe("ContextMenu (snapshot)", () => {
    it("renders trigger in closed state", () => {
        const { container } = render(
            <ContextMenu>
                <ContextMenuTrigger>Right-click here</ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem>Copy</ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders ContextMenuContent after contextmenu event", () => {
        render(
            <ContextMenu>
                <ContextMenuTrigger>Right-click here</ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuLabel>Actions</ContextMenuLabel>
                    <ContextMenuSeparator />
                    <ContextMenuItem>
                        Copy
                        <ContextMenuShortcut>⌘C</ContextMenuShortcut>
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        );
        // ContextMenu には defaultOpen が無いため、トリガー要素に contextmenu イベントを発火する。
        fireEvent.contextMenu(screen.getByText("Right-click here"));
        // ContextMenuContent は role="menu" の styled div として描画される。
        expect(screen.getByRole("menu")).toMatchSnapshot();
    });
});
