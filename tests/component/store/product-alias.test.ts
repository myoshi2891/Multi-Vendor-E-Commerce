import ProductPage from "@/app/(store)/product/[productSlug]/page";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
jest.mock("@/lib/db", () => ({ db: { product: { findUnique: jest.fn() } } }));
jest.mock("next/navigation", () => ({
    redirect: jest.fn((url: string) => {
        throw new Error(`redirect:${url}`);
    }),
}));
const params = Promise.resolve({ productSlug: "sample" });
beforeEach(() => jest.clearAllMocks());
it("redirects to the first supplied variant without swallowing the redirect", async () => {
    jest.mocked(db.product.findUnique).mockResolvedValue({
        slug: "sample",
        variants: [{ slug: "first" }, { slug: "second" }],
    } as never);
    await expect(ProductPage({ params })).rejects.toThrow(
        "redirect:/product/sample/first"
    );
    expect(db.product.findUnique).toHaveBeenCalledWith({
        where: { slug: "sample" },
        include: { variants: true },
    });
});
it.each([null, { slug: "sample", variants: [] }])(
    "returns home when the product or its variants are missing",
    async (product) => {
        jest.mocked(db.product.findUnique).mockResolvedValue(product as never);
        await expect(ProductPage({ params })).rejects.toThrow("redirect:/");
        expect(redirect).toHaveBeenCalledWith("/");
    }
);
it("returns home on lookup failure", async () => {
    const logging = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
        jest.mocked(db.product.findUnique).mockRejectedValue(
            new Error("lookup failure")
        );
        await expect(ProductPage({ params })).rejects.toThrow("redirect:/");
    } finally {
        logging.mockRestore();
    }
});
