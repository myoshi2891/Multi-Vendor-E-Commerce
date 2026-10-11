# Profile Wishlist — 要件

対象: `/profile/wishlist/[page]`（DS-PAGE-033）、WishlistContainer（DS-COMP-085）。[保存計画](../../../plans/layout-design/wishlist-design-system-plan.md)、[設計](design.md)、[タスク](tasks.md)、[進捗](PROGRESS.md)。

| ID | 受け入れ条件 | 検証 |
|---|---|---|
| PW-1 | Your Wishlistのh1、ブランドの見出し・余白、コレクションへの導線を正常・空・取得失敗時に表示する。 | RTL／Chromium |
| PW-2 | 既存商品詳細・wishlist追加・compareを持つeditorial商品カードを利用。現在ページの表示数のみ表示し、総保存数や金額を創作しない。 | RTL／カード回帰／Chromium |
| PW-3 | 空の場合はYour wishlist is empty.とExplore the collection（/browse）、取得失敗は汎用案内と現在ページを再読込するリンク。例外詳細を公開しない。 | RTL／Chromium（空） |
| PW-4 | Wishlist paginationに正しいURLのPrevious／Next・ページ番号リンク。現在ページは1件だけaria-current、先頭／末尾方向は非リンク。最大7番号で大量ページでも収まる。 | RTL／Chromium |
| PW-5 | ページ変更と戻る／進むの正本はURL。既存ページ正規化・範囲外redirect・/profile/wishlist→/1を維持する。 | RTL／Chromium |
| PW-6 | 390／768／1440pxで横スクロールなし、商品カードのfocusと比較操作、ページングのEnter操作、WCAG axe違反なし（contrast除外なし）。 | Chromium |
| PW-7 | loadingで状態告知と静的スケルトン。装飾はaria-hidden、読み込み領域はaria-busy。 | RTL |

対象外: 削除機能の追加（既存にない）、認可・DB・query変更、保存バリアントの取得仕様変更、共有カード全体の改修、購入・在庫変更。

## P2残存表示統一（2026-10-09）

Wishlistの見出し・件数・状態・罫線・ページャーをprofile shellのaccount aliasesへ接続。番号リンクは44×44px以上、current/disabled/hover/focusを統一。商品カードの既存editorial操作、URL・範囲補正・alias・取得失敗のreloadを保持する。

[計画](../../../plans/layout-design/priority-six-p2-residual-design-system-plan.md)／[証跡](../design-system/PROGRESS.md#p2残存6画面移行記録)。


## 優先8画面受け入れ（2026-10-11）

最終ページではNextを非リンク・aria-disabledとし、Previousのkeyboard操作と履歴復帰でもURL/currentを一致させる。全ページャリンク44×44px・focus contrast3:1以上。既存のeditorialカード・空/失敗/pending・件数は維持。
