/** @jest-environment jsdom */
import { render } from "@testing-library/react";
import OfferTagsLinks from "./offerTags-links";
import { OfferTag } from "@prisma/client";
import { createMockOfferTag } from "@/config/test-fixtures";

describe("OfferTagsLinks Component", () => {
    const mockOfferTags: OfferTag[] = Array.from({ length: 8 }, (_, i) =>
        createMockOfferTag({
            id: String(i + 1),
            name: `Offer ${i + 1}`,
            url: `offer-${i + 1}`,
        })
    );

    it("最大7つのリンクのみがレンダリングされること（slice(0, 7) の検証）", () => {
        const { getAllByRole } = render(
            <OfferTagsLinks offerTags={mockOfferTags} open={false} />
        );
        const links = getAllByRole("link");
        expect(links.length).toBe(7);
    });

    it("各リンクに正しい href とテキスト、およびインデックスに基づく Tailwind クラスが付与されること", () => {
        const { getAllByRole } = render(
            <OfferTagsLinks offerTags={mockOfferTags} open={false} />
        );
        const links = getAllByRole("link") as HTMLAnchorElement[];

        // i === 0 の検証 (text-orange-background)
        expect(links[0].getAttribute("href")).toBe("/browse?offer=offer-1");
        expect(links[0].textContent).toBe("Offer 1");
        expect(links[0].className).toContain("text-orange-background");

        // i === 1 の検証 (通常のクラス、非表示制御なし)
        expect(links[1].getAttribute("href")).toBe("/browse?offer=offer-2");
        expect(links[1].textContent).toBe("Offer 2");
        expect(links[1].className).not.toContain("hidden");

        // i === 2 の検証 (hidden sm:block)
        expect(links[2].className).toContain("hidden sm:block");

        // i === 3 の検証 (hidden md:block)
        expect(links[3].className).toContain("hidden md:block");

        // i === 4, 5 の検証 (hidden lg:block)
        expect(links[4].className).toContain("hidden lg:block");
        expect(links[5].className).toContain("hidden lg:block");

        // i === 6 の検証 (hidden 2xl:block)
        expect(links[6].className).toContain("hidden 2xl:block");
    });
});

