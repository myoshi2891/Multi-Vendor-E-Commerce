/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import ModalProvider from "@/providers/modal-provider";
import SellerOrders from "@/components/dashboard/seller/seller-orders";
import SellerProducts from "@/components/dashboard/seller/seller-products";
import SellerCoupons from "@/components/dashboard/seller/seller-coupons";
import AdminCategories from "@/components/dashboard/admin/admin-categories";
import AdminCoupons from "@/components/dashboard/admin/admin-coupons";
import AdminOfferTags from "@/components/dashboard/admin/admin-offer-tags";
import AdminOrders from "@/components/dashboard/admin/admin-orders";
import AdminStores from "@/components/dashboard/admin/admin-stores";

/**
 * flexRender は cell 関数をコンポーネント型として createElement するため、列定義を毎 render
 * 作り直すと router.refresh() のたびに行内の要素が remount され、保存の成功表示や Dialog の
 * フォーカス復帰先が失われる（配送・在庫で実害を確認済み）。refresh 相当の再描画
 * （Server Action・行データとも新しい参照）で、DataTable に渡る列定義が同一参照であることを確認する。
 */
const received: unknown[] = [];
jest.mock("@/components/ui/data-table", () => ({
    __esModule: true,
    default: ({ columns }: { columns: ColumnDef<unknown>[] }) => {
        received.push(columns);
        return null;
    },
}));
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
    useParams: () => ({ storeUrl: "example" }),
    usePathname: () => "/",
}));
jest.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: jest.fn() }),
}));
jest.mock("uuid", () => ({ v4: () => "new-id" }));
jest.mock("react-datetime-picker", () => ({
    __esModule: true,
    default: () => <input aria-label="Legacy date" />,
}));
jest.mock("@/components/dashboard/forms/product-details", () => ({
    __esModule: true,
    default: () => null,
}));

// refresh のたびに Flight デコードで別参照になる Server Action を模して、毎回新しい jest.fn() を作る
const fn = () => jest.fn();
const cases: [string, () => React.ReactElement][] = [
    [
        "seller orders",
        () => (
            <SellerOrders
                orders={[]}
                actions={{
                    updateGroupAction: fn(),
                    updateItemAction: fn(),
                }}
            />
        ),
    ],
    [
        "seller products",
        () => (
            <SellerProducts
                products={[]}
                categories={[]}
                countries={[]}
                offerTags={[]}
                storeUrl="example"
                actions={{
                    deleteProductAction: fn(),
                    upsertProductAction: fn(),
                    getAttributeDefinitionsAction: fn(),
                }}
            />
        ),
    ],
    [
        "seller coupons",
        () => (
            <SellerCoupons
                coupons={[]}
                storeUrl="example"
                actions={{
                    loadAction: fn(),
                    saveAction: fn(),
                    deleteAction: fn(),
                }}
            />
        ),
    ],
    [
        "admin categories",
        () => (
            // categories は親選択にも使われ、refresh のたびに新しい配列になる
            <AdminCategories
                categories={[]}
                actions={{
                    loadAction: fn(),
                    saveAction: fn(),
                    deleteAction: fn(),
                }}
            />
        ),
    ],
    [
        "admin coupons",
        () => (
            <AdminCoupons
                coupons={[]}
                actions={{
                    loadAction: fn(),
                    saveAction: fn(),
                    deleteAction: fn(),
                    toggleAction: fn(),
                }}
            />
        ),
    ],
    [
        "admin offer tags",
        () => (
            <AdminOfferTags
                tags={[]}
                actions={{
                    loadAction: fn(),
                    saveAction: fn(),
                    deleteAction: fn(),
                }}
            />
        ),
    ],
    [
        "admin orders",
        () => (
            <AdminOrders
                orders={[]}
                actions={{
                    updateGroupAction: fn(),
                    updateItemAction: fn(),
                }}
            />
        ),
    ],
    [
        "admin stores",
        () => (
            <AdminStores
                stores={[]}
                actions={{ updateStatusAction: fn(), deleteAction: fn() }}
            />
        ),
    ],
];

beforeEach(() => {
    received.length = 0;
});

it.each(cases)(
    "%s keeps the same column definitions across a refresh",
    (_, view) => {
        // Arrange
        const { rerender } = render(<ModalProvider>{view()}</ModalProvider>);

        // Act: router.refresh() 相当（同じ内容の新しい props で再描画）
        rerender(<ModalProvider>{view()}</ModalProvider>);

        // Assert
        expect(received.length).toBeGreaterThanOrEqual(2);
        expect(received.at(-1)).toBe(received[0]);
    }
);
