/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import DesignPage from "@/components/store/shared/design-page/design-page";

it("opts into the purchase theme while retaining the editorial landmarks", () => {
    render(<DesignPage {...{ appearance: "purchase" as const }} title="Support" eyebrow="Care" description="Help"><p>Existing content</p></DesignPage>);
    expect(screen.getByRole("main")).toHaveAttribute("data-appearance", "purchase");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Support");
    expect(within(screen.getByRole("navigation", {name: "Breadcrumb"})).getByRole("link", {name: "Home"})).toHaveAttribute("href", "/");
    expect(screen.getByText("Existing content")).toBeVisible();
});
it("keeps the default appearance for existing callers", () => {
    render(<DesignPage title="Legal" eyebrow="Information" description="Policies"><p>Terms</p></DesignPage>);
    expect(screen.getByRole("main")).not.toHaveAttribute("data-appearance", "purchase");
    expect(screen.getByText("Terms")).toBeVisible();
});
