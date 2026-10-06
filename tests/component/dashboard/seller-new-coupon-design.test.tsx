/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Page from "@/app/dashboard/seller/stores/[storeUrl]/coupons/new/page";
import { upsertCoupon } from "@/queries/coupon";
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush, refresh: jest.fn() }),
}));
jest.mock("@/queries/coupon", () => ({ upsertCoupon: jest.fn() }));
jest.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: jest.fn() }),
}));
jest.mock("uuid", () => ({ v4: () => "new-coupon-id" }));
jest.mock("react-datetime-picker", () => ({
    __esModule: true,
    default: () => <input aria-label="Legacy date" />,
}));
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(upsertCoupon).mockResolvedValue({ code: "NEWCODE" } as never);
});
it("provides a labeled creation region and form", async () => {
    render(await Page({ params: Promise.resolve({ storeUrl: "example" }) }));
    expect(
        screen.getByRole("region", { name: "Create coupon" })
    ).toContainElement(
        screen.getByRole("heading", { level: 1, name: "Create coupon" })
    );
    expect(
        screen.getByRole("form", { name: "Coupon information" })
    ).toBeVisible();
});
it("injects the server save action and keeps store scope/return URL", async () => {
    render(await Page({ params: Promise.resolve({ storeUrl: "example" }) }));
    fireEvent.change(screen.getByRole("textbox", { name: "Coupon code" }), {
        target: { value: "NEWCODE" },
    });
    fireEvent.change(
        screen.getByRole("spinbutton", { name: "Coupon discount" }),
        { target: { value: "10" } }
    );
    fireEvent.submit(screen.getByRole("form", { name: "Coupon information" }));
    await waitFor(() =>
        expect(upsertCoupon).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "new-coupon-id",
                scope: "STORE",
                code: "NEWCODE",
                discount: 10,
            }),
            "example"
        )
    );
    expect(mockPush).toHaveBeenCalledWith(
        "/dashboard/seller/stores/example/coupons"
    );
});
