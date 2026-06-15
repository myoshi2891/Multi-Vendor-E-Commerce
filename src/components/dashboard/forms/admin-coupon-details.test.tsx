/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ---- モジュールモック（hoisting のため変数参照禁止）----
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}))

jest.mock('@/hooks/use-toast', () => ({
    useToast: jest.fn(),
}))

jest.mock('@/queries/coupon', () => ({
    upsertCouponAsAdmin: jest.fn(),
}))

jest.mock('uuid', () => ({
    v4: jest.fn().mockReturnValue('mock-uuid-v4'),
}))

// react-hook-form の複雑な DateTimePicker をスタブ化
jest.mock('react-datetime-picker', () => ({
    __esModule: true,
    default: ({
        onChange,
        value,
    }: {
        onChange: (date: Date | null) => void
        value: Date | null
    }) => (
        <input
            data-testid="date-time-picker"
            value={value ? value.toISOString() : ''}
            onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
            readOnly
        />
    ),
}))

jest.mock('react-calendar/dist/Calendar.css', () => ({}))
jest.mock('react-clock/dist/Clock.css', () => ({}))
jest.mock('react-datetime-picker/dist/DateTimePicker.css', () => ({}))

// NumberInput のスタブ
jest.mock('@tremor/react', () => ({
    NumberInput: ({
        defaultValue,
        onValueChange,
        placeholder,
    }: {
        defaultValue: number
        onValueChange: (val: number) => void
        placeholder?: string
        min?: number
        className?: string
    }) => (
        <input
            data-testid="number-input"
            type="number"
            defaultValue={defaultValue}
            placeholder={placeholder}
            onChange={(e) => onValueChange(Number(e.target.value))}
        />
    ),
}))

// ---- モック済みモジュールの import ----
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { upsertCouponAsAdmin } from '@/queries/coupon'
import AdminCouponDetails from './admin-coupon-details'
import { createMockCoupon, createMockStore } from '@/config/test-fixtures'

// ---- beforeEach でモック関数を設定 ----
const mockRefresh = jest.fn()
const mockToast = jest.fn()

beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh })
    ;(useToast as jest.Mock).mockReturnValue({ toast: mockToast })
})

// ==================================================
// AdminCouponDetails — レンダリング
// ==================================================
describe('AdminCouponDetails', () => {
    describe('レンダリング', () => {
        it('正常系: data なしで新規作成フォームが描画される', () => {
            // Arrange / Act
            render(<AdminCouponDetails />)

            // Assert
            expect(screen.getByText('Coupon Information')).toBeInTheDocument()
            expect(screen.getByText('Create a new coupon.')).toBeInTheDocument()
            expect(
                screen.getByRole('button', { name: /Create Coupon/i })
            ).toBeInTheDocument()
        })

        it('正常系: data ありで編集フォームが描画される', () => {
            // Arrange
            const coupon = {
                ...createMockCoupon(),
                store: createMockStore({ name: 'My Shop' }),
            }

            // Act
            render(<AdminCouponDetails data={coupon as never} />)

            // Assert
            expect(screen.getByText(`Update ${coupon.code} coupon.`)).toBeInTheDocument()
            expect(
                screen.getByRole('button', { name: /Save Coupon information/i })
            ).toBeInTheDocument()
        })

        it('正常系: data ありでストア名が表示される', () => {
            // Arrange
            const coupon = {
                ...createMockCoupon(),
                store: createMockStore({ name: 'My Shop' }),
            }

            // Act
            render(<AdminCouponDetails data={coupon as never} />)

            // Assert
            expect(screen.getByText('My Shop')).toBeInTheDocument()
        })

        it('正常系: 新規作成時に Store ID フィールドが表示される', () => {
            // Arrange / Act — data なし（id なし）
            render(<AdminCouponDetails />)

            // Assert
            expect(screen.getByText('Store ID')).toBeInTheDocument()
        })

        it('正常系: 編集時に Store ID フィールドが表示されない', () => {
            // Arrange
            const coupon = {
                ...createMockCoupon({ id: 'coupon-123' }),
                store: createMockStore(),
            }

            // Act
            render(<AdminCouponDetails data={coupon as never} />)

            // Assert
            expect(screen.queryByText('Store ID')).not.toBeInTheDocument()
        })

        it('正常系: Active スイッチが存在する', () => {
            // Arrange / Act
            render(<AdminCouponDetails />)

            // Assert
            expect(screen.getByText('Active')).toBeInTheDocument()
        })
    })

    describe('フォーム送信 — 正常系', () => {
        it('正常系: 新規クーポン送信時に upsertCouponAsAdmin が呼ばれる', async () => {
            // Arrange
            ;(upsertCouponAsAdmin as jest.Mock).mockResolvedValue({
                id: 'new-coupon',
                code: 'NEW10',
            })
            render(<AdminCouponDetails />)

            // Act — コード・discount(≥1)・storeId を入力して submit
            // discount デフォルト 0 は z.number().min(1) に違反するため先に変更する
            fireEvent.change(
                screen.getAllByPlaceholderText('Coupon code')[0],
                { target: { value: 'NEW10' } }
            )
            fireEvent.change(
                screen.getByTestId('number-input'),
                { target: { value: '10' } }
            )
            const storeIdInput = screen.getByPlaceholderText('Store ID')
            fireEvent.change(storeIdInput, { target: { value: 'store-xyz' } })
            fireEvent.click(screen.getByRole('button', { name: /Create Coupon/i }))

            // Assert
            await waitFor(() => {
                expect(upsertCouponAsAdmin).toHaveBeenCalled()
            })
        })

        it('正常系: 送信成功時に toast が表示され router.refresh が呼ばれる', async () => {
            // Arrange
            // startDate/endDate を文字列で渡す（z.string() の要求を満たすため）
            const coupon = {
                ...createMockCoupon({ id: 'coupon-123', code: 'SAVE10' }),
                startDate: '2024-01-01T00:00:00',
                endDate: '2027-01-01T00:00:00',
                store: createMockStore(),
            }
            ;(upsertCouponAsAdmin as jest.Mock).mockResolvedValue(coupon)
            render(<AdminCouponDetails data={coupon as never} />)

            // Act
            fireEvent.click(
                screen.getByRole('button', { name: /Save Coupon information/i })
            )

            // Assert
            await waitFor(() => {
                expect(mockToast).toHaveBeenCalledWith(
                    expect.objectContaining({ title: 'Coupon has been updated.' })
                )
                expect(mockRefresh).toHaveBeenCalled()
            })
        })
    })

    describe('フォーム送信 — 異常系', () => {
        it('異常系: upsertCouponAsAdmin 失敗時に destructive toast が表示される', async () => {
            // Arrange
            ;(upsertCouponAsAdmin as jest.Mock).mockRejectedValue(
                new Error('このクーポンコードは既に使用されています')
            )
            const coupon = {
                ...createMockCoupon({ id: 'coupon-123' }),
                startDate: '2024-01-01T00:00:00',
                endDate: '2027-01-01T00:00:00',
                store: createMockStore(),
            }
            render(<AdminCouponDetails data={coupon as never} />)

            // Act
            fireEvent.click(
                screen.getByRole('button', { name: /Save Coupon information/i })
            )

            // Assert
            await waitFor(() => {
                expect(mockToast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        variant: 'destructive',
                        title: 'Oops!',
                        description: 'このクーポンコードは既に使用されています',
                    })
                )
            })
        })

        it('異常系: 非 Error オブジェクトのスロー時に汎用メッセージを表示する', async () => {
            // Arrange — Error インスタンスではないオブジェクトをスロー
            ;(upsertCouponAsAdmin as jest.Mock).mockRejectedValue('string error')
            const coupon = {
                ...createMockCoupon({ id: 'coupon-123' }),
                startDate: '2024-01-01T00:00:00',
                endDate: '2027-01-01T00:00:00',
                store: createMockStore(),
            }
            render(<AdminCouponDetails data={coupon as never} />)

            // Act
            fireEvent.click(
                screen.getByRole('button', { name: /Save Coupon information/i })
            )

            // Assert
            await waitFor(() => {
                expect(mockToast).toHaveBeenCalledWith(
                    expect.objectContaining({
                        variant: 'destructive',
                        description: 'An unknown error occurred',
                    })
                )
            })
        })
    })
})
