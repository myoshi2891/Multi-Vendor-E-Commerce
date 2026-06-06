/** @jest-environment jsdom */
import { render } from "@testing-library/react";
import OfferTagsLinks from "./offerTags-links";
import { OfferTag } from "@prisma/client";
import { createMockOfferTag } from "@/config/test-fixtures";

// Mock useMediaQuery from react-responsive
const mockUseMediaQuery = jest.fn();
jest.mock("react-responsive", () => ({
    useMediaQuery: (options: { query: string }) => mockUseMediaQuery(options),
}));

describe("OfferTagsLinks Component", () => {
    const mockOfferTags: OfferTag[] = Array.from({ length: 8 }, (_, i) =>
        createMockOfferTag({
            id: String(i + 1),
            name: `Offer ${i + 1}`,
            url: `offer-${i + 1}`,
        })
    );

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("画面幅（useMediaQueryの戻り値）によってレンダリングされる要素数が変化してはならない (Hydration一致の保証)", () => {
        // 1. Phone screen
        mockUseMediaQuery.mockImplementation((opts) => {
            return opts.query === "(max-width: 640px)";
        });
        const { container: phoneContainer, unmount: unmountPhone } = render(
            <OfferTagsLinks offerTags={mockOfferTags} open={false} />
        );
        const phoneLinksCount = phoneContainer.querySelectorAll("a").length;
        unmountPhone();

        // 2. Desktop screen (2xl)
        mockUseMediaQuery.mockImplementation((opts) => {
            return opts.query === "(min-width: 1536px)";
        });
        const { container: desktopContainer, unmount: unmountDesktop } = render(
            <OfferTagsLinks offerTags={mockOfferTags} open={false} />
        );
        const desktopLinksCount = desktopContainer.querySelectorAll("a").length;
        unmountDesktop();

        // Should render the same amount of elements regardless of client viewport size
        expect(phoneLinksCount).toBe(desktopLinksCount);
    });
});
