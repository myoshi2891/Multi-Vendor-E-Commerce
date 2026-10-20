/** @jest-environment jsdom */
import AdminReviewsPage from "@/app/dashboard/admin/reviews/page";
import { requireAdmin } from "@/lib/auth-guards";
import { getReviewModerationQueue } from "@/queries/review";
import { redirect } from "next/navigation";

jest.mock("@/lib/auth-guards", () => ({ requireAdmin: jest.fn() }));
jest.mock("@/queries/review", () => ({
    getReviewModerationQueue: jest.fn(),
    moderateReview: jest.fn(),
}));
jest.mock("next/navigation", () => ({
    redirect: jest.fn(() => {
        throw new Error("NEXT_REDIRECT");
    }),
}));

type QueueResult = Awaited<ReturnType<typeof getReviewModerationQueue>>;
const row = {
    id: "r1",
    review: "Body",
    rating: 4,
    status: "FLAGGED",
    isVerifiedPurchase: true,
    moderationReason: null,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    product: { name: "Considered piece", slug: "considered-piece" },
    user: { name: "Avery", email: "avery@example.test" },
    _count: { reports: 2 },
} as QueueResult["reviews"][number];

const result = (overrides: Partial<QueueResult> = {}): QueueResult => ({
    reviews: [row],
    page: 1,
    totalPages: 1,
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(requireAdmin).mockResolvedValue(
        {} as Awaited<ReturnType<typeof requireAdmin>>
    );
});

describe("AdminReviewsPage（plan 092・DS-PAGE-069）", () => {
    it("認可エラーは取得失敗の表示に畳まず、そのまま伝播させる", async () => {
        jest.mocked(requireAdmin).mockRejectedValue(
            new Error("Only admins can perform this action.")
        );

        await expect(
            AdminReviewsPage({ searchParams: Promise.resolve({}) })
        ).rejects.toThrow("Only admins can perform this action.");
        expect(getReviewModerationQueue).not.toHaveBeenCalled();
    });

    it("URL の status / page をそのまま渡し、正規化はクエリ側に任せる", async () => {
        jest.mocked(getReviewModerationQueue).mockResolvedValue(result());

        await AdminReviewsPage({
            searchParams: Promise.resolve({ status: "REMOVED", page: "2" }),
        });

        expect(getReviewModerationQueue).toHaveBeenCalledWith({
            status: "REMOVED",
            page: "2",
        });
    });

    it("一覧を画面用の形に平らにして渡す（Date は ISO 文字列・通報数は未解決のみ）", async () => {
        jest.mocked(getReviewModerationQueue).mockResolvedValue(result());

        const element = await AdminReviewsPage({
            searchParams: Promise.resolve({}),
        });

        expect(element.props.reviews).toEqual([
            {
                id: "r1",
                review: "Body",
                rating: 4,
                status: "FLAGGED",
                isVerifiedPurchase: true,
                moderationReason: null,
                createdAt: "2026-10-01T00:00:00.000Z",
                productName: "Considered piece",
                productSlug: "considered-piece",
                authorName: "Avery",
                authorEmail: "avery@example.test",
                unresolvedReports: 2,
            },
        ]);
        expect(element.props.status).toBeNull();
    });

    it("範囲外のページは最終ページの正準 URL へ寄せる", async () => {
        jest.mocked(getReviewModerationQueue).mockResolvedValue(
            result({ page: 9, totalPages: 3, reviews: [] })
        );

        await expect(
            AdminReviewsPage({
                searchParams: Promise.resolve({ status: "FLAGGED", page: "9" }),
            })
        ).rejects.toThrow("NEXT_REDIRECT");
        expect(redirect).toHaveBeenCalledWith(
            "/dashboard/admin/reviews?status=FLAGGED&page=3"
        );
    });

    it("取得に失敗したら取得失敗の表示にする", async () => {
        jest.mocked(getReviewModerationQueue).mockRejectedValue(
            new Error("Failed to load review queue.")
        );
        jest.spyOn(console, "error").mockImplementation(() => {});

        const element = await AdminReviewsPage({
            searchParams: Promise.resolve({}),
        });

        expect(element.props.id).toBe("admin-reviews");
        expect(element.props.children.props.subject).toBe("reviews");
    });
});
