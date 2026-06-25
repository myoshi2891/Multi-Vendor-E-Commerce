// React
import { ReactNode } from 'react'

// Layout chrome
import StoreHeader from '@/components/store/layout/header/header'
import Footer from '@/components/store/layout/footer/footer'

/**
 * 認証ページ（sign-in / sign-up）の共通レイアウト。
 *
 * 店舗フロントと統一感を出すため StoreHeader / Footer を供給する。
 * sticky footer パターン（`flex min-h-screen flex-col` + `<main>` を `flex-1`）で
 * 構成し、ヘッダーとフッターの間に Clerk のフォームを中央寄せする。
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col">
            <StoreHeader />
            <main className="flex flex-1 flex-col">{children}</main>
            <Footer />
        </div>
    )
}
