/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SellerCoupons, {
    type CouponActions,
} from "@/components/dashboard/seller/seller-coupons";
import ModalProvider from "@/providers/modal-provider";
import { coupons } from "../../fixtures/p3/data";

jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("@/queries/coupon", () => ({}));
jest.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: jest.fn() }),
}));
jest.mock("uuid", () => ({ v4: () => "new-coupon-id" }));
jest.mock("react-datetime-picker", () => ({
    __esModule: true,
    default: () => <input aria-label="Legacy date" />,
}));

const coupon = coupons[0];

const setup = (overrides: Partial<CouponActions> = {}) => {
    const actions = {
        loadAction: jest.fn().mockResolvedValue(coupon),
        saveAction: jest.fn().mockResolvedValue(coupon),
        deleteAction: jest.fn().mockResolvedValue(coupon),
        ...overrides,
    } as unknown as CouponActions;
    render(
        <ModalProvider>
            <SellerCoupons
                coupons={[coupon] as never}
                storeUrl="example"
                actions={actions}
            />
        </ModalProvider>
    );
    return actions;
};

beforeEach(() => jest.clearAllMocks());

describe("SellerCoupons dialog", () => {
    it("一覧の割引率・残り時間を描画し、編集時に最新値を取得してフォームへ渡す", async () => {
        const actions = setup();
        expect(screen.getByText("10%")).toBeVisible();
        expect(screen.getByText(/days and .* hours/)).toBeVisible();

        fireEvent.click(
            screen.getByRole("button", { name: "Edit coupon WELCOME" })
        );
        expect(
            await screen.findByRole("textbox", { name: "Coupon code" })
        ).toHaveValue("WELCOME");
        expect(actions.loadAction).toHaveBeenCalledWith("coupon-1", "example");
    });

    it("取得結果が null の場合は保存させず、再試行で復帰する", async () => {
        const loadAction = jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(coupon);
        setup({ loadAction } as Partial<CouponActions>);

        fireEvent.click(
            screen.getByRole("button", { name: "Edit coupon WELCOME" })
        );
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Could not load coupon"
        );
        expect(
            screen.queryByRole("textbox", { name: "Coupon code" })
        ).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Retry load" }));
        expect(
            await screen.findByRole("textbox", { name: "Coupon code" })
        ).toBeVisible();
        expect(loadAction).toHaveBeenCalledTimes(2);
    });

    it("取得失敗はアラートで表示する", async () => {
        setup({
            loadAction: jest.fn().mockRejectedValue(Error("private detail")),
        } as Partial<CouponActions>);
        fireEvent.click(
            screen.getByRole("button", { name: "Edit coupon WELCOME" })
        );
        expect(await screen.findByRole("alert")).not.toHaveTextContent(
            "private detail"
        );
    });

    it("閉じた後に届いた古い取得結果は破棄する", async () => {
        let resolve!: (value: unknown) => void;
        const loadAction = jest.fn(() => new Promise((r) => (resolve = r)));
        setup({ loadAction } as unknown as Partial<CouponActions>);

        fireEvent.click(
            screen.getByRole("button", { name: "Edit coupon WELCOME" })
        );
        expect(await screen.findByRole("status")).toHaveTextContent(
            "Loading coupon"
        );
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        await waitFor(() =>
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
        );
        resolve(coupon);
        await waitFor(() => expect(loadAction).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("保存中は Escape で閉じられず、新規作成では取得を行わない", async () => {
        let finish!: (value: unknown) => void;
        const actions = setup({
            saveAction: jest.fn(() => new Promise((r) => (finish = r))),
        } as unknown as Partial<CouponActions>);

        fireEvent.click(
            screen.getByRole("button", { name: "Edit coupon WELCOME" })
        );
        fireEvent.submit(
            await screen.findByRole("form", { name: "Coupon information" })
        );
        await waitFor(() => expect(actions.saveAction).toHaveBeenCalled());
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        expect(screen.getByRole("dialog")).toBeVisible();
        finish(coupon);
        await waitFor(() =>
            expect(
                screen.getByRole("textbox", { name: "Coupon code" })
            ).toBeEnabled()
        );
    });

    it("新規作成ダイアログは取得せずに空フォームを開く", async () => {
        const actions = setup();
        fireEvent.click(
            screen.getByRole("button", { name: "Create New Coupon" })
        );
        expect(
            await screen.findByRole("textbox", { name: "Coupon code" })
        ).toHaveValue("");
        expect(actions.loadAction).not.toHaveBeenCalled();
    });

    it("削除確認で対象クーポンと storeUrl を渡す", async () => {
        const actions = setup();
        fireEvent.click(
            screen.getByRole("button", { name: "Delete coupon WELCOME" })
        );
        fireEvent.click(
            await screen.findByRole("button", { name: "Confirm delete" })
        );
        await waitFor(() =>
            expect(actions.deleteAction).toHaveBeenCalledWith(
                "coupon-1",
                "example"
            )
        );
    });
});
