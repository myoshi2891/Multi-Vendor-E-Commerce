/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// queries をモック化して Clerk のロードによる ESM パースエラーを防ぐ
jest.mock('@/queries/review', () => ({
    upsertReview: jest.fn(),
}));

// uuid もモック化して ESM のパースエラーを防ぐ
jest.mock('uuid', () => ({
    v4: () => 'mock-uuid-v4',
}));

// ImageUploadStore をモック化
jest.mock('../shared/upload-images', () => {
    return function DummyImageUploadStore({
        value,
        onChange,
        onRemove,
    }: {
        value: string[];
        onChange: (url: string) => void;
        onRemove: (url: string) => void;
    }) {
        return (
            <div data-testid="dummy-image-upload-store">
                <button
                    data-testid="upload-btn"
                    type="button"
                    onClick={() => onChange('https://example.com/new.jpg')}
                >
                    Upload
                </button>
                {value.map((url) => (
                    <button
                        key={url}
                        data-testid={`remove-btn-${url}`}
                        type="button"
                        onClick={() => onRemove(url)}
                    >
                        Remove {url}
                    </button>
                ))}
            </div>
        );
    };
});

import ReviewDetails from './review-details';
import { VariantInfoType } from '@/lib/types';

const mockVariantsInfo: VariantInfoType[] = [
    {
        variantName: "Classic Black",
        variantSlug: "classic-black",
        variantImage: "http://example.com/image.jpg",
        variantUrl: "/product/slug/classic-black",
        images: [],
        sizes: [
            {
                id: "size-1",
                size: "One Size",
                quantity: 10,
                price: 100,
                discount: 0,
                productVariantId: "variant-1",
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        ],
        colors: [{ name: "Black" }]
    },
    {
        variantName: "Classic White",
        variantSlug: "classic-white",
        variantImage: "http://example.com/white.jpg",
        variantUrl: "/product/slug/classic-white",
        images: [],
        sizes: [
            {
                id: "size-2",
                size: "S",
                quantity: 5,
                price: 90,
                discount: 0,
                productVariantId: "variant-2",
                createdAt: new Date(),
                updatedAt: new Date(),
            }
        ],
        colors: [{ name: "White" }]
    }
];

const mockReviews: any[] = [];
const mockSetReviews = jest.fn();

describe('ReviewDetails Component Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render rating stars and update rating on click', async () => {
        render(
            <ReviewDetails
                productId="test-product"
                variantsInfo={mockVariantsInfo}
                reviews={mockReviews}
                setReviews={mockSetReviews}
            />
        );

        // 初期状態の表示（0.0 out of 5.0 ）
        expect(screen.getByText('(0.0out of 5.0 )')).toBeInTheDocument();

        // 3番目の星（インデックス2）のラッパーを特定してクリックする
        const star = screen.getByTestId('star-wrapper-2');
        expect(star).toBeInTheDocument();

        // クリックイベントを発火する
        await userEvent.setup().click(star);

        // レーティング表示が更新されたことを確認する
        expect(screen.getByText('(3.0out of 5.0 )')).toBeInTheDocument();
    });

    it('should update rating with keyboard arrow keys', () => {
        render(
            <ReviewDetails
                productId="test-product"
                variantsInfo={mockVariantsInfo}
                reviews={mockReviews}
                setReviews={mockSetReviews}
            />
        );
        const star = screen.getByTestId('star-wrapper-2');
        
        // ArrowRight で増加するはず
        fireEvent.keyDown(star, { key: 'ArrowRight' });
        expect(screen.getByText('(0.5out of 5.0 )')).toBeInTheDocument();

        // ArrowLeft で減少（1.0にクランプ）
        fireEvent.keyDown(star, { key: 'ArrowLeft' });
        expect(screen.getByText('(1.0out of 5.0 )')).toBeInTheDocument();
        
        // その他のキーでは反応しないこと
        fireEvent.keyDown(star, { key: 'Enter' });
        expect(screen.getByText('(1.0out of 5.0 )')).toBeInTheDocument();
    });

    it('should handle mouse move and mouse leave on stars', () => {
        render(
            <ReviewDetails
                productId="test-product"
                variantsInfo={mockVariantsInfo}
                reviews={mockReviews}
                setReviews={mockSetReviews}
            />
        );
        const star = screen.getByTestId('star-wrapper-2');

        // 最初はイエローの星はない
        expect(document.querySelectorAll('svg[fill="#FFD804"]').length).toBe(0);

        // getBoundingClientRect を確実に上書きモック
        Object.defineProperty(star, 'getBoundingClientRect', {
            value: () => ({
                left: 0,
                right: 40,
                top: 0,
                bottom: 40,
                width: 40,
                height: 40,
            }),
            configurable: true
        });

        // clientX = 30 のとき、x = 30 >= 20 なので、3.0 になる
        fireEvent.mouseMove(star, { clientX: 30 });
        expect(document.querySelectorAll('svg[fill="#FFD804"]').length).toBeGreaterThan(0);

        // mouseLeave でホバーがリセットされる
        fireEvent.mouseLeave(star);
        expect(document.querySelectorAll('svg[fill="#FFD804"]').length).toBe(0);
    });

    it('should handle click with clientX to select partial rating', () => {
        render(
            <ReviewDetails
                productId="test-product"
                variantsInfo={mockVariantsInfo}
                reviews={mockReviews}
                setReviews={mockSetReviews}
            />
        );
        const star = screen.getByTestId('star-wrapper-2');
        
        Object.defineProperty(star, 'getBoundingClientRect', {
            value: () => ({
                left: 0,
                right: 40,
                top: 0,
                bottom: 40,
                width: 40,
                height: 40,
            }),
            configurable: true
        });

        fireEvent.click(star, { clientX: 10 });
        expect(screen.getByText('(2.5out of 5.0 )')).toBeInTheDocument();
    });

    it('should change size options when variant changes', () => {
        render(
            <ReviewDetails
                productId="test-product"
                variantsInfo={mockVariantsInfo}
                reviews={mockReviews}
                setReviews={mockSetReviews}
            />
        );

        // バリアントの Select ボックス（プレースホルダー "Select product"）
        const variantInput = screen.getByPlaceholderText('Select product');
        
        fireEvent.focus(variantInput);
        
        const option = screen.getByText('Classic White');
        expect(option).toBeInTheDocument();

        fireEvent.mouseDown(option);

        expect(variantInput).toHaveValue('Classic White');
    });

    it('should handle images addition and removal with limits', () => {
        render(
            <ReviewDetails
                productId="test-product"
                variantsInfo={mockVariantsInfo}
                reviews={mockReviews}
                setReviews={mockSetReviews}
            />
        );

        const uploadBtn = screen.getByTestId('upload-btn');

        // 画像1枚アップロード
        fireEvent.click(uploadBtn);
        // ダミーのImageUploadStoreがonChangeを実行し、https://example.com/new.jpg が追加されるはず
        expect(screen.getByTestId('remove-btn-https://example.com/new.jpg')).toBeInTheDocument();

        // 画像の削除
        const removeBtn = screen.getByTestId('remove-btn-https://example.com/new.jpg');
        fireEvent.click(removeBtn);
        expect(screen.queryByTestId('remove-btn-https://example.com/new.jpg')).not.toBeInTheDocument();
    });

    it('should submit review successfully', async () => {
        const { upsertReview } = require('@/queries/review');
        upsertReview.mockResolvedValue({ id: 'mock-review-id' });

        render(
            <ReviewDetails
                productId="test-product"
                variantsInfo={mockVariantsInfo}
                reviews={mockReviews}
                setReviews={mockSetReviews}
            />
        );

        // レーティング設定
        const star = screen.getByTestId('star-wrapper-2');
        await userEvent.click(star); // 3.0

        // サイズの入力 (Select size プレースホルダーが複数あるため getAll で最初の要素を選択)
        const sizeInput = screen.getAllByPlaceholderText('Select size')[0];
        fireEvent.focus(sizeInput);
        const sizeOption = screen.getByText('One Size');
        fireEvent.mouseDown(sizeOption);

        // レビュー内容の入力
        const textarea = screen.getByPlaceholderText('Write your review here...');
        fireEvent.change(textarea, { target: { value: 'Good product!' } });

        // 送信ボタンのクリック
        const submitBtn = screen.getByRole('button', { name: 'Submit Review' });
        await userEvent.click(submitBtn);

        expect(upsertReview).toHaveBeenCalledWith('test-product', {
            id: 'mock-uuid-v4',
            variant: 'Classic Black',
            images: [],
            quantity: '1',
            rating: 3.0,
            review: 'Good product!',
            size: 'One Size',
            color: 'Black',
        });
        expect(mockSetReviews).toHaveBeenCalled();
    });

    it('should handle submit error and show error log', async () => {
        const { upsertReview } = require('@/queries/review');
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        upsertReview.mockRejectedValue(new Error('API Error'));

        render(
            <ReviewDetails
                productId="test-product"
                variantsInfo={mockVariantsInfo}
                reviews={mockReviews}
                setReviews={mockSetReviews}
            />
        );

        // 必須項目を入力してバリデーションを通す
        const star = screen.getByTestId('star-wrapper-2');
        await userEvent.click(star); // 3.0

        const sizeInput = screen.getAllByPlaceholderText('Select size')[0];
        fireEvent.focus(sizeInput);
        const sizeOption = screen.getByText('One Size');
        fireEvent.mouseDown(sizeOption);

        const textarea = screen.getByPlaceholderText('Write your review here...');
        fireEvent.change(textarea, { target: { value: 'Good product!' } });

        const submitBtn = screen.getByRole('button', { name: 'Submit Review' });
        await userEvent.click(submitBtn);

        expect(upsertReview).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });
});
