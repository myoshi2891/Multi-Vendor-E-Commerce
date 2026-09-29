/** @jest-environment jsdom */
import React, { forwardRef, ReactNode, useImperativeHandle } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ProductVariantImage } from "@prisma/client";
import ProductCardImageSwiper from "./swiper";

type MockSwiperInstance = {
    autoplay?: { start: jest.Mock; stop: jest.Mock };
    slideTo: jest.Mock;
};

let mockSwiperInstance: MockSwiperInstance;

jest.mock("swiper/react", () => ({
    Swiper: forwardRef<unknown, { children: ReactNode; modules?: unknown[]; autoplay?: unknown }>(
        function MockSwiper({ children, modules, autoplay }, ref) {
            useImperativeHandle(ref, () => ({ swiper: mockSwiperInstance }));
            return (
                <div data-testid="swiper" data-modules={JSON.stringify(modules)} data-autoplay={JSON.stringify(autoplay)}>
                    {children}
                </div>
            );
        }
    ),
    SwiperSlide: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock("swiper/modules", () => ({ Autoplay: "Autoplay" }));
jest.mock("swiper/css", () => ({}));
jest.mock("next/image", () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));

const images: ProductVariantImage[] = [
    { id: "img-1", url: "/a.jpg", alt: "Front", productVariantId: "v1", createdAt: new Date(), updatedAt: new Date() },
    { id: "img-2", url: "/b.jpg", alt: null, productVariantId: "v1", createdAt: new Date(), updatedAt: new Date() },
] as ProductVariantImage[];

const createInstance = (withAutoplay = true): MockSwiperInstance => ({
    autoplay: withAutoplay ? { start: jest.fn(), stop: jest.fn() } : undefined,
    slideTo: jest.fn(),
});

describe("ProductCardImageSwiper", () => {
    it("既定ではマウント時に autoplay を止め、ホバー中だけ再生して離れたら先頭へ戻す", () => {
        // Arrange
        mockSwiperInstance = createInstance();
        render(<ProductCardImageSwiper images={images} />);
        const autoplay = mockSwiperInstance.autoplay;
        expect(autoplay?.stop).toHaveBeenCalledTimes(1);
        const swiper = screen.getByTestId("swiper");
        expect(swiper).toHaveAttribute("data-modules", JSON.stringify(["Autoplay"]));
        expect(swiper).toHaveAttribute("data-autoplay", JSON.stringify({ delay: 500 }));
        const wrapper = swiper.parentElement as HTMLElement;

        // Act
        fireEvent.mouseEnter(wrapper);
        fireEvent.mouseLeave(wrapper);

        // Assert
        expect(autoplay?.start).toHaveBeenCalledTimes(1);
        expect(autoplay?.stop).toHaveBeenCalledTimes(2);
        expect(mockSwiperInstance.slideTo).toHaveBeenCalledWith(0);
    });

    it("autoplayOnHover=false なら Autoplay を組み込まず、ホバーでも操作しない", () => {
        // Arrange
        mockSwiperInstance = createInstance();
        render(<ProductCardImageSwiper images={images} autoplayOnHover={false} />);
        const wrapper = screen.getByTestId("swiper").parentElement as HTMLElement;

        // Act
        fireEvent.mouseEnter(wrapper);
        fireEvent.mouseLeave(wrapper);

        // Assert
        expect(screen.getByTestId("swiper")).toHaveAttribute("data-modules", "[]");
        expect(screen.getByTestId("swiper")).toHaveAttribute("data-autoplay", "false");
        expect(mockSwiperInstance.autoplay?.start).not.toHaveBeenCalled();
        expect(mockSwiperInstance.autoplay?.stop).not.toHaveBeenCalled();
        expect(mockSwiperInstance.slideTo).not.toHaveBeenCalled();
    });

    it("autoplay モジュールが未初期化でもマウント時に落ちない", () => {
        // Arrange
        mockSwiperInstance = createInstance(false);

        // Act & Assert
        expect(() => render(<ProductCardImageSwiper images={images} />)).not.toThrow();
    });

    it("alt が無い画像は id を代替テキストに使う", () => {
        mockSwiperInstance = createInstance();
        render(<ProductCardImageSwiper images={images} />);
        expect(screen.getByRole("img", { name: "Front" })).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "img-2" })).toBeInTheDocument();
    });

    it("alt も id も無い画像は既定の代替テキストで描画する", () => {
        mockSwiperInstance = createInstance();
        const broken = { ...images[1], id: undefined } as unknown as ProductVariantImage;
        render(<ProductCardImageSwiper images={[broken]} />);
        expect(screen.getByRole("img", { name: "Product Image" })).toBeInTheDocument();
    });
});
