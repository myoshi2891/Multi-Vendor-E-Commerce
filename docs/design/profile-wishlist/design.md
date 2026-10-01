# Profile Wishlist — 設計

## 構成

- profile共通枠を維持。`[page]/page.tsx`はServer ComponentのままgetUserWishlistを呼び、動的レンダリングを保持。ブランドmetadataを追加する。
- `wishlist/heading.tsx`にh1・リード・コレクションリンクを集約し、pageとloadingで再利用。
- `wishlist.module.css`は一覧本文に限定。濃緑#17251d、アイボリーの共通枠、ゴールド装飾、濃いゴールド#75613bのリンク／focus、本文#536356。Georgiaの見出しと日本語リード。
- ProductListの既存editorialモードを使用。profile本文では最大3列、1100px以下は2列。共有ProductCardやqueryは変更せず、既存商品リンク・比較・wishlist追加を維持する。

## 状態

- 正常: 現在ページの表示数、page／totalPages、商品カードとページャ。
- 空: Heart装飾（aria-hidden）、h2 Your wishlist is empty.、日本語案内、/browseリンク。
- 取得失敗: queryのみをtry/catchで囲み、role=alertの汎用案内とa[href=/profile/wishlist/{page}]でフル再読込。失敗詳細は表示しない。
- 範囲外: query後のcanonicalPage判定は取得catchの外でredirectをthrowする。既存ページ番号のnormalizePageParamを保持する。
- loading.tsx: 共通見出しとrole=status、aria-busy、6枚の静的スケルトン（aria-hidden）。アニメーションを追加しない。

## ページング

WishlistContainerはClient state／useEffect／router.pushを除去し、Server ComponentのLinkナビゲーションにする。現在のpropsとURLを正本として戻る／進むで旧currentPageへのpushが発生しない構成。

現在ページ周辺の最大5番号と先頭／末尾をSetで重複排除し昇順に表示（最大7番号）、間隔が空くところに装飾ellipsis。Previous／Nextは境界で非リンクとなり、1ページ以下ではページャを表示しない。番号にaria-label=Page N、現在番号にaria-current=page。モバイルで番号列は独立して折り返す。

## 検証

[保存計画](../../../plans/layout-design/wishlist-design-system-plan.md)。RTLで新要件のRed、card/query/sidebar回帰。Chromiumはテスト顧客に既存カタログ11商品のお気に入りだけを作成し、空／10商品／最終1商品のページ、比較操作・キーボード・axe・範囲外と戻るを確認。テスト顧客の後処理によりfixtureを除去し、商品作成／seed／DB初期化／購入は行わない。取得失敗とloadingはRTL確認、ブラウザでの強制障害再現は行わない。
