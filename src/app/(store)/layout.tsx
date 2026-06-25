// React
import { ReactNode } from 'react'

// Toaster
import { Toaster } from 'react-hot-toast'

// Layout chrome
import StoreHeader from '@/components/store/layout/header/header'
import Footer from '@/components/store/layout/footer/footer'

/**
 * 店舗フロントの共通レイアウト。
 *
 * ヘッダー（StoreHeader）とフッター（Footer）を全店舗ページで一度だけ描画する。
 * StoreHeader は cookies() を読むため、(store) サブツリーは request 時の
 * 動的レンダリングになる（個別ページへの force-dynamic 追記は不要）。
 */
export default function StoreLayout({ children }: { children: ReactNode }) {
    return (
        <div>
            <StoreHeader />
            <div>{children}</div>
            <Footer />
            <Toaster position="top-center" />
        </div>
    )
}
