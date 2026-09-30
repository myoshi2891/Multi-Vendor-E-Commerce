# Wishlist デザインシステム移行計画

- 日付: 2026-09-30。ユーザー依頼の `/profile/wishlist/1` とページングを対象。
- 対象: DS-PAGE-033、DS-COMP-085。DS-PAGE-034は `/profile/wishlist`→`/profile/wishlist/1` の回帰確認のみ。
- 変更: 既存profile共通枠のアイボリー／濃緑／ゴールド、セリフ見出し。既存ProductListのeditorial表示を利用し、カードの商品詳細・wishlist追加・compareを保持。削除は既存にないため追加しない。
- ページングは状態＋effectからURLのLinkへ変更し、戻る／進むやprops更新時に旧ページへ戻る問題を防ぐ。最大5番号と境界ページ／ellipsisを表示する。
- 空状態はコレクション導線、取得失敗は汎用案内と通常再読込、loadingは静的なスケルトンと状態告知を表示。
- 依存: 共通profile枠、getUserWishlist、ProductList／ProductCard editorial、既存10件/page。DB・認可・フィルター・共有カード全体の変更は対象外。

## 受け入れ条件・先行テスト

- h1 Your Wishlistを維持し、空／通常／失敗のすべてでブランド見出しと/browseへの導線を表示。件数は現在ページの表示数のみで総保存数を創作しない。
- 商品リストはeditorial表示を利用。3列以下でprofile本文に収まり、390／768／1440pxで横スクロールなし。カードのfocus、商品詳細・compareの既存動作を保持。
- Wishlist paginationは番号・Previous／Nextが正しいURLを指し、現在ページ1件だけaria-current。先頭／末尾では該当方向が非リンク。多ページでも最大7番号＋ellipsisで収まる。
- ページパラメーター正規化と範囲外の既存redirectを保持し、redirect例外は取得のtry/catchで捕捉しない。
- RTLを先行し、空・失敗・リンク・ページ変更／再描画・loadingを検証。既存queryとcard回帰も実行。
- 認証後Chromiumで空／10商品／最終ページ、1440／390／768px、キーボード、focus、axe（contrast除外なし）、URLのページング／ブラウザ戻る、既存redirectを確認。
- 実E2Eテストユーザーと既存カタログへのお気に入りfixtureだけを作成し、ユーザーの後処理で除去。商品作成／seed／DB初期化／購入は行わない。
- 最終lint、tsc、diff、仕様リンク・台帳整合。

## 文書同期

profile-wishlist requirements/design/tasks/PROGRESSを新設。本計画、SDD 01-requirements／07-testing、design-system adoption-plan／PROGRESS、QA_HANDOFF、TEST_IMPLEMENTATION_PLAN、docs/PROGRESS、coverage dashboard（部分実行から全体統計を推測しない）。

## 最終結果

- Red: 新RTL5件失敗／既存正規化・redirect回帰1件成功。Chromium新要件5件失敗を実測。
- Green／Refactor後: loadingの既存実装回帰1件を追加し、関連Jest4 suites／87件成功。Chromium5/5成功（50.7s）、1440／390／768px、空・10商品・最終1商品、比較・focus・Enter、axe違反0、URLページング・ブラウザ戻る・alias／範囲外／不正パラメーターを確認。
- lint 0 errors／既存12 warnings、変更対象ESLint無警告、tsc成功、diffチェック成功。仕様・台帳・QA同期済み。全体Jest／coverage、Firefox／WebKitは未実行。
- 未コミット。証跡は[wishlist移行記録](../docs/design/design-system/PROGRESS.md#wishlist移行記録)。
