/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// queries をモック化して Clerk のロードによる ESM パースエラーを防ぐ
jest.mock('@/queries/review', () => ({
    upsertReview: jest.fn(),
}));

// uuid もモック化して ESM のパースエラーを防ぐ
jest.mock('uuid', () => ({
    v4: () => 'mock-uuid-v4',
}));

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
    }
];

const mockReviews: any[] = [];
const mockSetReviews = jest.fn();

describe('ReviewDetails Rating TDD', () => {
    it('should render rating stars and update rating on click', async () => {
        // react-rating-stars-component が React 19 でエラーになるか、
        // または正常にマウント・操作できないことを確認する。
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
        // カスタム実装では `star-wrapper-2` を割り当てる予定
        const star = screen.getByTestId('star-wrapper-2');
        expect(star).toBeInTheDocument();

        // クリックイベントを発火する（星の中心より右をクリックして3.0点にする、もしくは単純クリック）
        fireEvent.click(star);

        // レーティング表示が更新されたことを確認する
        expect(screen.getByText('(3.0out of 5.0 )')).toBeInTheDocument();
    });
});
