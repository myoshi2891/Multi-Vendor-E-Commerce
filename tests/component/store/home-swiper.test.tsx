/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// 画像 import モック
jest.mock("@/public/assets/images/swiper/1.webp", () => "/swiper-1.webp", { virtual: true });
jest.mock("@/public/assets/images/swiper/2.webp", () => "/swiper-2.webp", { virtual: true });
jest.mock("@/public/assets/images/swiper/3.webp", () => "/swiper-3.webp", { virtual: true });
jest.mock("@/public/assets/images/swiper/4.webp", () => "/swiper-4.webp", { virtual: true });

// next/image モック
jest.mock("next/image", () => ({
    __esModule: true,
    default: ({ src, alt }: { src: string | { src: string }; alt: string }) => {
        const imgSrc =
            typeof src === "string"
                ? src
                : src && typeof src === "object" && "src" in src
                  ? src.src
                  : "";
        return <img src={imgSrc} alt={alt} data-testid="slider-image" />;
    },
}));

// embla-carousel-react モック
const mockEmblaApi: Record<string, jest.Mock> = {
    scrollNext: jest.fn(),
    scrollPrev: jest.fn(),
    canScrollNext: jest.fn(() => true),
    canScrollPrev: jest.fn(() => true),
    on: jest.fn((): Record<string, jest.Mock> => mockEmblaApi),
    off: jest.fn((): Record<string, jest.Mock> => mockEmblaApi),
    selectedScrollSnap: jest.fn(() => 0),
    scrollSnapList: jest.fn(() => [0, 1, 2, 3]),
};

jest.mock("embla-carousel-react", () => ({
    __esModule: true,
    default: jest.fn(() => [jest.fn(), mockEmblaApi]),
}));

// embla-carousel-autoplay モック
jest.mock("embla-carousel-autoplay", () => ({
    __esModule: true,
    default: jest.fn(() => ({})),
}));

import HomeMainSwiper from "@/components/store/home/main/home-swiper";

describe("HomeMainSwiper", () => {
    it("レンダリングされること", () => {
        render(<HomeMainSwiper />);
        const images = screen.getAllByTestId("slider-image");
        expect(images.length).toBe(4);
    });

    it("4枚の画像が表示されること", () => {
        render(<HomeMainSwiper />);
        const images = screen.getAllByTestId("slider-image");
        expect(images).toHaveLength(4);
        images.forEach((img) => {
            expect(img).toHaveAttribute("alt", "Product Image");
        });
    });
});
