/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import AdminReviews from "@/components/dashboard/admin/admin-reviews";
import type {
    ModerateReviewAction,
    ReviewModerationQueueItem,
} from "@/lib/review-moderation";

const refresh = jest.fn();
const push = jest.fn();
let search = "";
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh, push }),
    usePathname: () => "/dashboard/admin/reviews",
    useSearchParams: () => new URLSearchParams(search),
}));

const item = (
    id: string,
    status: ReviewModerationQueueItem["status"],
    overrides: Partial<ReviewModerationQueueItem> = {}
): ReviewModerationQueueItem => ({
    id,
    review: `Review body ${id}`,
    rating: 4.5,
    status,
    isVerifiedPurchase: false,
    moderationReason: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    productName: "Considered piece",
    productSlug: "considered-piece",
    authorName: "Avery Stone",
    authorEmail: "avery@example.test",
    unresolvedReports: 0,
    ...overrides,
});

const renderQueue = (
    reviews: ReviewModerationQueueItem[],
    moderateAction: ModerateReviewAction = jest
        .fn()
        .mockResolvedValue({ id: "x", status: "PUBLISHED" }),
    props: Partial<React.ComponentProps<typeof AdminReviews>> = {}
) =>
    render(
        <AdminReviews
            reviews={reviews}
            status={null}
            page={1}
            totalPages={1}
            moderateAction={moderateAction}
            {...props}
        />
    );

beforeEach(() => {
    jest.clearAllMocks();
    search = "";
});

describe("AdminReviews — 一覧（plan 092・DS-COMP-250）", () => {
    it("本文・商品・投稿者・状態・購入者・未解決の通報数を出す", () => {
        renderQueue([
            item("r1", "FLAGGED", {
                isVerifiedPurchase: true,
                unresolvedReports: 3,
            }),
        ]);

        const card = screen.getByRole("article", { name: /Considered piece/ });
        expect(within(card).getByText("Review body r1")).toBeInTheDocument();
        expect(within(card).getByText("Flagged")).toBeInTheDocument();
        expect(within(card).getByText("Verified purchase")).toBeInTheDocument();
        expect(within(card).getByText("3 open reports")).toBeInTheDocument();
        expect(within(card).getByText(/Avery Stone/)).toBeInTheDocument();
        expect(
            within(card).getByText(/avery@example\.test/)
        ).toBeInTheDocument();
        expect(
            within(card).getByRole("link", { name: "Considered piece" })
        ).toHaveAttribute("href", "/product/considered-piece");
    });

    it("空のときは案内を出す", () => {
        renderQueue([]);
        expect(
            screen.getByText("No reviews need attention.")
        ).toBeInTheDocument();
    });

    it("状態で絞り込んで空のときは、その状態の案内を出す", () => {
        renderQueue([], undefined, { status: "REMOVED" });
        expect(screen.getByText("No removed reviews.")).toBeInTheDocument();
        expect(
            screen.queryByText("No reviews need attention.")
        ).not.toBeInTheDocument();
    });

    it("過去の却下・削除の理由を出す", () => {
        renderQueue([
            item("r1", "REMOVED", { moderationReason: "Hate speech" }),
        ]);
        expect(screen.getByText(/Hate speech/)).toBeInTheDocument();
    });
});

describe("AdminReviews — 状態ごとの操作", () => {
    it.each([
        ["PENDING_REVIEW", ["Approve", "Reject"]],
        ["PUBLISHED", ["Remove"]],
        ["FLAGGED", ["Keep published", "Remove"]],
        ["REJECTED", []],
        ["REMOVED", []],
    ] as const)("%s には %j だけを出す", (status, labels) => {
        renderQueue([item("r1", status)]);
        const card = screen.getByRole("article");
        const buttons = within(card)
            .queryAllByRole("button")
            .map((button) => button.textContent);
        expect(buttons).toEqual(labels);
    });

    it("承認は理由なしで送り、成功したら refresh する", async () => {
        const user = userEvent.setup();
        const moderateAction = jest
            .fn()
            .mockResolvedValue({ id: "r1", status: "PUBLISHED" });
        renderQueue([item("r1", "PENDING_REVIEW")], moderateAction);

        await user.click(screen.getByRole("button", { name: "Approve" }));

        expect(moderateAction).toHaveBeenCalledWith({
            reviewId: "r1",
            action: "approve",
        });
        expect(await screen.findByText("Review updated.")).toBeInTheDocument();
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("refresh でカードがキューから外れても成功を伝え、focus を次のカードへ移す", async () => {
        const user = userEvent.setup();
        const view = renderQueue([
            item("r1", "PENDING_REVIEW"),
            item("r2", "PENDING_REVIEW", { authorName: "Blair Kim" }),
        ]);

        await user.click(
            within(
                screen.getByRole("article", { name: /Avery Stone/ })
            ).getByRole("button", { name: "Approve" })
        );
        expect(await screen.findByText("Review updated.")).toBeInTheDocument();

        // refresh 後のサーバーデータ（承認済みの r1 は既定の絞り込みから外れる）
        view.rerender(
            <AdminReviews
                reviews={[
                    item("r2", "PENDING_REVIEW", { authorName: "Blair Kim" }),
                ]}
                status={null}
                page={1}
                totalPages={1}
                moderateAction={jest.fn()}
            />
        );

        expect(screen.getByRole("status")).toHaveTextContent("Review updated.");
        expect(
            screen.getByRole("article", { name: /Blair Kim/ })
        ).toHaveFocus();
    });

    it("最後の 1 件が外れたら focus をキューへ移す", async () => {
        const user = userEvent.setup();
        const view = renderQueue([item("r1", "PENDING_REVIEW")]);

        await user.click(screen.getByRole("button", { name: "Approve" }));
        expect(await screen.findByText("Review updated.")).toBeInTheDocument();
        view.rerender(
            <AdminReviews
                reviews={[]}
                status={null}
                page={1}
                totalPages={1}
                moderateAction={jest.fn()}
            />
        );

        expect(screen.getByRole("status")).toHaveTextContent("Review updated.");
        expect(
            screen.getByRole("region", { name: "Review queue" })
        ).toHaveFocus();
    });

    it("削除は理由を求め、空なら送らない", async () => {
        const user = userEvent.setup();
        const moderateAction = jest.fn();
        renderQueue([item("r1", "FLAGGED")], moderateAction);

        const remove = screen.getByRole("button", { name: "Remove" });
        await user.click(remove);
        expect(remove).toHaveAttribute("aria-expanded", "true");
        await user.click(
            screen.getByRole("button", { name: "Confirm remove" })
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Enter a reason"
        );
        expect(moderateAction).not.toHaveBeenCalled();
    });

    it("理由付きで削除を送り、送信中はボタンをロックする", async () => {
        const user = userEvent.setup();
        let resolve!: (value: { id: string; status: "REMOVED" }) => void;
        const moderateAction = jest.fn(
            () =>
                new Promise<{ id: string; status: "REMOVED" }>((r) => {
                    resolve = r;
                })
        );
        renderQueue([item("r1", "FLAGGED")], moderateAction);

        await user.click(screen.getByRole("button", { name: "Remove" }));
        await user.type(
            screen.getByLabelText("Reason (shown to the author)"),
            "Spam links"
        );
        const confirm = screen.getByRole("button", { name: "Confirm remove" });
        await user.click(confirm);

        expect(moderateAction).toHaveBeenCalledWith({
            reviewId: "r1",
            action: "remove",
            reason: "Spam links",
        });
        expect(confirm).toBeDisabled();
        expect(
            screen.getByRole("button", { name: "Keep published" })
        ).toBeDisabled();

        resolve({ id: "r1", status: "REMOVED" });
        expect(await screen.findByText("Review updated.")).toBeInTheDocument();
    });

    it("失敗はサーバーのメッセージを出し、再操作できる", async () => {
        const user = userEvent.setup();
        const moderateAction = jest
            .fn()
            .mockRejectedValue(new Error("Invalid moderation transition."));
        renderQueue([item("r1", "PENDING_REVIEW")], moderateAction);

        await user.click(screen.getByRole("button", { name: "Approve" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Invalid moderation transition."
        );
        expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
        expect(refresh).not.toHaveBeenCalled();
    });

    it("digest 付きの例外は Next.js が伏せた文言なので既定のメッセージを出す", async () => {
        const user = userEvent.setup();
        const masked = Object.assign(
            new Error("An error occurred in the Server Components render."),
            { digest: "1234567890" }
        );
        const moderateAction = jest.fn().mockRejectedValue(masked);
        renderQueue([item("r1", "PENDING_REVIEW")], moderateAction);

        await user.click(screen.getByRole("button", { name: "Approve" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Could not update the review. Please try again."
        );
    });
});

describe("AdminReviews — 絞り込みとページ", () => {
    it("状態を選ぶと page を外して URL を差し替える", async () => {
        const user = userEvent.setup();
        search = "page=3";
        renderQueue([item("r1", "PENDING_REVIEW")]);

        await user.selectOptions(
            screen.getByLabelText("Filter by status"),
            "REMOVED"
        );

        expect(push).toHaveBeenCalledWith(
            "/dashboard/admin/reviews?status=REMOVED"
        );
    });

    it("既定（要対応）に戻すと status を外す", async () => {
        const user = userEvent.setup();
        search = "status=REMOVED";
        renderQueue([item("r1", "REMOVED")], undefined, { status: "REMOVED" });

        await user.selectOptions(
            screen.getByLabelText("Filter by status"),
            "NEEDS_REVIEW"
        );

        expect(push).toHaveBeenCalledWith("/dashboard/admin/reviews");
    });

    it("複数ページのときだけページ送りを出す", () => {
        renderQueue([item("r1", "FLAGGED")], undefined, {
            page: 2,
            totalPages: 3,
        });

        const nav = screen.getByRole("navigation", {
            name: "Review queue pages",
        });
        expect(within(nav).getByText("Page 2 of 3")).toBeInTheDocument();
        expect(
            within(nav).getByRole("link", { name: "Previous page" })
        ).toHaveAttribute("href", "/dashboard/admin/reviews");
        expect(
            within(nav).getByRole("link", { name: "Next page" })
        ).toHaveAttribute("href", "/dashboard/admin/reviews?page=3");
    });
});
