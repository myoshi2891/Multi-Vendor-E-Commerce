/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModalProvider from "@/providers/modal-provider";
import SellerOrders from "@/components/dashboard/seller/seller-orders";
import AdminOrders from "@/components/dashboard/admin/admin-orders";
import AdminStores from "@/components/dashboard/admin/admin-stores";
import type { SellerOrderRow } from "@/lib/seller-orders";
import type { AdminOrderRow } from "@/lib/admin-orders";
import type { AdminStoreRow } from "@/lib/admin-stores";

/**
 * 状態エディターの key に status を含めると、自分の保存 → router.refresh() で行の status が
 * 変わった瞬間に remount され、「Status updated.」が消える（実ルートで 2 回目の成功表示が
 * 消える事象を観測）。key は行の同一性だけにし、他者による変更（refresh で届く別の値）は
 * エディター側で取り込むことを、refresh 相当の再描画で確認する。
 */
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));

const sellerOrder = (status: string): SellerOrderRow =>
    ({
        id: "g1",
        storeId: "s1",
        status,
        total: 25,
        shippingService: "Standard",
        deliveryRange: "Oct 8 - Oct 10",
        paymentStatus: "Paid",
        paymentMethod: "Stripe",
        paymentReference: "pi_1",
        address: "Street, Tokyo",
        customer: "A Buyer, 123",
        items: [],
    }) as SellerOrderRow;

const adminOrder = (status: string): AdminOrderRow =>
    ({
        id: "o1",
        paymentStatus: "Paid",
        total: 25,
        groups: [{ ...sellerOrder(status), storeName: "Example store" }],
    }) as AdminOrderRow;

const adminStore = (status: string): AdminStoreRow =>
    ({
        id: "store-1",
        name: "Example store",
        description: "Store description",
        url: "example",
        logo: "",
        cover: "",
        status,
        featured: false,
        email: "seller@example.test",
        phone: "123",
        shipping: [],
    }) as AdminStoreRow;

const orderActions = () => ({
    updateGroupAction: jest.fn().mockResolvedValue({}),
    updateItemAction: jest.fn().mockResolvedValue({}),
});
const storeActions = () => ({
    updateStatusAction: jest.fn().mockResolvedValue("ACTIVE"),
    deleteAction: jest.fn().mockResolvedValue({}),
});

const cases: [
    string,
    string,
    [string, string, string],
    (status: string) => React.ReactElement,
][] = [
    [
        "seller orders",
        "Order status g1 editor",
        ["Pending", "Shipped", "Delivered"],
        (status) => (
            <SellerOrders
                orders={[sellerOrder(status)]}
                actions={orderActions()}
            />
        ),
    ],
    [
        "admin orders",
        "Order status g1 editor",
        ["Pending", "Shipped", "Delivered"],
        (status) => (
            <AdminOrders
                orders={[adminOrder(status)]}
                actions={orderActions()}
            />
        ),
    ],
    [
        "admin stores",
        "Store status Example store editor",
        ["PENDING", "ACTIVE", "BANNED"],
        (status) => (
            <AdminStores
                stores={[adminStore(status)]}
                actions={storeActions()}
            />
        ),
    ],
];

it.each(cases)(
    "%s keeps its own save feedback across refresh and adopts external status changes",
    async (_, editorName, [initial, saved, external], view) => {
        // Arrange
        const user = userEvent.setup();
        const { rerender } = render(
            <ModalProvider>{view(initial)}</ModalProvider>
        );
        const editor = () => screen.getByRole("group", { name: editorName });

        // Act: 自分の保存 → refresh 相当（保存した値と新しい Server Action 参照で再描画）
        await user.selectOptions(within(editor()).getByRole("combobox"), saved);
        await user.click(
            within(editor()).getByRole("button", { name: "Save status" })
        );
        await within(editor()).findByRole("status");
        rerender(<ModalProvider>{view(saved)}</ModalProvider>);

        // Assert: remount されず成功表示が残る
        expect(within(editor()).getByRole("status")).toHaveTextContent(
            "Status updated."
        );
        expect(within(editor()).getByRole("combobox")).toHaveValue(saved);

        // Act: 他者による変更が refresh で届く
        rerender(<ModalProvider>{view(external)}</ModalProvider>);

        // Assert: 新しい値を表示し、自分の保存の成功表示は消す
        expect(within(editor()).getByRole("combobox")).toHaveValue(external);
        expect(within(editor()).queryByRole("status")).not.toBeInTheDocument();
        expect(
            within(editor()).getByRole("button", { name: "Save status" })
        ).toBeDisabled();
    }
);
