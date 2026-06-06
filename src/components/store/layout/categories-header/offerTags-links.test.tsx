/** @jest-environment jsdom */
import { render } from "@testing-library/react";
import OfferTagsLinks from "./offerTags-links";
import { OfferTag } from "@prisma/client";

// Mock useMediaQuery from react-responsive
const mockUseMediaQuery = jest.fn();
jest.mock("react-responsive", () => ({
    useMediaQuery: (options: any) => mockUseMediaQuery(options),
}));

describe("OfferTagsLinks Component", () => {
    const mockOfferTags: OfferTag[] = [
        { id: "1", name: "Offer 1", url: "offer-1" },
        { id: "2", name: "Offer 2", url: "offer-2" },
        { id: "3", name: "Offer 3", url: "offer-3" },
        { id: "4", name: "Offer 4", url: "offer-4" },
        { id: "5", name: "Offer 5", url: "offer-5" },
        { id: "6", name: "Offer 6", url: "offer-6" },
        { id: "7", name: "Offer 7", url: "offer-7" },
        { id: "8", name: "Offer 8", url: "offer-8" },
    ] as any;

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
