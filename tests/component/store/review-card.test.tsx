/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReviewCard from "@/components/store/cards/review";
import type { ReviewWithImageType } from "@/lib/types";

// 星とカラーホイールは描画だけの第三者 UI。本テストの関心（バッジと通報）から外す
jest.mock("react-rating-stars-component", () => () => null);
jest.mock("@/components/shared/color-wheel", () => () => null);

const makeReview = (
    overrides: Partial<ReviewWithImageType> = {}
): ReviewWithImageType => ({
    id: "review-001",
    productId: "product-001",
    userId: "author-001",
    variant: "Ivory",
    review: "A thoughtful piece that lasts.",
    rating: 4.5,
    color: "ivory",
    size: "M",
    quantity: "1",
    likes: 0,
    status: "PUBLISHED",
    isVerifiedPurchase: false,
    moderationReason: null,
    moderatedAt: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    images: [],
    user: { name: "Avery", picture: "/assets/images/default-user.jpg" },
    ...overrides,
});

describe("ReviewCard — 購入者バッジ（plan 092）", () => {
    it("購入者のレビューにだけ Verified purchase を出す", () => {
        const { rerender } = render(
            <ReviewCard review={makeReview({ isVerifiedPurchase: true })} />
        );
        expect(screen.getByText("Verified purchase")).toBeInTheDocument();

        rerender(
            <ReviewCard review={makeReview({ isVerifiedPurchase: false })} />
        );
        expect(screen.queryByText("Verified purchase")).not.toBeInTheDocument();
    });
});

describe("ReviewCard — 通報（plan 092）", () => {
    const openForm = () => {
        fireEvent.click(screen.getByRole("button", { name: "Report review" }));
    };

    it("onReport が無ければ通報ボタンを出さない", () => {
        render(<ReviewCard review={makeReview()} />);
        expect(
            screen.queryByRole("button", { name: "Report review" })
        ).not.toBeInTheDocument();
    });

    it("ボタンでフォームを開閉し、aria-expanded が追従する", () => {
        render(<ReviewCard review={makeReview()} onReport={jest.fn()} />);
        const toggle = screen.getByRole("button", { name: "Report review" });
        expect(toggle).toHaveAttribute("aria-expanded", "false");

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByLabelText("Reason")).toBeInTheDocument();
    });

    it("理由を選ばないと送れない", async () => {
        const onReport = jest.fn();
        render(<ReviewCard review={makeReview()} onReport={onReport} />);
        openForm();

        fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Choose a reason"
        );
        expect(onReport).not.toHaveBeenCalled();
    });

    it("理由とメモを送り、送信中は二重に送れず、成功したらフォームを閉じる", async () => {
        let resolve!: (value: { status: "PUBLISHED" }) => void;
        const onReport = jest.fn(
            () =>
                new Promise<{ status: "PUBLISHED" }>((r) => {
                    resolve = r;
                })
        );
        render(<ReviewCard review={makeReview()} onReport={onReport} />);
        openForm();

        fireEvent.change(screen.getByLabelText("Reason"), {
            target: { value: "SPAM" },
        });
        fireEvent.change(screen.getByLabelText("Details (optional)"), {
            target: { value: "  links to another shop  " },
        });
        const submit = screen.getByRole("button", { name: "Submit report" });
        fireEvent.click(submit);
        fireEvent.click(submit);

        expect(onReport).toHaveBeenCalledTimes(1);
        expect(onReport).toHaveBeenCalledWith({
            reviewId: "review-001",
            reason: "SPAM",
            note: "links to another shop",
        });
        expect(submit).toBeDisabled();
        expect(screen.getByLabelText("Reason")).toBeDisabled();

        resolve({ status: "PUBLISHED" });

        expect(
            await screen.findByText(/Thanks for letting us know/)
        ).toBeInTheDocument();
        expect(screen.queryByLabelText("Reason")).not.toBeInTheDocument();
        // 同じ人が同じレビューを何度も通報する導線は出さない（サーバー側でも冪等）
        expect(
            screen.queryByRole("button", { name: "Report review" })
        ).not.toBeInTheDocument();
    });

    it("メモが空なら note を送らない", async () => {
        const onReport = jest.fn().mockResolvedValue({ status: "PUBLISHED" });
        render(<ReviewCard review={makeReview()} onReport={onReport} />);
        openForm();

        fireEvent.change(screen.getByLabelText("Reason"), {
            target: { value: "FAKE" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

        await waitFor(() =>
            expect(onReport).toHaveBeenCalledWith({
                reviewId: "review-001",
                reason: "FAKE",
            })
        );
    });

    it("未認証ならサインインを促し、入力を残したまま再送できる", async () => {
        const onReport = jest
            .fn()
            .mockRejectedValueOnce(new Error("Unauthenticated."))
            .mockResolvedValueOnce({ status: "PUBLISHED" });
        render(<ReviewCard review={makeReview()} onReport={onReport} />);
        openForm();
        fireEvent.change(screen.getByLabelText("Reason"), {
            target: { value: "OFFENSIVE" },
        });

        fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Sign in to report reviews."
        );
        expect(screen.getByLabelText("Reason")).toHaveValue("OFFENSIVE");
        expect(
            screen.getByRole("button", { name: "Submit report" })
        ).toBeEnabled();

        fireEvent.click(screen.getByRole("button", { name: "Submit report" }));
        expect(
            await screen.findByText(/Thanks for letting us know/)
        ).toBeInTheDocument();
    });

    it("それ以外の失敗はサーバーのメッセージを表示する", async () => {
        const onReport = jest
            .fn()
            .mockRejectedValue(new Error("You cannot report your own review."));
        render(<ReviewCard review={makeReview()} onReport={onReport} />);
        openForm();
        fireEvent.change(screen.getByLabelText("Reason"), {
            target: { value: "OTHER" },
        });

        fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "You cannot report your own review."
        );
    });
});
