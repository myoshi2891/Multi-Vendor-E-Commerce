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

    describe('zoom lightbox', () => {
        const photos = [
            { ...mockImages[0], url: '/uploads/main.jpg', alt: '' },
            { ...mockImages[1], url: '/uploads/detail.jpg' },
            { ...mockImages[1], id: 'img-3', url: '/uploads/side.jpg' },
        ]

        it('opens an enlarged image and closes it with the close button', () => {
            // Arrange
            render(<ProductSwiper images={photos} activeImage={photos[0]} setActiveImage={jest.fn()} productName="Pearl Necklace" />)

            // Act
            fireEvent.click(screen.getByRole('button', { name: 'Enlarge product image' }))

            // Assert: alt が空の画像は商品名で代替する
            const dialog = screen.getByRole('dialog', { name: 'Enlarged product image' })
            expect(dialog).toBeInTheDocument()
            expect(screen.getAllByAltText('Pearl Necklace')).toHaveLength(2)
            fireEvent.click(screen.getByRole('button', { name: 'Close image' }))
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })

        it('closes on Escape but ignores other keys', () => {
            // Arrange
            render(<ProductSwiper images={photos} activeImage={photos[0]} setActiveImage={jest.fn()} />)
            fireEvent.click(screen.getByRole('button', { name: 'Enlarge product image' }))

            // Act & Assert
            fireEvent.keyDown(window, { key: 'Enter' })
            expect(screen.getByRole('dialog')).toBeInTheDocument()
            fireEvent.keyDown(window, { key: 'Escape' })
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })

        it('falls back to a generic alt text when neither alt nor product name exists', () => {
            // Arrange & Act
            render(<ProductSwiper images={photos} activeImage={photos[0]} setActiveImage={jest.fn()} />)

            // Assert
            expect(screen.getByAltText('Product image')).toBeInTheDocument()
        })
    })

    describe('previous / next controls', () => {
        const photos = [
            { ...mockImages[0], url: '/uploads/main.jpg' },
            { ...mockImages[1], url: '/uploads/detail.jpg' },
            { ...mockImages[1], id: 'img-3', url: '/uploads/side.jpg' },
        ]

        it('wraps around to the last image when going back from the first', () => {
            // Arrange
            const setActiveImage = jest.fn()
            render(<ProductSwiper images={photos} activeImage={photos[0]} setActiveImage={setActiveImage} />)

            // Act
            fireEvent.click(screen.getByRole('button', { name: 'Previous image' }))

            // Assert
            expect(setActiveImage).toHaveBeenCalledWith(photos[2])
            expect(screen.getByText('01 / 03')).toBeInTheDocument()
        })

        it('wraps around to the first image when advancing from the last', () => {
            // Arrange
            const setActiveImage = jest.fn()
            render(<ProductSwiper images={photos} activeImage={photos[2]} setActiveImage={setActiveImage} />)

            // Act
            fireEvent.click(screen.getByRole('button', { name: 'Next image' }))

            // Assert
            expect(setActiveImage).toHaveBeenCalledWith(photos[0])
        })

        it('starts from the first image when no active image is selected', () => {
            // Arrange & Act
            render(<ProductSwiper images={photos} activeImage={null} setActiveImage={jest.fn()} />)

            // Assert
            expect(screen.getByRole('button', { name: 'View image 1' })).toHaveAttribute('aria-pressed', 'true')
        })

        it('uses branded artwork for placeholder thumbnails mixed with real photos', () => {
            // Arrange
            const mixed = [photos[0], { ...mockImages[1] }]

            // Act
            render(<ProductSwiper images={mixed} activeImage={mixed[1]} setActiveImage={jest.fn()} productName="Pearl Necklace" />)

            // Assert: プレースホルダーが選択中ならズーム不可・商品名入りのアートを表示
            expect(screen.queryByRole('button', { name: 'Enlarge product image' })).not.toBeInTheDocument()
            expect(screen.getByText('Pearl Necklace')).toBeInTheDocument()
        })
    })

    it('renders nothing without images', () => {
        const { container } = render(<ProductSwiper images={[]} activeImage={null} setActiveImage={jest.fn()} />)
        expect(container).toBeEmptyDOMElement()
    })
});
