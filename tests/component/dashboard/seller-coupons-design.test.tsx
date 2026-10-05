/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Page from "@/app/dashboard/seller/stores/[storeUrl]/coupons/page";
import { getStoreCoupons } from "@/queries/coupon";
import ModalProvider from "@/providers/modal-provider";
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
    useParams: () => ({ storeUrl: "example" }),
}));
jest.mock("@/queries/coupon", () => ({
    getStoreCoupons: jest.fn(),
    getCoupon: jest.fn(),
    upsertCoupon: jest.fn(),
    deleteCoupon: jest.fn(),
}));
jest.mock("@/queries/product", () => ({}));
jest.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: jest.fn() }),
}));
jest.mock("uuid", () => ({ v4: () => "new-coupon-id" }));
jest.mock("react-datetime-picker", () => ({
    __esModule: true,
    default: () => <input aria-label="Legacy date" />,
}));
const coupon = {
    id: "coupon-1",
    code: "WELCOME",
    discount: 10,
    startDate: "2026-10-01T00:00:00",
    endDate: "2026-12-01T00:00:00",
    scope: "STORE",
    storeId: "store-1",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
};
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getStoreCoupons).mockResolvedValue([coupon] as never);
});
it("labels coupons and filters by real coupon code", async () => {
    render(
        <ModalProvider>
            {await Page({ params: Promise.resolve({ storeUrl: "example" }) })}
        </ModalProvider>
    );
    expect(
        screen.getByRole("heading", { level: 1, name: "Coupons" })
    ).toBeVisible();
    const search = screen.getByRole("searchbox", {
        name: "Search coupon code ...",
    });
    fireEvent.change(search, { target: { value: "missing" } });
    expect(screen.queryByText("WELCOME")).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "WELCOME" } });
    expect(screen.getByText("WELCOME")).toBeVisible();
    expect(
        screen.getByRole("link", { name: /Create in new page/ })
    ).toHaveAttribute("href", "/dashboard/seller/stores/example/coupons/new");
});
it("provides a retry for list fetch failure", async () => {
    jest.mocked(getStoreCoupons).mockRejectedValueOnce(Error("fixture"));
    render(
        <ModalProvider>
            {await Page({ params: Promise.resolve({ storeUrl: "example" }) })}
        </ModalProvider>
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not load coupons"
    );
});
