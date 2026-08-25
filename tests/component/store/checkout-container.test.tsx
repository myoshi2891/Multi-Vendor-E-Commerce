/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import CheckoutContainer from "@/components/store/checkout-page/container";
import {
    createMockCart,
    createMockCartItem,
    createMockCountry,
    createMockShippingAddress,
} from "@/config/test-fixtures";
import { updateCheckoutProductWithLatest } from "@/queries/user";
import toast from "react-hot-toast";
import { Prisma } from "@prisma/client";

/**
 * チェックアウト画面のオーケストレーション
 * （`src/components/store/checkout-page/container.tsx`）の検証。
 *
 * この useEffect は「表示中の金額を最新の在庫・配送料で引き直す」責務を持つ。
 * 引き直しが走らない / 誤った国で走ると、ユーザーは古い送料のまま注文を確定する。
 * lcov 0%・分岐 16 の未カバー面だった。
 *
 * 子コンポーネントは stub 化して、検証対象を**このコンテナの配線**に限定する
 * （PlaceOrderCard 自体は place-order-card.test.tsx の担当で重複させない）。
 */

jest.mock("@/queries/user", () => ({
    updateCheckoutProductWithLatest: jest.fn(),
}));
jest.mock("react-hot-toast", () => ({
    __esModule: true,
    default: {
        error: jest.fn(),
        success: jest.fn(),
    },
}));

type ShippingAddressesStubProps = {
    setSelectedAddress: (address: { countryId: string }) => void;
};

jest.mock(
    "@/components/store/shared/shipping-addresses/shipping-addresses",
    () => ({
        __esModule: true,
        default: ({ setSelectedAddress }: ShippingAddressesStubProps) => (
            <button
                data-testid="select-address"
                onClick={() => setSelectedAddress({ countryId: "country-jp" })}
            >
                select address
            </button>
        ),
    })
);
jest.mock("@/components/store/cards/checkout-product", () => ({
    __esModule: true,
    default: ({ product }: { product: { variantId: string } }) => (
        <div data-testid="checkout-product">{product.variantId}</div>
    ),
}));
jest.mock("@/components/store/cards/place-order", () => ({
    __esModule: true,
    default: ({ cartData }: { cartData: { total: number } }) => (
        <div data-testid="place-order-card">{cartData.total}</div>
    ),
}));
jest.mock("@/components/store/shared/country-note", () => ({
    __esModule: true,
    default: ({ country }: { country: string }) => (
        <div data-testid="country-note">{country}</div>
    ),
}));

describe("CheckoutContainer", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const buildCartItem = (variantId: string) => ({
        ...createMockCartItem({
            variantId,
            price: new Prisma.Decimal("10.00"),
            shippingFee: new Prisma.Decimal("5.00"),
            totalPrice: new Prisma.Decimal("25.00"),
        }),
        price: 10.0,
        shippingFee: 5.0,
        totalPrice: 25.0,
    });

    type ContainerProps = React.ComponentProps<typeof CheckoutContainer>;

    const buildCart = (variantIds: string[]): ContainerProps["cart"] => ({
        ...createMockCart({ id: "cart-1" }),
        subTotal: 20.0,
        shippingFees: 5.0,
        total: 25.0,
        cartItems: variantIds.map(buildCartItem),
        coupon: null,
    });

    const jpCountry = createMockCountry({ id: "country-jp", name: "Japan" });
    const addresses: ContainerProps["addresses"] = [
        {
            ...createMockShippingAddress({ countryId: "country-jp" }),
            country: jpCountry,
            user: {
                id: "user-001",
                name: "Test User",
                email: "test@example.test",
                picture: "https://example.test/avatar.png",
                role: "USER",
                createdAt: new Date("2024-01-01"),
                updatedAt: new Date("2024-01-01"),
            },
        },
    ];

    const userCountry = {
        name: "United States",
        code: "US",
        city: "",
        region: "",
    };

    const renderContainer = (cart: ContainerProps["cart"]) =>
        render(
            <CheckoutContainer
                cart={cart}
                countries={[jpCountry]}
                addresses={addresses}
                userCountry={userCountry}
            />
        );

    it("hydrates the cart on mount when items are present", async () => {
        // Arrange
        const cart = buildCart(["variant-1"]);
        const hydrated = { ...cart, total: 99.0 };
        (updateCheckoutProductWithLatest as jest.Mock).mockResolvedValue(
            hydrated
        );

        // Act
        renderContainer(cart);

        // Assert: 初回は住所未選択なので activeCountry は undefined
        await waitFor(() => {
            expect(updateCheckoutProductWithLatest).toHaveBeenCalledWith(
                cart.cartItems,
                undefined
            );
        });
        // hydrate 結果が子へ渡ること（返り値を捨てていないことの確認）
        await waitFor(() => {
            expect(screen.getByTestId("place-order-card")).toHaveTextContent(
                "99"
            );
        });
    });

    it("does not hydrate when the cart is empty", async () => {
        // Arrange + Act
        renderContainer(buildCart([]));

        // Assert: 空カートで引き直しを走らせても取得するものが無い。
        // ここが呼ばれるようになったら無駄なサーバー往復の回帰。
        await waitFor(() => {
            expect(screen.getByTestId("place-order-card")).toBeInTheDocument();
        });
        expect(updateCheckoutProductWithLatest).not.toHaveBeenCalled();
    });

    it("re-hydrates with the selected address country", async () => {
        // Arrange
        const cart = buildCart(["variant-1"]);
        (updateCheckoutProductWithLatest as jest.Mock).mockResolvedValue(cart);
        renderContainer(cart);
        await waitFor(() => {
            expect(updateCheckoutProductWithLatest).toHaveBeenCalledTimes(1);
        });

        // Act: 住所を選ぶと activeCountry が定まり useEffect が再実行される
        fireEvent.click(screen.getByTestId("select-address"));

        // Assert: 2 回目は選択住所の国が渡る。ここが渡らないと、ユーザーは
        // 別の国の送料のまま注文を確定できてしまう。
        await waitFor(() => {
            expect(updateCheckoutProductWithLatest).toHaveBeenCalledTimes(2);
        });
        expect(updateCheckoutProductWithLatest).toHaveBeenLastCalledWith(
            cart.cartItems,
            jpCountry
        );
        // 表示中の国も選択住所のものへ切り替わる（初期は userCountry）
        expect(screen.getByTestId("country-note")).toHaveTextContent("Japan");
    });

    it("serializes hydrate requests so a stale country cannot persist last", async () => {
        // Arrange: 初回（住所未選択 = undefined）の引き直しを未解決のまま留める。
        const cart = buildCart(["variant-1"]);
        const order: string[] = [];
        let resolveMount: () => void = () => {};
        const mountGate = new Promise<void>((resolve) => {
            resolveMount = resolve;
        });

        (updateCheckoutProductWithLatest as jest.Mock)
            .mockImplementationOnce(async () => {
                await mountGate;
                order.push("mount-settled");
                return cart;
            })
            .mockImplementationOnce(async () => {
                order.push("country-started");
                return { ...cart, total: 77.0 };
            });

        renderContainer(cart);
        await waitFor(() => {
            expect(updateCheckoutProductWithLatest).toHaveBeenCalledTimes(1);
        });

        // Act: 初回が飛行中のまま住所（= 国）を切り替える
        fireEvent.click(screen.getByTestId("select-address"));

        // Assert: 2 本目はまだ発火しない。
        //
        // これが**永続化の race を塞ぐ本体**である。`updateCheckoutProductWithLatest`
        // は CartItem / Cart を DB へ書き込むので、並行させると古い国のリクエストが
        // 後着した場合にそちらの送料・合計が確定して残る。`cancelled` フラグは
        // クライアント state の上書きしか止められず、サーバー側の書き込みには効かない。
        expect(updateCheckoutProductWithLatest).toHaveBeenCalledTimes(1);

        // 初回を解決させるとキューが流れて 2 本目が走る
        resolveMount();

        // Assert: 完了順が呼び出し順と一致する = 最新の国の書き込みが必ず最後に来る
        await waitFor(() => {
            expect(updateCheckoutProductWithLatest).toHaveBeenCalledTimes(2);
        });
        expect(order).toEqual(["mount-settled", "country-started"]);
        expect(updateCheckoutProductWithLatest).toHaveBeenLastCalledWith(
            cart.cartItems,
            jpCountry
        );
        await waitFor(() => {
            expect(screen.getByTestId("place-order-card")).toHaveTextContent(
                "77"
            );
        });
    });

    it("surfaces a hydrate failure to the user instead of failing silently", async () => {
        // Arrange
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const cart = buildCart(["variant-1"]);
        (updateCheckoutProductWithLatest as jest.Mock).mockRejectedValue(
            new Error("hydrate boom")
        );

        // Act
        renderContainer(cart);

        // Assert: 引き直しが失敗したことがユーザーに伝わること。
        //
        // ここを握らないと rejection は useEffect の外へ漏れて**未処理**になり、
        // 画面には**古い金額が表示されたまま**で失敗した事実がどこにも出ない。
        // it.failing では固定できない（あれが反転するのは assertion の結果だけで、
        // 未処理 rejection は Node のプロセスレベルで浮上するため吸収されない ——
        // 実測では 1 failed かつ同じ rejection が 2 重報告された）。
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                "Failed to refresh checkout details."
            );
        });
        // 失敗しても表示は直前の cart を保つ（クラッシュも空表示もしない）
        expect(screen.getByTestId("place-order-card")).toHaveTextContent("25");
        consoleSpy.mockRestore();
    });
});
