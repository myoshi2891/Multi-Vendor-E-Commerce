# Profile Overview — 設計

## 共通枠と表示

- `src/app/(store)/profile/layout.tsx`はServer Component。store共通header/footerの内側に深緑のアカウント帯、Home／Accountのパンくず、アイボリーの共通枠を配置する。
- `src/components/store/profile/profile.module.css`をlayout・sidebar・会員情報・注文概要で共有。テーマ変数はshell内に限定し、他のページやPortalへグローバルな上書きを追加しない。
- 色: 深緑#0b100e、アイボリー#f3f0e8、面#faf8f2、文字#17251d、本文#536356、装飾#d4ba83、明るい面のリンク／focus#75613b。見出しはGeorgia、日本語本文は既存本文フォント。
- PCは220pxナビゲーションと残り本文の2列。1000px以下でsidebar185px、800px以下で1列と3列メニュー、480px以下で2列メニュー。注文カードは4列→2列、ショートカットは5列→3列→2列。
- page.tsxにMy accountのh1とブランドmetadata。既存ProfileOverview／OrdersOverviewをServer Componentとして描画。

## 会員情報と取得状態

- ProfileOverviewの既存currentUser呼び出しをtry/catchで囲み、失敗時はalertとa[href=/profile]を表示（フル再読込）。エラー詳細や個人情報は表示しない。
- 正常時はtrimした氏名（大文字小文字保持）またはYour account。Clerk画像を64pxで描画し氏名をaltにする。userがnullなら会員情報は描画しない。認証の入口は既存proxyのまま。
- クイックリンクと準備中表示を別定数にし、実装のない機能にhrefを付けない。注文カードはlucideの装飾アイコンへ移行し、旧AVIFはこの部品から参照しない。

## ナビゲーションと注文

- ProfileSidebarのみClient ComponentでusePathnameを利用。hrefの末尾/1を除いたbaseと完全一致またはbase/配下で選択判定し、Overviewは/profile完全一致のみ。注文とページングの親リンクにaria-current=pageを付与する。
- ラベル付きAccount navigation／Account shortcuts、会員情報・注文のh2とaria-labelledby、装飾aria-hidden、focus輪郭を備える。
- My appeal／In disputeの無操作行は、既存Contact／Disputeへの実リンクとして明確な名前で表示する。フィルターのケース（toShip等）は既存URLを保持。
- 共通枠は全profile子ルートへ適用。子ページ本文やClerk UserProfile appearanceの全面移行は別作業であり、台帳を完了扱いにしない。

## 検証

[要件](requirements.md)と[移行計画](../../../plans/profile-design-system-plan.md)。RTLで会員情報とエラー、href、選択状態。Playwrightで実Clerkテスト認証を使い、3画面幅、Tab／Enter、axe、子ページ導線、未認証転送を確認。テストユーザーは既存createCustomerSessionで作成・後処理し、Clerk公式testingのsignInでサインインする。seed／DB初期化／注文送信はしない。
