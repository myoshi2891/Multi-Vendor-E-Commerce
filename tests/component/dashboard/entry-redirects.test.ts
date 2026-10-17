import DashboardPage from "@/app/dashboard/page";
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
