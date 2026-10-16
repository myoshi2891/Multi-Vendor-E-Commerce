/** @jest-environment jsdom */
import SellerReturnsPage from "@/app/dashboard/seller/stores/[storeUrl]/returns/page";
import { requireStoreOwner } from "@/lib/auth-guards";
import { getStoreReturnRequests } from "@/queries/returns";
import { emptyReturnStatusCounts } from "@/lib/returns-view";
import { redirect } from "next/navigation";

jest.mock("@/lib/auth-guards", () => ({ requireStoreOwner: jest.fn() }));
jest.mock("@/queries/returns", () => ({
    getStoreReturnRequests: jest.fn(),
    approveReturnRequest: jest.fn(),
    rejectReturnRequest: jest.fn(),
    receiveReturnRequest: jest.fn(),
    resolveReturnRequest: jest.fn(),
}));

jest.mock("next/navigation", () => ({
    redirect: jest.fn(() => {
        throw new Error("NEXT_REDIRECT");
    }),
}));

const params = Promise.resolve({ storeUrl: "my-store" });
const noSearch = () => Promise.resolve({});

type QueryResult = Awaited<ReturnType<typeof getStoreReturnRequests>>;
const result = (overrides: Partial<QueryResult> = {}): QueryResult => ({
    requests: [],
    counts: emptyReturnStatusCounts(),
    total: 0,
    page: 1,
    pageSize: 20,
    ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe("SellerReturnsPage の認可（tech.md: 認可ガードは catch の外）", () => {
    it("認可エラーは取得失敗の表示に畳まず、そのまま伝播させる", async () => {
        // Arrange
        jest.mocked(requireStoreOwner).mockRejectedValue(
            new Error("Forbidden: store not owned by current user.")
        );

        // Act & Assert
        await expect(
            SellerReturnsPage({ params, searchParams: noSearch() })
        ).rejects.toThrow("Forbidden: store not owned by current user.");
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
        const element = await SellerReturnsPage({
            params,
            searchParams: noSearch(),
        });

        // Assert
        expect(element.props.title).toBe("Returns");
    });
});

describe("SellerReturnsPage の URL パラメータ", () => {
    beforeEach(() => {
        jest.mocked(requireStoreOwner).mockResolvedValue(
            {} as Awaited<ReturnType<typeof requireStoreOwner>>
        );
    });

    it("status と page を正規化してクエリへ渡す", async () => {
        // Arrange
        jest.mocked(getStoreReturnRequests).mockResolvedValue(
            result({ total: 45, page: 2 })
        );

        // Act
        const element = await SellerReturnsPage({
            params,
            searchParams: Promise.resolve({ status: "APPROVED", page: "2.7" }),
        });

        // Assert
        expect(getStoreReturnRequests).toHaveBeenCalledWith("my-store", {
            status: "APPROVED",
            page: 2,
        });
        expect(element.props).toMatchObject({
            status: "APPROVED",
            page: 2,
            totalPages: 3,
        });
    });

    it("未知の status は絞り込みなし（全件）として扱う", async () => {
        // Arrange
        jest.mocked(getStoreReturnRequests).mockResolvedValue(result());

        // Act
        const element = await SellerReturnsPage({
            params,
            searchParams: Promise.resolve({ status: "BOGUS" }),
        });

        // Assert
        expect(getStoreReturnRequests).toHaveBeenCalledWith("my-store", {
            status: undefined,
            page: 1,
        });
        expect(element.props.status).toBeNull();
    });

    it("範囲外の page は最終ページの正準 URL へ寄せる", async () => {
        // Arrange
        jest.mocked(getStoreReturnRequests).mockResolvedValue(
            result({ total: 45, page: 9 })
        );

        // Act & Assert
        await expect(
            SellerReturnsPage({
                params,
                searchParams: Promise.resolve({
                    status: "REQUESTED",
                    page: "9",
                }),
            })
        ).rejects.toThrow("NEXT_REDIRECT");
        expect(redirect).toHaveBeenCalledWith(
            "/dashboard/seller/stores/my-store/returns?status=REQUESTED&page=3"
        );
    });
});
