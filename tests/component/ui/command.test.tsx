/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";

describe("Command (snapshot)", () => {
    // CommandDialog 内の DialogContent は Radix accessibility のため DialogTitle を要求するが、
    // snapshot 用最小構成では省略する。発生する console.error は出力ノイズになるため抑制。
    let errorSpy: jest.SpyInstance;
    beforeEach(() => {
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        errorSpy.mockRestore();
    });

    it("renders inline Command with items", () => {
        const { container } = render(
            <Command>
                <CommandInput placeholder="Type a command" />
                <CommandList>
                    <CommandEmpty>No results.</CommandEmpty>
                    <CommandGroup heading="Suggestions">
                        <CommandItem>Calendar</CommandItem>
                        <CommandItem>Search</CommandItem>
                    </CommandGroup>
                </CommandList>
            </Command>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders CommandDialog in open state", () => {
        render(
            <CommandDialog open>
                <CommandInput placeholder="Type a command" />
                <CommandList>
                    <CommandGroup heading="Suggestions">
                        <CommandItem>Settings</CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        );
        // CommandDialog は内部で Dialog/DialogContent をラップするため role="dialog" の styled div として描画される。
        expect(screen.getByRole("dialog")).toMatchSnapshot();
    });
});
