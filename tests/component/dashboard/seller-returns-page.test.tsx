/** @jest-environment jsdom */
import SellerReturnsPage from "@/app/dashboard/seller/stores/[storeUrl]/returns/page";
import { requireStoreOwner } from "@/lib/auth-guards";
import { getStoreReturnRequests } from "@/queries/returns";

jest.mock("@/lib/auth-guards", () => ({ requireStoreOwner: jest.fn() }));
jest.mock("@/queries/returns", () => ({
    getStoreReturnRequests: jest.fn(),
    approveReturnRequest: jest.fn(),
    rejectReturnRequest: jest.fn(),
    receiveReturnRequest: jest.fn(),
    resolveReturnRequest: jest.fn(),
}));

const params = Promise.resolve({ storeUrl: "my-store" });

beforeEach(() => jest.clearAllMocks());

describe("SellerReturnsPage の認可（tech.md: 認可ガードは catch の外）", () => {
    it("認可エラーは取得失敗の表示に畳まず、そのまま伝播させる", async () => {
        // Arrange
        jest.mocked(requireStoreOwner).mockRejectedValue(
            new Error("Forbidden: store not owned by current user.")
        );

        // Act & Assert
        await expect(SellerReturnsPage({ params })).rejects.toThrow(
            "Forbidden: store not owned by current user."
        );
        expect(requireStoreOwner).toHaveBeenCalledWith("my-store");
        expect(getStoreReturnRequests).not.toHaveBeenCalled();
    });

    it("認可を通った後の取得失敗は、取得失敗の表示にする", async () => {
        // Arrange
        jest.mocked(requireStoreOwner).mockResolvedValue(
            {} as Awaited<ReturnType<typeof requireStoreOwner>>
        );
        jest.mocked(getStoreReturnRequests).mockRejectedValue(
            new Error("Failed to get return requests.")
        );

        // Act
        const element = await SellerReturnsPage({ params });

        // Assert
        expect(element.props.title).toBe("Returns");
    });
});
