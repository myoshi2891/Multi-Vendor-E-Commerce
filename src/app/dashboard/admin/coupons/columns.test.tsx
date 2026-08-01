/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { CellContext } from '@tanstack/react-table'

// ---- モジュールモック（jest.mock は hoisting されるため変数参照禁止）----
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(),
}))

jest.mock('@/hooks/use-toast', () => ({
    useToast: jest.fn(),
}))

jest.mock('@/providers/modal-provider', () => ({
    useModal: jest.fn(),
}))

jest.mock('@/queries/coupon', () => ({
    deleteCouponAsAdmin: jest.fn(),
    getCouponAsAdmin: jest.fn(),
    toggleCouponActive: jest.fn(),
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
        <button
            data-testid="alert-action"
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    ),
}))

jest.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children: React.ReactNode }) => (
        <>{children}</>
    ),
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
    default: ({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
    ),
}))

jest.mock('@/components/dashboard/forms/admin-coupon-details', () => ({
    __esModule: true,
    default: () => <div data-testid="admin-coupon-details" />,
}))

// ---- モック済みモジュールの import（jest.mock より後に配置）----
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { useModal } from '@/providers/modal-provider'
import {
    deleteCouponAsAdmin,
    getCouponAsAdmin,
    toggleCouponActive,
} from '@/queries/coupon'
import { columns } from './columns'
import type { AdminCouponType } from './columns'
import { createMockCoupon, createMockStore } from '@/config/test-fixtures'

// ---- beforeEach でモック関数を設定 ----
const mockRefresh = jest.fn()
const mockToast = jest.fn()
const mockSetOpen = jest.fn()
const mockSetClose = jest.fn()

beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh })
    ;(useToast as jest.Mock).mockReturnValue({ toast: mockToast })
    ;(useModal as jest.Mock).mockReturnValue({
        setOpen: mockSetOpen,
        setClose: mockSetClose,
    })
})

// ---- テストデータ ----
const mockStore = createMockStore({ id: 'store-001', name: 'Test Store' })
// startDate/endDate は Prisma スキーマ上 string だが、
// モックでは Date を使用するため unknown 経由でキャスト
const mockCoupon = {
    ...createMockCoupon(),
    store: mockStore,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-01-01'),
} as unknown as AdminCouponType

// ---- ヘルパー: cell を直接呼び出してレンダリング ----
function renderCell(colIndex: number, data: AdminCouponType) {
    const col = columns[colIndex]
    if (!('cell' in col) || typeof col.cell !== 'function') {
        throw new Error(`column[${colIndex}] has no cell renderer`)
    }
    return render(
        col.cell({
            row: { original: data },
        } as unknown as CellContext<AdminCouponType, unknown>)
    )
}

// ==================================================
// columns 配列の構造定義
// ==================================================
describe('columns 配列の構造', () => {
    it('正常系: 8列定義されている', () => {
        expect(columns).toHaveLength(8)
    })

    it('正常系: accessorKey が正しい順序で定義されている', () => {
        // Arrange / Act
        const keyed = columns.filter((c) => 'accessorKey' in c)
        const keys = keyed.map((c) => ('accessorKey' in c ? c.accessorKey : null))
        // Assert
        expect(keys).toEqual([
            'store',
            'code',
            'discount',
            'startDate',
            'endDate',
            'timeleft',
            'isActive',
        ])
    })

    it('正常系: header ラベルが正しい順序で定義されている', () => {
        // Arrange / Act
        const headers = columns
            .filter((c) => 'header' in c)
            .map((c) => ('header' in c ? c.header : null))
        // Assert
        expect(headers).toEqual([
            'Store',
            'Code',
            'Discount',
            'Start Date',
            'End Date',
            'Time Left',
            'Status',
        ])
    })
})

// ==================================================
// セルレンダラー
// ==================================================
describe('セルレンダラー', () => {
    it('正常系: store列 — ストア名を表示する', () => {
        renderCell(0, mockCoupon)
        expect(screen.getByText('Test Store')).toBeInTheDocument()
    })

    it('正常系: code列 — クーポンコードを表示する', () => {
        renderCell(1, mockCoupon)
        expect(screen.getByText('SAVE10')).toBeInTheDocument()
    })

    it('正常系: discount列 — 割引率を % 付きで表示する', () => {
        renderCell(2, mockCoupon)
        expect(screen.getByText('10%')).toBeInTheDocument()
    })

    it('正常系: startDate列 — 日付文字列を表示する', () => {
        renderCell(3, mockCoupon)
        expect(
            screen.getByText(new Date('2024-01-01').toDateString())
        ).toBeInTheDocument()
    })

    it('正常系: endDate列 — 日付文字列を表示する', () => {
        renderCell(4, mockCoupon)
        expect(
            screen.getByText(new Date('2025-01-01').toDateString())
        ).toBeInTheDocument()
    })

    it('正常系: timeleft列 — 残日数と時間を表示する', () => {
        renderCell(5, mockCoupon)
        expect(screen.getByText(/30 days and 12 hours/)).toBeInTheDocument()
    })

    it('正常系: isActive=true のとき Active バッジを表示する', () => {
        renderCell(6, { ...mockCoupon, isActive: true })
        expect(screen.getByText('Active')).toBeInTheDocument()
    })

    it('正常系: isActive=false のとき Inactive バッジを表示する', () => {
        renderCell(6, { ...mockCoupon, isActive: false })
        expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
})

// ==================================================
// CellActions — アクションセル
// ==================================================
describe('CellActions', () => {
    function renderActions(data: AdminCouponType = mockCoupon) {
        return renderCell(7, data)
    }

    it('正常系: ドロップダウンメニューが描画される', () => {
        renderActions()
        expect(screen.getByText('Edit Details')).toBeInTheDocument()
    })

    it('正常系: isActive=true のとき Deactivate ボタンを表示する', () => {
        renderActions({ ...mockCoupon, isActive: true })
        expect(screen.getByText('Deactivate')).toBeInTheDocument()
    })

    it('正常系: isActive=false のとき Activate ボタンを表示する', () => {
        renderActions({ ...mockCoupon, isActive: false })
        expect(screen.getByText('Activate')).toBeInTheDocument()
    })

    it('正常系: Delete coupon ボタンが存在する', () => {
        renderActions()
        expect(screen.getByText('Delete coupon')).toBeInTheDocument()
    })

    it('正常系: Edit Details クリックで setOpen が呼ばれる', () => {
        // Arrange
        renderActions()
        // Act
        fireEvent.click(screen.getByText('Edit Details'))
        // Assert
        expect(mockSetOpen).toHaveBeenCalledTimes(1)
    })

    it('正常系: Deactivate クリックで toggleCouponActive が呼ばれ toast が表示される', async () => {
        // Arrange
        ;(toggleCouponActive as jest.Mock).mockResolvedValue(undefined)
        renderActions({ ...mockCoupon, isActive: true })

        // Act
        fireEvent.click(screen.getByText('Deactivate'))

        // Assert
        await waitFor(() => {
            expect(toggleCouponActive).toHaveBeenCalledWith(mockCoupon.id)
            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({ title: 'Coupon deactivated' })
            )
            expect(mockRefresh).toHaveBeenCalled()
        })
    })

    it('異常系: toggleCouponActive 失敗時に destructive toast が表示される', async () => {
        // Arrange
        ;(toggleCouponActive as jest.Mock).mockRejectedValue(
            new Error('Toggle failed')
        )
        renderActions({ ...mockCoupon, isActive: true })

        // Act
        fireEvent.click(screen.getByText('Deactivate'))

        // Assert
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    variant: 'destructive',
                    description: 'Toggle failed',
                })
            )
        })
    })

    it('正常系: AlertDialog の Delete ボタン押下で deleteCouponAsAdmin が呼ばれる', async () => {
        // Arrange
        ;(deleteCouponAsAdmin as jest.Mock).mockResolvedValue(undefined)
        renderActions()

        // Act
        fireEvent.click(screen.getByTestId('alert-action'))

        // Assert
        await waitFor(() => {
            expect(deleteCouponAsAdmin).toHaveBeenCalledWith(mockCoupon.id)
            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({ title: 'Deleted coupon' })
            )
            expect(mockRefresh).toHaveBeenCalled()
            expect(mockSetClose).toHaveBeenCalled()
        })
    })

    it('異常系: deleteCouponAsAdmin 失敗時に destructive toast が表示される', async () => {
        // Arrange
        ;(deleteCouponAsAdmin as jest.Mock).mockRejectedValue(
            new Error('Delete failed')
        )
        renderActions()

        // Act
        fireEvent.click(screen.getByTestId('alert-action'))

        // Assert
        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    variant: 'destructive',
                    description: 'Delete failed',
                })
            )
        })
    })
})

// ==================================================
// 編集モーダルの fetchData — 取得成功・失敗の両系統
//
// setOpen の fetchData は ModalProvider 側で fire-and-forget IIFE として実行される
// （ADR-003）。reject を fetchData 自身で処理しないと、provider の console.error
// だけが残りユーザーには何も伝わらず、行スナップショットのまま編集できてしまう。
// seller 版（[storeUrl]/coupons/columns.test.tsx）と同一の観点を admin 版にも敷く。
// ==================================================
describe('編集モーダルの fetchData', () => {
    function clickEditAndGetFetchData(): () => Promise<unknown> {
        renderCell(7, mockCoupon)
        fireEvent.click(screen.getByText('Edit Details'))

        expect(mockSetOpen).toHaveBeenCalledTimes(1)
        const fetchData = mockSetOpen.mock.calls[0][1]
        if (typeof fetchData !== 'function') {
            throw new Error('setOpen に fetchData コールバックが渡されていない')
        }
        return fetchData as () => Promise<unknown>
    }

    it('正常系: getCouponAsAdmin の結果を rowData として返す', async () => {
        // Arrange
        const fetched = { ...mockCoupon, code: 'FETCHED10' }
        ;(getCouponAsAdmin as jest.Mock).mockResolvedValue(fetched)

        // Act
        const fetchData = clickEditAndGetFetchData()
        const result = await fetchData()

        // Assert
        expect(getCouponAsAdmin).toHaveBeenCalledWith(mockCoupon.id)
        expect(result).toEqual({ rowData: fetched })
        expect(mockToast).not.toHaveBeenCalled()
        expect(mockSetClose).not.toHaveBeenCalled()
    })

    it('異常系: getCouponAsAdmin が reject してもコールバックは throw しない', async () => {
        // Arrange
        ;(getCouponAsAdmin as jest.Mock).mockRejectedValue(
            new Error('Only admins can perform this action.')
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

    it('異常系: getCouponAsAdmin が reject したら destructive トーストで通知する', async () => {
        // Arrange
        ;(getCouponAsAdmin as jest.Mock).mockRejectedValue(
            new Error('DB unreachable')
        )
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

    it('異常系: getCouponAsAdmin が reject したらモーダルを閉じる', async () => {
        // Arrange
        ;(getCouponAsAdmin as jest.Mock).mockRejectedValue(
            new Error('DB unreachable')
        )
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

    it('異常系: getCouponAsAdmin が reject したら構造化ログを出力する', async () => {
        // Arrange
        ;(getCouponAsAdmin as jest.Mock).mockRejectedValue(
            new Error('DB unreachable')
        )
        const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {})

        // Act
        const fetchData = clickEditAndGetFetchData()
        await fetchData()

        // Assert
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[AdminCouponColumns:EditDetails]'),
            expect.objectContaining({ error: 'DB unreachable' })
        )
        consoleSpy.mockRestore()
    })
})
