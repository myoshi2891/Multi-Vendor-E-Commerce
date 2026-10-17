import DashboardPage from "@/app/dashboard/page";
import SellerDashboardPage from "@/app/dashboard/seller/page";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
jest.mock("@clerk/nextjs/server", () => ({ currentUser: jest.fn() }));
jest.mock("@/lib/db", () => ({ db: { store: { findMany: jest.fn() } } }));
jest.mock("next/navigation", () => ({
    redirect: jest.fn((url: string) => {
        throw new Error(`redirect:${url}`);
    }),
}));
beforeEach(() => jest.clearAllMocks());
describe("DS-PAGE-051 dashboard role routing regression", () => {
    it.each([
        [null, "/"],
        ["USER", "/"],
        ["ADMIN", "/dashboard/admin"],
        ["SELLER", "/dashboard/seller"],
    ] as const)("routes %s to %s", async (role, url) => {
        jest.mocked(currentUser).mockResolvedValue(
            role
                ? ({ id: "identity", privateMetadata: { role } } as never)
                : null
        );
        await expect(DashboardPage()).rejects.toThrow(`redirect:${url}`);
        expect(redirect).toHaveBeenCalledWith(url);
        expect(db.store.findMany).not.toHaveBeenCalled();
    });
});
describe("DS-PAGE-052 seller entry regression", () => {
    it("does not query stores for guests", async () => {
        jest.mocked(currentUser).mockResolvedValue(null);
        await expect(SellerDashboardPage()).rejects.toThrow("redirect:/");
        expect(db.store.findMany).not.toHaveBeenCalled();
    });
    it("takes sellers without stores to creation", async () => {
        jest.mocked(currentUser).mockResolvedValue({ id: "seller-a" } as never);
        jest.mocked(db.store.findMany).mockResolvedValue([]);
        await expect(SellerDashboardPage()).rejects.toThrow(
            "redirect:/dashboard/seller/stores/new"
        );
        expect(db.store.findMany).toHaveBeenCalledWith({
            where: { userId: "seller-a" },
        });
    });
    it("takes sellers to their first supplied store", async () => {
        jest.mocked(currentUser).mockResolvedValue({ id: "seller-a" } as never);
        jest.mocked(db.store.findMany).mockResolvedValue([
            { url: "first-owned" },
            { url: "second-owned" },
        ] as never);
        await expect(SellerDashboardPage()).rejects.toThrow(
            "redirect:/dashboard/seller/stores/first-owned"
        );
        expect(db.store.findMany).toHaveBeenCalledWith({
            where: { userId: "seller-a" },
        });
    });
});
