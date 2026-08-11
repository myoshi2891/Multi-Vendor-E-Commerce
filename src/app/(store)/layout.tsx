// React
import { ReactNode } from 'react'

// Toaster
import { Toaster } from 'react-hot-toast'

// Layout chrome
import StoreHeader from '@/components/store/layout/header/header'
import Footer from '@/components/store/layout/footer/footer'

// Footer は Server Component として `getSubcategories()` で Prisma を呼ぶため、
// この layout 配下の全ページが DB 依存になる（/legal など自身は DB を触らない
// 静的ページも含む）。宣言が無いとビルド時にビルドホストから DB へ接続を試み、
// CI（DATABASE_URL は到達不能な stub）で build が失敗する。
// 規約: .claude/steering/tech.md「DB 依存ページの動的レンダリング規約」
export const dynamic = 'force-dynamic'

/**
 * Renders the shared storefront layout with the store header, footer, and toast notifications.
 */
export default function StoreLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col">
            <StoreHeader />
            <div className="flex-1">{children}</div>
            <Footer />
            <Toaster position="top-center" />
        </div>
    )
}
