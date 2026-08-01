/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CellContext } from '@tanstack/react-table'
import type { Coupon } from '@prisma/client'

// ---- モジュールモック（jest.mock は hoisting されるため変数参照禁止）----
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
    useParams: jest.fn(),
}))

jest.mock('@/hooks/use-toast', () => ({
    useToast: jest.fn(),
}))

jest.mock('@/providers/modal-provider', () => ({
    useModal: jest.fn(),
}))

jest.mock('@/queries/coupon', () => ({
    deleteCoupon: jest.fn(),
    getCoupon: jest.fn(),
}))

jest.mock('@/queries/product', () => ({
    deleteProduct: jest.fn(),
}))

jest.mock('@/lib/utils', () => ({
    ...jest.requireActual('@/lib/utils'),
    getTimeUntil: jest.fn().mockReturnValue({ days: 30, hours: 12 }),
}))

jest.mock('@/components/ui/alert-dialog', () => ({
    AlertDialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
    AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="alert-dialog-content">{children}</div>
    ),
    AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
    AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
        <h2>{children}</h2>
    ),
    AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
        <p>{children}</p>
    ),
    AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
    AlertDialogCancel: ({
        children,
        ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button data-testid="alert-cancel" {...props}>
            {children}
        </button>
    ),
    AlertDialogAction: ({
        children,
        onClick,
        disabled,
    }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button data-testid="alert-action" onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
}))

jest.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
    DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
    DropdownMenuItem: ({
        children,
        onClick,
        disabled,
    }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button data-testid="dropdown-item" onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
    DropdownMenuSeparator: () => <hr />,
}))

jest.mock('@/components/dashboard/shared/custom-modal', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('@/components/dashboard/forms/coupon-details', () => ({
    __esModule: true,
    default: () => <div data-testid="coupon-details" />,
}))

// ---- モック済みモジュールの import（jest.mock より後に配置）----
import { useRouter, useParams } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { useModal } from '@/providers/modal-provider'
import { getCoupon } from '@/queries/coupon'
import { columns } from './columns'
import { createMockCoupon } from '@/config/test-fixtures'

// ---- beforeEach でモック関数を設定 ----
const mockRefresh = jest.fn()
const mockToast = jest.fn()
const mockSetOpen = jest.fn()
const mockSetClose = jest.fn()

const TEST_STORE_URL = 'test-store'

beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh })
    ;(useParams as jest.Mock).mockReturnValue({ storeUrl: TEST_STORE_URL })
    ;(useToast as jest.Mock).mockReturnValue({ toast: mockToast })
    ;(useModal as jest.Mock).mockReturnValue({
        setOpen: mockSetOpen,
        setClose: mockSetClose,
    })
})

// ---- テストデータ ----
// startDate/endDate は Prisma スキーマ上 string だが、
// モックでは Date を使用するため unknown 経由でキャスト
const mockCoupon = {
    ...createMockCoupon(),
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-01-01'),
} as unknown as Coupon

const ACTIONS_COLUMN_INDEX = 5

// ---- ヘルパー: cell を直接呼び出してレンダリング ----
function renderCell(colIndex: number, data: Coupon) {
    const col = columns[colIndex]
    if (!('cell' in col) || typeof col.cell !== 'function') {
        throw new Error(`column[${colIndex}] has no cell renderer`)
    }
    return render(
        col.cell({
            row: { original: data },
        } as unknown as CellContext<Coupon, unknown>)
    )
}

/**
 * actions セルを描画して「Edit Details」をクリックし、
 * setOpen に渡された fetchData コールバックを取り出す。
 */
function clickEditAndGetFetchData(): () => Promise<unknown> {
    renderCell(ACTIONS_COLUMN_INDEX, mockCoupon)
    fireEvent.click(screen.getByText('Edit Details'))

    expect(mockSetOpen).toHaveBeenCalledTimes(1)
    const fetchData = mockSetOpen.mock.calls[0][1]
    if (typeof fetchData !== 'function') {
        throw new Error('setOpen に fetchData コールバックが渡されていない')
    }
    return fetchData as () => Promise<unknown>
}

// ==================================================
// columns 配列の構造定義
// ==================================================
describe('columns 配列の構造', () => {
    it('正常系: 6列定義されている', () => {
        expect(columns).toHaveLength(6)
    })

    it('正常系: accessorKey が正しい順序で定義されている', () => {
        // Arrange / Act
        const keys = columns
            .filter((c) => 'accessorKey' in c)
            .map((c) => ('accessorKey' in c ? c.accessorKey : null))
        // Assert
        expect(keys).toEqual([
            'code',
            'discount',
            'startDate',
            'endDate',
            'timeleft',
        ])
    })
})

// ==================================================
// 編集モーダル — 取得成功・失敗の両系統
// ==================================================
describe('編集モーダルの fetchData', () => {
    it('正常系: getCoupon の結果を rowData として返す', async () => {
        // Arrange
        const fetched = { ...mockCoupon, code: 'FETCHED10' }
        ;(getCoupon as jest.Mock).mockResolvedValue(fetched)

        // Act
        const fetchData = clickEditAndGetFetchData()
        const result = await fetchData()

        // Assert
        expect(getCoupon).toHaveBeenCalledWith(mockCoupon.id, TEST_STORE_URL)
        expect(result).toEqual({ rowData: fetched })
        expect(mockToast).not.toHaveBeenCalled()
        expect(mockSetClose).not.toHaveBeenCalled()
    })

    it('異常系: getCoupon が reject してもコールバックは throw しない', async () => {
        // Arrange
        ;(getCoupon as jest.Mock).mockRejectedValue(
            new Error('Forbidden: store not owned by current user.')
        )
        const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {})

        // Act
        const fetchData = clickEditAndGetFetchData()

        // Assert
        await expect(fetchData()).resolves.toEqual({})
        consoleSpy.mockRestore()
    })

    it('異常系: getCoupon が reject したら destructive トーストで通知する', async () => {
        // Arrange
        ;(getCoupon as jest.Mock).mockRejectedValue(new Error('DB unreachable'))
        const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {})

        // Act
        const fetchData = clickEditAndGetFetchData()
        await fetchData()

        // Assert
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({ variant: 'destructive' })
            )
        })
        consoleSpy.mockRestore()
    })

    it('異常系: getCoupon が reject したらモーダルを閉じる', async () => {
        // Arrange
        ;(getCoupon as jest.Mock).mockRejectedValue(new Error('DB unreachable'))
        const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {})

        // Act
        const fetchData = clickEditAndGetFetchData()
        await fetchData()

        // Assert — 現況を確認できていないため行スナップショットのまま編集させない
        expect(mockSetClose).toHaveBeenCalledTimes(1)
        consoleSpy.mockRestore()
    })

    it('異常系: getCoupon が reject したら構造化ログを出力する', async () => {
        // Arrange
        ;(getCoupon as jest.Mock).mockRejectedValue(new Error('DB unreachable'))
        const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {})

        // Act
        const fetchData = clickEditAndGetFetchData()
        await fetchData()

        // Assert
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[CouponColumns:EditDetails]'),
            expect.objectContaining({ error: 'DB unreachable' })
        )
        consoleSpy.mockRestore()
    })
})
