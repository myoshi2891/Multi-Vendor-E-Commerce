/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { ProductVariantImage } from "@prisma/client";
import ProductSwiper from "./product-swiper";

describe("ProductSwiper Component", () => {
    const mockImages: ProductVariantImage[] = [
        {
            id: "img-1",
            url: "/assets/images/no_image.png",
            alt: "Image 1",
            productVariantId: "variant-1",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            id: "img-2",
            url: "/assets/images/no_image.png",
            alt: "Image 2",
            productVariantId: "variant-1",
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ];

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

    it('shows only the main image when one product image is registered', () => {
        const image = { ...mockImages[0], url: '/uploads/main.jpg' }
        render(<ProductSwiper images={[image]} activeImage={image} setActiveImage={jest.fn()} />)

        expect(screen.getByRole('button', { name: 'Enlarge product image' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /View image \d/ })).not.toBeInTheDocument()
    })

    it('shows selectable thumbnails below the main image for multiple registered images', () => {
        const images = [
            { ...mockImages[0], url: '/uploads/main.jpg' },
            { ...mockImages[1], url: '/uploads/detail.jpg' },
        ]
        const setActiveImage = jest.fn()
        render(<ProductSwiper images={images} activeImage={images[0]} setActiveImage={setActiveImage} />)

        expect(screen.getByRole('button', { name: 'View image 1' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'View image 2' })).toHaveAttribute('aria-pressed', 'false')
        fireEvent.click(screen.getByRole('button', { name: 'View image 2' }))
        expect(setActiveImage).toHaveBeenCalledWith(images[1])
    })

    it('hides redundant thumbnails when all registered images are placeholders', () => {
        render(<ProductSwiper images={mockImages} activeImage={mockImages[0]} setActiveImage={jest.fn()} />)
        expect(screen.queryByRole('button', { name: /View image \d/ })).not.toBeInTheDocument()
    })
});
