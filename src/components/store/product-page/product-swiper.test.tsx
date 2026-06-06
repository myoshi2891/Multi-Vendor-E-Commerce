/** @jest-environment jsdom */
import { render } from "@testing-library/react";
import ProductSwiper from "./product-swiper";

describe("ProductSwiper Component", () => {
    const mockImages = [
        { id: "img-1", url: "/assets/images/no_image.png", alt: "Image 1" },
        { id: "img-2", url: "/assets/images/no_image.png", alt: "Image 2" },
    ] as any;

    it("同じURLの画像が複数存在する場合でも、キー重複によるReactの警告が発生しないこと", () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        render(
            <ProductSwiper
                images={mockImages}
                activeImage={mockImages[0]}
                setActiveImage={jest.fn()}
            />
        );

        const hasKeyWarning = consoleSpy.mock.calls.some((call) =>
            call[0] && typeof call[0] === "string" && call[0].includes("Encountered two children with the same key")
        );

        consoleSpy.mockRestore();

        expect(hasKeyWarning).toBe(false);
    });
});
