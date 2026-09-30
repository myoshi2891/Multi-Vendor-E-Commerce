/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { currentUser } from "@clerk/nextjs/server";
import ProfileOverview from "@/components/store/profile/overview";
import OrdersOverview from "@/components/store/profile/orders-overview";

jest.mock("@clerk/nextjs/server", () => ({ currentUser: jest.fn() }));
jest.mock("next/image", () => ({
    __esModule: true,
    default: ({
        priority: _priority,
        ...props
    }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
        <img {...props} />
    ),
}));
const mockUser = jest.mocked(currentUser);

describe("Profile overview", () => {
    beforeEach(() => {
        mockUser.mockReset();
        mockUser.mockResolvedValue({
            fullName: "McDonald Customer",
            imageUrl: "/avatar.jpg",
        } as Awaited<ReturnType<typeof currentUser>>);
    });
    it("preserves customer name casing and image, with a settings link", async () => {
        render(await ProfileOverview());
        expect(
            screen.getByRole("heading", { level: 2, name: "McDonald Customer" })
        ).toBeVisible();
        expect(screen.getByRole("img")).toHaveAttribute(
            "alt",
            "McDonald Customer"
        );
        expect(
            screen.getByRole("link", { name: /Account settings/ })
        ).toHaveAttribute("href", "/profile/settings");
    });
    it("keeps the existing supported shortcuts and marks unimplemented features as unavailable", async () => {
        render(await ProfileOverview());
        const nav = screen.getByRole("navigation", {
            name: "Account shortcuts",
        });
        for (const [name, href] of [
            ["Wishlist", "/profile/wishlist"],
            ["Following", "/profile/following/1"],
            ["Viewed", "/profile/history/1"],
        ]) {
            expect(
                within(nav).getByRole("link", { name: new RegExp(name) })
            ).toHaveAttribute("href", href);
        }
        expect(
            screen.queryByRole("link", { name: /Coupons|Shopping credit/ })
        ).not.toBeInTheDocument();
        expect(screen.getAllByText("Coming soon")).toHaveLength(2);
    });
    it("shows a fallback when the customer has no full name", async () => {
        mockUser.mockResolvedValue({
            fullName: null,
            imageUrl: "/avatar.jpg",
        } as Awaited<ReturnType<typeof currentUser>>);
        render(await ProfileOverview());
        expect(
            screen.getByRole("heading", { name: "Your account" })
        ).toBeVisible();
    });
    it("does not render private identity details without a user", async () => {
        mockUser.mockResolvedValue(null);
        const { container } = render(await ProfileOverview());
        expect(container).toBeEmptyDOMElement();
    });
    it("provides readable retry feedback if identity lookup fails", async () => {
        mockUser.mockRejectedValue(new Error("Clerk unavailable"));
        render(await ProfileOverview());
        expect(screen.getByRole("alert")).toHaveTextContent(
            "Account details are unavailable"
        );
        expect(
            screen.getByRole("link", { name: "Reload account" })
        ).toHaveAttribute("href", "/profile");
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
});

describe("Profile orders overview", () => {
    it("uses a labelled section and keeps all four order filter destinations", () => {
        render(<OrdersOverview />);
        const section = screen.getByRole("region", { name: "My orders" });
        expect(
            within(section).getByRole("link", { name: /View all orders/ })
        ).toHaveAttribute("href", "/profile/orders");
        for (const [name, filter] of [
            ["Unpaid", "unpaid"],
            ["To be shipped", "toShip"],
            ["Shipped", "shipped"],
            ["Delivered", "delivered"],
        ]) {
            expect(
                within(section).getByRole("link", { name: new RegExp(name) })
            ).toHaveAttribute("href", `/profile/orders/${filter}`);
        }
    });
    it("makes support actions real links", () => {
        render(<OrdersOverview />);
        expect(
            screen.getByRole("link", { name: /Order support/ })
        ).toHaveAttribute("href", "/contact");
        expect(
            screen.getByRole("link", { name: /Open a dispute/ })
        ).toHaveAttribute("href", "/dispute");
    });
});
