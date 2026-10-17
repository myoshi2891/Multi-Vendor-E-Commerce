import { getSellerStores } from "./seller-stores";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/auth-guards";
jest.mock("@/lib/db", () => ({ db: { store: { findMany: jest.fn() } } }));
jest.mock("@/lib/auth-guards", () => ({ requireSeller: jest.fn() }));
beforeEach(() => jest.resetAllMocks());
it("restricts the projection to the authenticated seller and display fields", async () => {
    jest.mocked(requireSeller).mockResolvedValue({ id: "seller-a" } as never);
    jest.mocked(db.store.findMany).mockResolvedValue([]);
    await expect(getSellerStores()).resolves.toEqual({ ok: true, stores: [] });
    expect(db.store.findMany).toHaveBeenCalledWith({
        where: { userId: "seller-a" },
        select: { id: true, name: true, url: true, logo: true, status: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
});
it("propagates authorization failure without querying any stores", async () => {
    jest.mocked(requireSeller).mockRejectedValue(
        new Error("Only sellers can perform this action.")
    );
    await expect(getSellerStores()).rejects.toThrow("Only sellers");
    expect(db.store.findMany).not.toHaveBeenCalled();
});
it("returns a generic failure rather than an empty list or database details", async () => {
    jest.mocked(requireSeller).mockResolvedValue({ id: "seller-a" } as never);
    jest.mocked(db.store.findMany).mockRejectedValue(
        new Error("private database details")
    );
    await expect(getSellerStores()).resolves.toEqual({ ok: false });
});
