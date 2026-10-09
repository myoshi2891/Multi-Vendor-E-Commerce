# Profile Overview — 要件

- 対象: `/profile`（DS-PAGE-029）、共通layout／sidebar（DS-COMP-077）、会員情報（078）、注文概要（079）。
- 保存計画: [profile-design-system-plan](../../../plans/layout-design/profile-design-system-plan.md)。
- [設計](design.md)、[タスク](tasks.md)、[進捗](PROGRESS.md)。

## 機能・受け入れ条件

| ID | 要件 | 検証 |
|---|---|---|
| PO-1 | 認証済み顧客にMy accountのh1とブランド表現を表示。未認証は既存request proxyでサインインへ転送する。 | Chromium |
| PO-2 | Clerkの氏名の大文字小文字と画像を保持。氏名未設定はYour account。取得失敗はAccount details are unavailableと通常再読込リンク。未認証の会員情報は描画しない。 | RTL |
| PO-3 | Wishlist／Following／Viewedの既存URLを保持。未実装Coupons／Shopping creditはComing soonの非リンク表示。 | RTL |
| PO-4 | 注文全件とunpaid／toShip／shipped／deliveredへのリンクを保持。注文数・残高を創作しない。注文サポートは/contact、問題相談は/disputeに接続。 | RTL |
| PO-5 | Account navigationは既存10リンクを保持し、現在ページの親リンク1件のみaria-current。ページング・注文フィルターでも親を選択。 | RTL／Chromium |
| PO-6 | 深緑・アイボリー・ゴールド、セリフ見出し、本文サンセリフ。1440／390／768pxで折り返し・横スクロールなし。focus可視、Tab／Enter操作可能、axe WCAG AA違反なし。 | Chromium |
| PO-7 | 共通枠変更後も注文・住所・設定ページへ遷移できる。Clerk設定UIの表示とモバイル横スクロールなしを確認。 | Chromium |

## 対象外

注文・購入・認可・DBスキーマ／API変更、実在しない注文統計、Coupons／creditの機能実装、プロフィール子ページ本文の全面移行、Clerk設定フォームの置き換え。

## P2共通トークン接続（2026-10-09）

profile shellは既存store限定purchase themeを合成し、accountの文字・面・罫線・focus・意味色を役割別に接続する。固定lightのaccount枠、ナビゲーションと既存子ページ機能は維持する。[計画](../../../plans/layout-design/priority-six-p2-residual-design-system-plan.md)。
