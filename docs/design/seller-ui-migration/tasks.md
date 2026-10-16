# 販売者6画面移行タスク

[保存計画](../../../plans/layout-design/priority-six-design-system-plan.md)／[証跡](../design-system/PROGRESS.md#優先6画面移行記録)。

- [x] DS-PAGE-061 商品登録: TDD・実装・補助検証・文書同期。
- [x] DS-PAGE-060 バリアント追加: TDD・実装・補助検証・文書同期。
- [x] DS-PAGE-059 バリアント編集: TDD・実装・補助検証・文書同期。
- [x] DS-PAGE-064 配送設定: TDD・実装・補助検証・文書同期。
- [x] DS-PAGE-063 店舗設定: TDD・実装・補助検証・文書同期。
- [x] DS-PAGE-065 店舗作成: TDD・実装・補助検証・文書同期。
- [ ] 認証後6実ルートと必要なSDK実描画。


- [x] 最終共有部品回帰、画像キーボード/配送空状態、全体Jest、仕様/台帳/QA/coverage同期。実測と解除条件は[証跡](../design-system/PROGRESS.md#優先6画面移行記録)。

## 販売者クーポン デザイン移行（2026-10-05）

- [x] DS-PAGE-054: Red→Green→Refactor・関連検証・仕様同期。
- [ ] 認証後実ルートと必要なSDKの受け入れ確認（補助検証と区別）。

証跡: [P3移行記録](../design-system/PROGRESS.md#p3優先6画面移行記録)。

## クーポン作成 デザイン移行（2026-10-05）

- [x] DS-PAGE-053: Red→Green→Refactor・関連検証・仕様同期。
- [ ] 認証後実ルートと必要なSDKの受け入れ確認（補助検証と区別）。

証跡: [P3移行記録](../design-system/PROGRESS.md#p3優先6画面移行記録)。


## 販売者優先8画面残存移行

2026-10-10。[保存計画](../../../plans/layout-design/priority-eight-seller-residual-design-system-plan.md). 既存本体適用と今回の残存受け入れを区別する。

- [x] 共通基盤: TDD・実装・関連検証・文書同期。認証後実ルート受け入れは別途保留。

- [x] Step 1 店舗概要 — DS-PAGE-058: TDD・実装・関連検証・文書同期。認証後実ルート受け入れは別途保留。

- [x] Step 2 商品一覧 — DS-PAGE-062: TDD・実装・関連検証・文書同期。認証後実ルート受け入れは別途保留。

- [x] Step 3 在庫 — DS-PAGE-055: TDD・実装・関連検証・文書同期。認証後実ルート受け入れは別途保留。

- [x] Step 4 注文 — DS-PAGE-057: TDD・実装・関連検証・文書同期。認証後実ルート受け入れは別途保留。

- [x] Step 5 メッセージ — DS-PAGE-056: TDD・実装・関連検証・文書同期。認証後実ルート受け入れは別途保留。

- [x] Step 6 商品登録 — DS-PAGE-061: TDD・実装・関連検証・文書同期。認証後実ルート受け入れは別途保留。

- [x] Step 7 配送 — DS-PAGE-064: TDD・実装・関連検証・文書同期。認証後実ルート受け入れは別途保留。

- [x] Step 8 店舗設定 — 操作と保存状態: TDD・実装・関連検証・文書同期。認証後実ルート受け入れは別途保留。


## ストアフロント残存8画面 Step 8（2026-10-12）

出店申請はpurchase tokens、説明summary/前後/完了導線44px、フォーム境界3:1。四段階、validation/入力保持/pending/error/retry/successとpayloadを維持。

[承認済み計画](../../../plans/layout-design/priority-eight-storefront-residual-design-system-plan.md)／[検証証跡](../design-system/PROGRESS.md#ストアフロント残存8画面移行記録2026-10-12)。補助検証と実認証/SDK受け入れを区別する。


### ストアフロント残存8画面・最終受け入れ（2026-10-12）

今回の表示変更は実装・関連仕様同期・3幅の補助/実route確認を完了。pending/error/retry/successはadapter/RTL、実routeは読取の表示確認として区別する。実followingは空、履歴は既存商品あり、申請はguest/認証後第1段階。実更新/送信/uploadの既存保留は維持。[最終証跡](../design-system/PROGRESS.md#ストアフロント残存8画面移行記録2026-10-12)／[QA正本](../../testing/QA_HANDOFF.md#ds-storefront-eight-acceptance)。


### P3残存8画面 Step 4（2026-10-13）

DS-PAGE-054 販売者クーポン一覧: 作成/編集triggerと編集Portalの入力・保存操作を44pxへ拡張。コード検索/日付/STORE scope/削除/取得失敗/入力保持/retry/閉じるlock/focus復帰を維持。 1440/768/390px × light/dark、keyboard/focus、axe AAを既存harnessで検証。業務契約は保持。実routeと補助検証は別判定。

[計画](../../../plans/layout-design/priority-eight-p3-residual-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p3残存8画面移行記録2026-10-13)。


### P3残存8画面 Step 5（2026-10-13）

DS-PAGE-053 販売者クーポン作成: standalone CouponFormへcontrols・成功意味色を接続。seller light input tokenを50%へ調整し実境界contrast3:1以上を確保。入力/payload/日付/割引/保存/入力保持/retry/navigationを維持。共通callerを最終回帰する。 1440/768/390px × light/dark、keyboard/focus、axe AAを既存harnessで検証。業務契約は保持。実routeと補助検証は別判定。

[計画](../../../plans/layout-design/priority-eight-p3-residual-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p3残存8画面移行記録2026-10-13)。


### P3残存8画面 Step 6（2026-10-13）

DS-PAGE-060 バリアント追加: seller限定Select/属性Portalへpopover opt-inを追加し、3px角丸・影なし・popover面/文字tokenを適用。カテゴリ/継承項目/属性scope/payloadとEscape復帰を維持。 1440/768/390px × light/dark、keyboard/focus、axe AAを既存harnessで検証。業務契約は保持。実routeと補助検証は別判定。

[計画](../../../plans/layout-design/priority-eight-p3-residual-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p3残存8画面移行記録2026-10-13)。


### P3残存8画面 Step 7（2026-10-13）

DS-PAGE-059 バリアント編集: seller限定の動的行削除は残る行の先頭入力へfocusを戻す。最低1行の削除buttonをdisabledにし、既定caller/価格/画像/属性/値保持/保存payloadを維持。useLayoutEffectでDOM更新後にfocusし入力編集では移動しない。 1440/768/390px × light/dark、keyboard/focus、axe AAを既存harnessで検証。業務契約は保持。実routeと補助検証は別判定。

[計画](../../../plans/layout-design/priority-eight-p3-residual-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p3残存8画面移行記録2026-10-13)。


### P3残存8画面 Step 8（2026-10-13）

DS-PAGE-065 店舗作成: 独立headerのworkspaceリンクを44pxとhoverへ接続し、ThemeToggle Portalへ既存popover opt-inを適用。フォーム/payload/no-id/返却URL/画像adapter/Featured/validation/pending/error/retryを保持。sixのupsertStore adapterを現行のok/id/url結果へ修正（業務コード変更なし）。 1440/768/390px × light/dark、keyboard/focus、axe AAを既存harnessで検証。業務契約は保持。実routeと補助検証は別判定。

[計画](../../../plans/layout-design/priority-eight-p3-residual-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p3残存8画面移行記録2026-10-13)。


## 受け入れ未完了8 Step 8（2026-10-16）

DS-PAGE-004 出店申請。既存実装の回帰確認（新規Redなし・追加改修不要）。seven apply6/6: 3幅の4段階・入力保持・upload adapter・validation/pending/error/retry/success・説明summary/44px/focus・axe AA。認証後read-only1/1内3幅、guest3/3。Contact/About/申請関連RTL計17/17。実routeのClerk読込とPrevious無効/Next有効の準備完了を待ち、動的DOM列挙のraceを解消（製品Redではない）。PC/390px画像目視、型0・lint0 errors/既存8 warnings。実Cloudinary upload/申請保存は対象外で既存保留を維持。既存4段階・schema・payload・業務契約は変更不要。 [証跡](../design-system/PROGRESS.md#受け入れ未完了8画面2026-10-16)。


- [x] 販売者8再監査 Step 1 DS-PAGE-058（2026-10-16）: 店舗概要 ✅ Completed (2026-10-16)。詳細は販売者8再監査計画・design-system PROGRESS参照。


- [x] 販売者8再監査 Step 2 DS-PAGE-062（2026-10-16）: 商品一覧 ✅ Completed (2026-10-16)。詳細は販売者8再監査計画・design-system PROGRESS参照。


- [x] 販売者8再監査 Step 3 DS-PAGE-055（2026-10-16）: 在庫管理 ✅ Completed (2026-10-16)。詳細は販売者8再監査計画・design-system PROGRESS参照。


- [x] 販売者8再監査 Step 4 DS-PAGE-057（2026-10-16）: 注文一覧 ✅ Completed (2026-10-16)。詳細は販売者8再監査計画・design-system PROGRESS参照。


- [x] 販売者8再監査 Step 5 DS-PAGE-056（2026-10-16）: メッセージ ✅ Completed (2026-10-16)。詳細は販売者8再監査計画・design-system PROGRESS参照。


- [x] 販売者8再監査 Step 6 DS-PAGE-061（2026-10-16）: 商品登録 ✅ Completed (2026-10-16)。詳細は販売者8再監査計画・design-system PROGRESS参照。
