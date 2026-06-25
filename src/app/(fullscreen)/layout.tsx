// React
import { ReactNode } from 'react'

// Toaster
import { Toaster } from 'react-hot-toast'

/**
 * 全画面レイアウト用のラッパー。
 *
 * `(store)` グループの共通ヘッダー/フッターを意図的に持たないページ
 * （seller/apply の MinimalHeader 全画面フォーム、order 詳細の全画面レイアウト）を
 * 収容する。toast 挙動を維持するため Toaster のみ配置する。
 */
export default function FullscreenLayout({ children }: { children: ReactNode }) {
    return (
        <div>
            <div>{children}</div>
            <Toaster position="top-center" />
        </div>
    )
}
