/** @jest-environment jsdom */
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import CheckoutPage from "@/app/(store)/checkout/page";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/lib/db", () => ({
    db: {
        cart: { findFirst: jest.fn() },
        country: { findMany: jest.fn() },
    },
}));
jest.mock("@/queries/user", () => ({
    getUserShippingAddresses: jest.fn(),
    updateCheckoutProductWithLatest: jest.fn(),
    placeOrder: jest.fn(),
    emptyUserCart: jest.fn(),
    saveProfileShippingAddress: jest.fn(),
    makeProfileShippingAddressDefault: jest.fn(),
}));
jest.mock("@/queries/coupon", () => ({ applyCoupon: jest.fn() }));
jest.mock("@/components/store/checkout-page/container", () => ({
    __esModule: true,
    default: () => null,
}));

const mockAuth = jest.mocked(auth);
const mockRedirect = jest.mocked(redirect);
const mockFindCart = jest.mocked(db.cart.findFirst);
type AuthResult = Awaited<ReturnType<typeof auth>>;

/** redirect / redirectToSignIn は実際には never（Next.js の redirect エラーを throw）なので同じ振る舞いを模す */
const SIGN_IN_REDIRECT = new Error("NEXT_REDIRECT:sign-in");
const CART_REDIRECT = new Error("NEXT_REDIRECT:/cart");

describe("CheckoutPage（リソース側の認証）", () => {
    let redirectToSignIn: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        redirectToSignIn = jest.fn(() => {
            throw SIGN_IN_REDIRECT;
        });
        mockRedirect.mockImplementation(() => {
            throw CART_REDIRECT;
        });
    });

    it("未認証なら sign-in へリダイレクトし、カートを読まない", async () => {
        // Arrange
        mockAuth.mockResolvedValue({
            userId: null,
            redirectToSignIn,
        } as unknown as AuthResult);

        // Act / Assert —— /cart へ逃がすとサインイン後に checkout へ戻れない（OI-17）
        await expect(CheckoutPage()).rejects.toBe(SIGN_IN_REDIRECT);
        expect(redirectToSignIn).toHaveBeenCalledTimes(1);
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockFindCart).not.toHaveBeenCalled();
    });

    it("認証済みでもカートが無ければ /cart へリダイレクトする", async () => {
        // Arrange
        mockAuth.mockResolvedValue({
            userId: "user_123",
            redirectToSignIn,
        } as unknown as AuthResult);
        mockFindCart.mockResolvedValue(null);

        // Act / Assert
        await expect(CheckoutPage()).rejects.toBe(CART_REDIRECT);
        expect(mockFindCart).toHaveBeenCalledWith(
            expect.objectContaining({ where: { userId: "user_123" } })
        );
        expect(mockRedirect).toHaveBeenCalledWith("/cart");
        expect(redirectToSignIn).not.toHaveBeenCalled();
    });
});
