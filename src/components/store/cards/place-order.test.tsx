/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import type { ShippingAddress } from '@prisma/client'
import type { SerializedCartType } from '@/lib/types'

jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}))

jest.mock('@/queries/user', () => ({
    emptyUserCart: jest.fn(),
    placeOrder: jest.fn(),
}))

// `mock` 接頭辞は jest.mock ファクトリのホイスティング制約を満たすために必須。
// テスト側から emptyCart の失敗を注入できるようモジュールスコープに持つ。
const mockEmptyCart = jest.fn()

jest.mock('@/cart-store/useCartStore', () => ({
    useCartStore: (selector: (state: { emptyCart: jest.Mock }) => unknown) =>
        selector({ emptyCart: mockEmptyCart }),
}))

jest.mock('react-hot-toast', () => ({
    __esModule: true,
    default: Object.assign(jest.fn(), { error: jest.fn() }),
}))

jest.mock('./fast-delivery', () => ({
    __esModule: true,
    default: () => <div />,
}))

jest.mock('../product-page/returns-security-privacy-card', () => ({
    SecurityPrivacyCard: () => <div />,
}))

jest.mock('../forms/apply-coupon', () => ({
    __esModule: true,
    default: () => <div />,
}))

jest.mock('react-spinners', () => ({
    PulseLoader: () => <span>Loading</span>,
}))

import { useRouter } from 'next/navigation'
import { emptyUserCart, placeOrder } from '@/queries/user'
import toast from 'react-hot-toast'
import PlaceOrderCard from './place-order'

const mockedPlaceOrder = jest.mocked(placeOrder)
const mockedEmptyUserCart = jest.mocked(emptyUserCart)
const mockedToastError = jest.mocked(toast.error)
const push = jest.fn()

const cartData = {
    id: 'cart-001',
    subTotal: 10,
    shippingFees: 2,
    total: 12,
    coupon: null,
    cartItems: [],
} as unknown as SerializedCartType

const shippingAddress = { id: 'address-001' } as ShippingAddress

beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({ push })
})

describe('PlaceOrderCard', () => {
    it('submits only once when the button is clicked rapidly', async () => {
        const pendingOrder = new Promise<never>(() => {})
        mockedPlaceOrder.mockReturnValue(pendingOrder as never)

        render(
            <PlaceOrderCard
                shippingAddress={shippingAddress}
                cartData={cartData}
                setCartData={jest.fn()}
            />
        )
        const button = screen.getByRole('button', { name: 'Place order' })

        fireEvent.click(button)
        fireEvent.click(button)

        await waitFor(() => {
            expect(mockedPlaceOrder).toHaveBeenCalledTimes(1)
        })
        expect(button).toBeDisabled()
    })

    it('遷移が完了するまでガードを解除しない（成功後の再クリックを防ぐ）', async () => {
        mockedPlaceOrder.mockResolvedValue({ orderId: 'order-001' })
        mockedEmptyUserCart.mockResolvedValue(true)

        render(
            <PlaceOrderCard
                shippingAddress={shippingAddress}
                cartData={cartData}
                setCartData={jest.fn()}
            />
        )
        const button = screen.getByRole('button', { name: 'Place order' })

        fireEvent.click(button)

        // push が呼ばれた = 遷移開始。ただしこの時点ではまだアンマウントされていない
        await waitFor(() => {
            expect(push).toHaveBeenCalledWith('/order/order-001')
        })

        // 遷移中に再クリックしても placeOrder は再実行されない
        // （カートは既に削除済みなので、再実行されると "Cart not found." で誤エラーになる）
        fireEvent.click(button)

        await waitFor(() => {
            expect(button).toBeDisabled()
        })
        expect(mockedPlaceOrder).toHaveBeenCalledTimes(1)
    })

    it('カート後片付けが失敗しても注文は確定済みなので再注文させない', async () => {
        mockedPlaceOrder.mockResolvedValue({ orderId: 'order-003' })
        mockedEmptyUserCart.mockRejectedValue(new Error('cleanup failed'))

        render(
            <PlaceOrderCard
                shippingAddress={shippingAddress}
                cartData={cartData}
                setCartData={jest.fn()}
            />
        )
        const button = screen.getByRole('button', { name: 'Place order' })

        fireEvent.click(button)

        // 後片付けの失敗は注文成立を取り消さない。遷移は行う
        await waitFor(() => {
            expect(push).toHaveBeenCalledWith('/order/order-003')
        })

        // 成立済みの注文に対してエラーを表示しない（誤解を招くため）
        expect(mockedToastError).not.toHaveBeenCalledWith(
            'Something went wrong while placing your order.'
        )

        // 再クリックしても placeOrder は再実行されない（二重注文の防止）
        fireEvent.click(button)

        await waitFor(() => {
            expect(button).toBeDisabled()
        })
        expect(mockedPlaceOrder).toHaveBeenCalledTimes(1)
    })

    // useCartStore は persist 構成のため、emptyCart() は同期関数でありながら
    // localStorage 書き込み失敗（Safari プライベートモード・容量超過）で throw しうる。
    // 無保護だと「注文は成立・エラー表示・遷移なし・ボタン永久 disabled」という
    // 復帰不能状態に落ちる。
    it('ローカルカート削除が失敗しても成立済み注文の遷移を継続する', async () => {
        mockedPlaceOrder.mockResolvedValue({ orderId: 'order-004' })
        mockedEmptyUserCart.mockResolvedValue(true)
        mockEmptyCart.mockImplementation(() => {
            throw new Error('QuotaExceededError')
        })

        render(
            <PlaceOrderCard
                shippingAddress={shippingAddress}
                cartData={cartData}
                setCartData={jest.fn()}
            />
        )
        const button = screen.getByRole('button', { name: 'Place order' })

        fireEvent.click(button)

        // 注文は成立しているので必ず注文詳細へ遷移する
        await waitFor(() => {
            expect(push).toHaveBeenCalledWith('/order/order-004')
        })

        // 成立済みの注文に対して失敗を示すトーストを出さない
        expect(mockedToastError).not.toHaveBeenCalledWith(
            'Something went wrong while placing your order.'
        )

        // サーバー側の後片付けもスキップされない
        expect(mockedEmptyUserCart).toHaveBeenCalledTimes(1)
    })

    it('注文が失敗した場合はガードを解除して再試行できる', async () => {
        mockedPlaceOrder.mockRejectedValueOnce(new Error('Cart not found.'))

        render(
            <PlaceOrderCard
                shippingAddress={shippingAddress}
                cartData={cartData}
                setCartData={jest.fn()}
            />
        )
        const button = screen.getByRole('button', { name: 'Place order' })

        fireEvent.click(button)

        await waitFor(() => {
            expect(mockedToastError).toHaveBeenCalledWith(
                'Something went wrong while placing your order.'
            )
        })
        await waitFor(() => {
            expect(button).toBeEnabled()
        })

        // 失敗後は再試行できる（ガードが解除されている）
        mockedPlaceOrder.mockResolvedValue({ orderId: 'order-002' })
        fireEvent.click(button)

        await waitFor(() => {
            expect(mockedPlaceOrder).toHaveBeenCalledTimes(2)
        })
    })
})
