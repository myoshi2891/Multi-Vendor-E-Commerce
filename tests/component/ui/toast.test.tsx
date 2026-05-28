/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    Toast,
    ToastAction,
    ToastClose,
    ToastDescription,
    ToastProvider,
    ToastTitle,
    ToastViewport,
} from "@/components/ui/toast";

describe("Toast (snapshot)", () => {
    it("renders default Toast with title / description / action", () => {
        const { container } = render(
            <ToastProvider>
                <Toast open>
                    <ToastTitle>Saved</ToastTitle>
                    <ToastDescription>Your changes were saved.</ToastDescription>
                    <ToastAction altText="Undo">Undo</ToastAction>
                    <ToastClose />
                </Toast>
                <ToastViewport />
            </ToastProvider>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders destructive Toast variant", () => {
        const { container } = render(
            <ToastProvider>
                <Toast open variant="destructive">
                    <ToastTitle>Failed</ToastTitle>
                    <ToastDescription>Something went wrong.</ToastDescription>
                </Toast>
                <ToastViewport />
            </ToastProvider>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
