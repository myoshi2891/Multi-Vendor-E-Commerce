/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { StoreDetailsType } from "@/lib/types";
import StoreDetails from "@/components/store/store-page/store-details";

const createDetails = (overrides: Partial<StoreDetailsType> = {}): StoreDetailsType => ({
    id: "s1",
    name: "Acme",
    description: "Handmade goods.",
    logo: "/logo.png",
    cover: "/cover.png",
    averageRating: 4.25,
    numReviews: 1200,
    ...overrides,
});

it("店舗名・説明・評価とレビュー件数（複数形）を表示する", () => {
    render(<StoreDetails details={createDetails()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Acme.");
    expect(screen.getByText("Handmade goods.")).toBeInTheDocument();
    expect(screen.getByText("4.3 / 5")).toBeInTheDocument();
    expect(screen.getByText(`${new Intl.NumberFormat().format(1200)} reviews`)).toBeInTheDocument();
    expect(screen.getByAltText("Acme logo")).toBeInTheDocument();
    expect(screen.getByAltText("Acme cover")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Acme");
});

it("レビューが 1 件のときは単数形で表示する", () => {
    render(<StoreDetails details={createDetails({ numReviews: 1 })} />);

    expect(screen.getByText("1 review")).toBeInTheDocument();
});

it("レビューが無く説明も無いときは No reviews yet を表示し説明を描画しない", () => {
    render(<StoreDetails details={createDetails({ numReviews: 0, description: "" })} />);

    expect(screen.getByText("No reviews yet")).toBeInTheDocument();
    expect(screen.queryByText("Handmade goods.")).not.toBeInTheDocument();
    expect(screen.queryByText(/\/ 5/)).not.toBeInTheDocument();
});
