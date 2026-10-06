/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Form from "@/components/dashboard/admin/coupon-form";
import type { upsertCouponAsAdmin } from "@/queries/coupon";
import { coupons } from "../../fixtures/p3/data";
const mockRefresh = jest.fn(),
    mockPush = jest.fn();
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
}));
jest.mock("uuid", () => ({ v4: () => "new-coupon-id" }));
jest.mock("react-datetime-picker", () => ({
    __esModule: true,
    default: () => <input aria-label="Legacy date" />,
}));
beforeEach(() => jest.clearAllMocks());
it("retains edit identity and values across pending/error/retry with one action per submission", async () => {
    const save = jest.fn<
        ReturnType<typeof upsertCouponAsAdmin>,
        Parameters<typeof upsertCouponAsAdmin>
    >();
    let fail!: (error: Error) => void;
    save.mockImplementationOnce(
        () =>
            new Promise((_, reject) => {
                fail = reject;
            })
    ).mockResolvedValueOnce(coupons[0] as never);
    render(<Form data={coupons[0] as never} saveAction={save} />);
    fireEvent.change(
        screen.getByRole("spinbutton", { name: "Coupon discount" }),
        { target: { value: "15" } }
    );
    const form = screen.getByRole("form", { name: "Coupon information" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("textbox", { name: "Coupon code" })).toBeDisabled();
    expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
            id: "coupon-1",
            code: "WELCOME",
            discount: 15,
            scope: "STORE",
            storeId: "store-1",
            startDate: "2026-10-01T12:30:00",
            endDate: "2026-12-01T12:30:00",
        })
    );
    fail(Error("private detail"));
    await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
            "Your input has been kept"
        )
    );
    expect(
        screen.getByRole("spinbutton", { name: "Coupon discount" })
    ).toHaveValue(15);
    fireEvent.submit(form);
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockPush).not.toHaveBeenCalled();
});
it("clears storeId on PLATFORM and preserves scope and active state", async () => {
    const save = jest.fn().mockResolvedValue(coupons[0]);
    render(<Form data={coupons[0] as never} saveAction={save} />);
    fireEvent.change(screen.getByLabelText("Scope"), {
        target: { value: "PLATFORM" },
    });
    expect(screen.queryByLabelText("Store ID")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Active"));
    fireEvent.submit(screen.getByRole("form", { name: "Coupon information" }));
    await waitFor(() =>
        expect(save).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "coupon-1",
                scope: "PLATFORM",
                storeId: null,
                isActive: false,
                createdAt: coupons[0].createdAt,
            })
        )
    );
});
it("requires Store ID for STORE without invoking the save action", async () => {
    const save = jest.fn();
    render(
        <Form
            data={{ ...coupons[0], storeId: "" } as never}
            saveAction={save}
        />
    );
    fireEvent.submit(screen.getByRole("form", { name: "Coupon information" }));
    await waitFor(() =>
        expect(screen.getByLabelText("Store ID")).toHaveAttribute(
            "aria-invalid",
            "true"
        )
    );
    expect(save).not.toHaveBeenCalled();
});
