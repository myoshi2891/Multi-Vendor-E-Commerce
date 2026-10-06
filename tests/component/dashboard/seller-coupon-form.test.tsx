/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Form from "@/components/dashboard/seller/seller-coupon-form";
import type { upsertCoupon } from "@/queries/coupon";
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
        ReturnType<typeof upsertCoupon>,
        Parameters<typeof upsertCoupon>
    >();
    let fail!: (error: Error) => void;
    save.mockImplementationOnce(
        () =>
            new Promise((_, reject) => {
                fail = reject;
            })
    ).mockResolvedValueOnce(coupons[0] as never);
    render(
        <Form data={coupons[0] as never} storeUrl="example" saveAction={save} />
    );
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
        }),
        "example"
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
it("validates percentage and preserves creation contract/return path", async () => {
    const save = jest.fn().mockResolvedValue(coupons[0]);
    render(<Form storeUrl="example" saveAction={save} />);
    const form = screen.getByRole("form");
    fireEvent.submit(form);
    await screen.findByText("Discount percentage must be at least 1%");
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Coupon code" }), {
        target: { value: "NEWCODE" },
    });
    fireEvent.change(
        screen.getByRole("spinbutton", { name: "Coupon discount" }),
        { target: { value: "10" } }
    );
    fireEvent.submit(form);
    await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith(
            "/dashboard/seller/stores/example/coupons"
        )
    );
    expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
            id: "new-coupon-id",
            code: "NEWCODE",
            discount: 10,
            storeId: "",
            scope: "STORE",
            isActive: true,
        }),
        "example"
    );
});

it("normalizes edited local minute precision to existing second precision", async () => {
    const save = jest.fn().mockResolvedValue(coupons[0]);
    render(
        <Form data={coupons[0] as never} storeUrl="example" saveAction={save} />
    );
    fireEvent.change(screen.getByLabelText("Start date"), {
        target: { value: "2026-10-02T09:30" },
    });
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() =>
        expect(save).toHaveBeenCalledWith(
            expect.objectContaining({ startDate: "2026-10-02T09:30:00" }),
            "example"
        )
    );
});

it("renders a cleared discount as empty instead of passing NaN to React", () => {
    const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
    render(
        <Form
            data={coupons[0] as never}
            storeUrl="example"
            saveAction={jest.fn()}
        />
    );
    const discount = screen.getByRole("spinbutton", {
        name: "Coupon discount",
    });
    fireEvent.change(discount, { target: { value: "" } });
    expect(discount).toHaveValue(null);
    // React は value に NaN を受け取ると "Received NaN for the `%s` attribute" を出す
    expect(
        consoleError.mock.calls.some((args) =>
            args.some((arg) => String(arg).includes("NaN"))
        )
    ).toBe(false);
    consoleError.mockRestore();
});
