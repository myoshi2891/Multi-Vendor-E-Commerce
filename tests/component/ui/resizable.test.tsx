/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";

describe("Resizable (snapshot)", () => {
    it("renders horizontal group", () => {
        const { container } = render(
            <ResizablePanelGroup direction="horizontal">
                <ResizablePanel defaultSize={50}>Left</ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={50}>Right</ResizablePanel>
            </ResizablePanelGroup>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders vertical group with handle indicator", () => {
        const { container } = render(
            <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={50}>Top</ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50}>Bottom</ResizablePanel>
            </ResizablePanelGroup>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
