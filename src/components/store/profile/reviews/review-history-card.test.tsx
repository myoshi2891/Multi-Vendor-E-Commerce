/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ReviewHistoryCard from "./review-history-card";
import type { ReviewHistoryEntry } from "./reviews-container";

const entry = (
    overrides: Partial<ReviewHistoryEntry> = {}
): ReviewHistoryEntry => ({
    id: "r1",
    rating: 4,
    review: "Lovely fabric and a careful finish.",
    variant: "Ivory",
    color: "ivory",
    size: "M",
    quantity: "1",
    updatedAt: "2026-10-01T00:00:00.000Z",
    user: { name: "Avery", picture: "" },
    images: [],
    status: "PUBLISHED",
    moderationReason: null,
    ...overrides,
});

// 本人のレビュー履歴にだけ、公開されていない理由を見せる（plan 092・DS-COMP-251）
describe("ReviewHistoryCard — モデレーション状態", () => {
    it("公開中は状態を出さない", () => {
        render(<ReviewHistoryCard review={entry()} />);
        expect(
            screen.queryByText(
                /Pending review|Under review|Not published|Removed/
            )
        ).not.toBeInTheDocument();
    });

    it.each([
        ["PENDING_REVIEW", "Pending review — not visible to shoppers yet"],
        ["FLAGGED", "Under review — still visible while our team checks it"],
        ["REJECTED", "Not published"],
        ["REMOVED", "Removed"],
    ] as const)("%s の状態を本人に伝える", (status, text) => {
        render(<ReviewHistoryCard review={entry({ status })} />);
        expect(screen.getByText(text)).toBeInTheDocument();
    });

    it("却下・削除の理由を本人に出す", () => {
        render(
            <ReviewHistoryCard
                review={entry({
                    status: "REJECTED",
                    moderationReason: "Mentions another shop",
                })}
            />
        );
        expect(
            screen.getByText("Reason: Mentions another shop")
        ).toBeInTheDocument();
    });

    // 削除から復帰した後に再通報されると、過去の理由が残ったまま FLAGGED になる
    it("FLAGGED では過去の理由を出さない", () => {
        render(
            <ReviewHistoryCard
                review={entry({
                    status: "FLAGGED",
                    moderationReason: "Mentions another shop",
                })}
            />
        );
        expect(screen.queryByText(/^Reason:/)).not.toBeInTheDocument();
    });
});
