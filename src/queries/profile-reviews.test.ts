import * as profile from "./profile";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
jest.mock("@clerk/nextjs/server", () => ({ currentUser: jest.fn() }));
jest.mock("@/lib/db", () => ({
    db: { review: { findMany: jest.fn(), count: jest.fn() } },
}));
const api = profile as unknown as {
    getUserReviewsForDisplay: (...args: unknown[]) => Promise<unknown>;
};
const findMany = db.review.findMany as jest.Mock;
const count = db.review.count as jest.Mock;
beforeEach(() => {
    jest.resetAllMocks();
    (currentUser as jest.Mock).mockResolvedValue({ id: "user-one" });
    count.mockResolvedValue(1);
});
it("projects minimal display data and preserves query conditions and owner scope", async () => {
    findMany.mockResolvedValue([
        {
            id: "review-one",
            rating: 4.5,
            review: "Lovely",
            variant: "Silk",
            color: "Gold",
            size: "M",
            quantity: "2",
            updatedAt: new Date("2026-10-01"),
            userId: "private-id",
            productId: "private-product",
            likes: 12,
            createdAt: new Date(),
            user: {
                name: "Mina",
                picture: "avatar",
                email: "private@example.test",
            },
            images: [
                {
                    id: "photo",
                    url: "photo-url",
                    alt: "Photo",
                    reviewId: "private-review",
                    createdAt: new Date(),
                },
            ],
        },
    ]);
    await expect(
        api.getUserReviewsForDisplay("5", "last-1-year", "Lovely", 2)
    ).resolves.toEqual({
        totalPages: 1,
        reviews: [
            {
                id: "review-one",
                rating: 4.5,
                review: "Lovely",
                variant: "Silk",
                color: "Gold",
                size: "M",
                quantity: "2",
                updatedAt: "2026-10-01T00:00:00.000Z",
                user: { name: "Mina", picture: "avatar" },
                images: [{ id: "photo", url: "photo-url", alt: "Photo" }],
            },
        ],
    });
    expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
            where: {
                AND: expect.arrayContaining([
                    { userId: "user-one" },
                    { rating: 5 },
                    { review: { contains: "Lovely", mode: "insensitive" } },
                ]),
            },
            skip: 10,
            take: 10,
            orderBy: { updatedAt: "desc" },
        })
    );
});
it("rejects guests before any DB lookup", async () => {
    (currentUser as jest.Mock).mockResolvedValue(null);
    await expect(api.getUserReviewsForDisplay()).rejects.toThrow(
        "Unauthenticated"
    );
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
});
