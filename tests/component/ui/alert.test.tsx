/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

describe("Alert (snapshot)", () => {
    it("renders default variant", () => {
        const { container } = render(
            <Alert>
                <AlertDescription>Default alert body</AlertDescription>
            </Alert>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders destructive variant", () => {
        const { container } = render(
            <Alert variant="destructive">
                <AlertDescription>Destructive alert body</AlertDescription>
            </Alert>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders with title and description", () => {
        const { container } = render(
            <Alert>
                <AlertTitle>Heads up</AlertTitle>
                <AlertDescription>Body text</AlertDescription>
            </Alert>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
