# 管理者ダッシュボード 3 機能 — 進捗トラッカ

> このファイルは [tasks.md](./tasks.md) の **Phase 進捗の SSOT**（どこまで完了し、次にどこから着手するか）。
> 全体の履歴・テスト統計は [docs/PROGRESS.md](../../PROGRESS.md) を正とする（本ファイルは Phase 単位の現在地）。
> 要件は [requirements.md](./requirements.md)、設計は [design.md](./design.md)。

---

## 🧭 現在地（2026-06-16 時点）

- ✅ **Phase 1（F2 注文管理）完了** — 1-A〜1-D すべて実装・検証済み。
- ✅ **Phase 2（F1 ダッシュボード統計）完了** — 2-A（統計 query）+ 2-B（KPI カード / 売上チャート / 最近リスト UI）を実装・検証済み（2026-06-15）。
- ✅ **Phase 3（F3 クーポン横断管理）完了** — 3-A〜3-E すべて実装・SonarCloud QG 修復済み（2026-06-16）。
- ✅ **Phase 4（null セーフ化先行）完了** — Phase 5 スキーマ破壊変更の前提を整備済み。
- ✅ **Phase 5（F3-第2段 platform-wide クーポン発行）完了** — 5-A〜5-C すべて実装・E2E 検証済み（2026-06-16）。
- 👉 **次の着手: なし（tasks.md 全 Phase 完了）**。残課題（在庫連動・PartiallyRefunded 部分返金）は別タスク。

---

## Phase 1: F2 注文管理（スキーマ変更なし）✅ 完了

| Task | 内容 | 状態 | コミット / 備考 |
| --- | --- | --- | --- |
| 1-A | admin 注文 query 5 種（`getAllOrders` / `getOrderForAdmin` / `updateOrderGroupStatusAsAdmin` / `updateOrderItemStatusAsAdmin` / `updateOrderPaymentStatus`）+ 親子連動 `reconcileParentOrderStatus` | ✅ | `1747f32` / `7083681` / `ff15259` / `d88063a`（2026-06-13） |
| 1-B | `AdminOrderType` 型追加 | ✅ | `445ad00` |
| 1-C | `OrderStatusSelect` を discriminated union 化（seller/admin）+ 既存 seller 呼び出し 3 箇所に `mode` 付与 + `any` 是正 | ✅ | `refactor(ui): make OrderStatusSelect props a discriminated union` |
| 1-D | admin 注文管理ページ（`/dashboard/admin/orders` の `page.tsx` + `columns.tsx`）。Store 列・group ごとの Status 変更・詳細モーダル | ✅ | `feat(admin): add cross-store order management page and columns` |
| — | order.ts カバレッジ補完（SonarCloud New Code Coverage 修復・PR #133） | ✅ | `38a9bbe`（2026-06-13） |

> **検証**: tsc 0 / lint 0 errors / test 1251 passed（変動なし）/ build 成功（`/dashboard/admin/orders` = Dynamic）。

### Phase 1 でスコープ外（後続に引き継ぎ）

- `updateOrderPaymentStatus` の **paymentStatus 手動変更 UI**（design §3.3 の「DB のみ変更・決済 API 非連携」警告付き UI / §3.5 runbook）。1-D は OrderGroup の**配送ステータス**変更のみ結線済み。詳細モーダル拡張として別途実装。
- 在庫連動（TODO フックのみ・[判断5-2]）。

---

## Phase 2: F1 ダッシュボード統計 ✅ 完了（2026-06-15）

| Task | 内容 | 状態 | コミット / 備考 |
| --- | --- | --- | --- |
| 2-A | 統計 query（`src/queries/dashboard.ts` 新規）: `getAdminDashboardStats`（`Promise.all` + `unstable_cache` 20分）/ `getSalesOverTime` / `getRecentOrders` / `getRecentStores` | ✅ | `f871919`〜`0f42b91`（2026-06-15） |
| 2-B | F1 UI（`admin/page.tsx` 置換 + `components/dashboard/admin/*`）: KPI カード + 売上チャート（`@tremor/react`・依存追加なし）+ 最近の注文/ストア | ✅ | `4ed7fdd`（2026-06-15） |

> **検証**: tsc 0 / lint 0 errors / test 1302 passed（+21）/ 型エラー 0。

---

## Phase 3: F3-第1段 クーポン横断管理 + isActive 列 ✅ 完了（2026-06-16）

| Task | 内容 | 状態 | コミット / 備考 |
| --- | --- | --- | --- |
| 3-A | スキーマ第1段（`Coupon.isActive` 追加・`migrate dev`・後方互換）+ ERD 再生成 | ✅ | `b4095bd` / `bc95656` |
| 3-B | `isActive` 再検証（`placeOrder` / `applyCoupon`） | ✅ | `669ad3d`（placeOrder）/ `b4095bd`（applyCoupon） |
| 3-C | admin クーポン query（`getAllCoupons` / `upsertCouponAsAdmin` (P2002) / `deleteCouponAsAdmin` / `toggleCouponActive`） | ✅ | `c4693b1` Red / `982c765` Green |
| 3-D | Zod `AdminCouponFormSchema` | ✅ | `958af7a` |
| 3-E | F3 UI（coupons ページ・columns・admin フォーム）+ SonarCloud QG 修復（CouponFormFields 抽出・カバレッジ追加） | ✅ | `31dcf68`〜`9d12e90`（2026-06-16 QG 修復） |

> **検証**: tsc 0 / lint 0 errors / test 1387 passed / SonarCloud QG Green（PR #138）。

---

## Phase 4: 下位互換性確保（null セーフ化先行・スキーマ非変更）✅ 完了（2026-06-16）

| Task | 内容 | 状態 | コミット / 備考 |
| --- | --- | --- | --- |
| 4-1 | `applyCoupon`（`coupon.ts:294`）`coupon.store.name` → `coupon.store?.name ?? '全店舗'` | ✅ | `04c9636` |
| 4-2 | `saveUserCart`（`user.ts:1135-1150`）確認 → ternary ガード済みにつき変更不要 | ✅ | — |
| 4-3 | `place-order.tsx:127` / admin `columns.tsx:62` の `coupon.store.name` → null セーフ | ✅ | `a977236` |
| 4-4 | `bunx tsc --noEmit` 0 errors / test 1387 passed / lint 0 errors 確認 | ✅ | — |

> **検証**: tsc 0 / lint 0 errors / test 1387 passed（テスト数変動なし・リファクタのみ）。

---

## Phase 5: F3-第2段 platform-wide 発行（破壊的・決済波及）✅ 完了（2026-06-16）

> **`safe-migration` skill 必須・厳格な直列・最後に単独実施。**

| Task | 内容 | 状態 | コミット / 備考 |
| --- | --- | --- | --- |
| 5-A | スキーマ第2段（`CouponScope` enum + `storeId` nullable 化）+ ERD 再生成 | ✅ | `7d3b31d` |
| 5-B | 影響箇所 3 改修（`placeOrder` 按分 / `applyCoupon` Decimal 化 / `updateCheckoutProductWithLatest` null ガード）+ Zod superRefine + `upsertCouponAsAdmin` + seller `upsertCoupon` P2002 + admin UI scope ドロップダウン | ✅ | `182b6a5`〜`1e1749a` |
| 5-C | E2E 検証（PLATFORM クーポン購入フロー）+ `applyCoupon` Decimal シリアライズ漏れ修正 | ✅ | `ae9364f` / `3463d1d` |

> **検証**: tsc 0 / lint 0 errors / test 1398 passed（5-C はテスト数変動なし）/ Playwright `platform-coupon.spec.ts` (chromium) green。残課題（在庫連動・PartiallyRefunded 部分返金）は別タスク。

---

## レビュー必須ポイント（着手前に確認）

- [ ] platform-wide クーポンの按分（端数の最終グループ吸収）が会計要件と合致するか（Phase 5）。
- [ ] `paymentStatus` 手動変更が DB のみ（決済 API 非連携）で運用上問題ないか（Phase 1 の後続 UI）。

### P4カテゴリ一覧移行（2026-10-06）

DS-PAGE-043は既存管理者theme内の名前付きページ、検索可能な階層一覧、Action Props経由の編集/作成/削除を使用する。validation・送信ロック・値保持retry・statusとPortal themeを提供する。業務制約と認可・DBは変更なし。補助検証済み・認証後受け入れ保留。[証跡](../design-system/PROGRESS.md#p4優先6画面移行記録)。

- 2026-10-06 Step 2: DS-PAGE-042 カテゴリ作成は本体適用・補助検証済み・認証後受け入れ保留。既存業務契約とAction Props境界を維持。[証跡](../design-system/PROGRESS.md#p4優先6画面移行記録)。

- 2026-10-06 Step 3: DS-PAGE-045 管理者クーポン一覧は本体適用・補助検証済み・認証後受け入れ保留。既存業務契約とAction Props境界を維持。[証跡](../design-system/PROGRESS.md#p4優先6画面移行記録)。

- 2026-10-06 Step 4: DS-PAGE-044 管理者クーポン作成は本体適用・補助検証済み・認証後受け入れ保留。既存業務契約とAction Props境界を維持。[証跡](../design-system/PROGRESS.md#p4優先6画面移行記録)。

- 2026-10-06 Step 5: DS-PAGE-047 オファータグ一覧は本体適用・補助検証済み・認証後受け入れ保留。既存業務契約とAction Props境界を維持。[証跡](../design-system/PROGRESS.md#p4優先6画面移行記録)。

- 2026-10-06 Step 6: DS-PAGE-046 オファータグ作成は本体適用・補助検証済み・認証後受け入れ保留。既存業務契約とAction Props境界を維持。[証跡](../design-system/PROGRESS.md#p4優先6画面移行記録)。

## P4管理マスタ6画面（2026-10-06）

カテゴリ・管理者クーポン・オファータグの各一覧/新規作成（DS-PAGE-043/042/045/044/047/046）を既存管理者themeへ適用。専用Client/formとAction Props列factory、共通MasterDialog/SaveFeedbackを使用し、編集取得・欠落/失敗/retry・pending重複/close lock・値保持・statusを提供する。coupon toggle、カテゴリ階層/親制限/slug/画像/featured、coupon scope/storeId/日時/割引、offer name/url/更新IDを維持する。

実装・補助検証の6Stepは完了。認証後実ルートと実SDKの受け入れは保留として別管理する。[状態と自己レビュー](../design-system/PROGRESS.md#p4優先6画面移行記録)、[解除条件](../../testing/QA_HANDOFF.md#ds-p4-six-browser)。既存データ/認可/業務queryは変更なし。

2026-10-09: 属性一覧の個別UI/編集PortalとAction境界を移行。関連RTL28/28、補助browser6/6。認証後実ルートは未確認。[証跡](../design-system/PROGRESS.md#監査指摘6画面移行記録)。

2026-10-09 Step 5: 属性新規は見出し・カテゴリ取得失敗・入力/送信状態を適用。RTL14/14・補助browser6/6。認証後受け入れ保留。

2026-10-09 Step 6: 属性選択肢・編集Portal・注入Action・属性scope44pxを適用。属性+P4 RTL66/66、選択肢browser6/6、touch1/1。認証後実受け入れは保留。[証跡](../design-system/PROGRESS.md#監査指摘6画面移行記録)。

Refactor後の最終p4全56/56、属性+既存P4 RTL66/66、touch/surface追加回帰1/1。3幅×light/darkの画像/AA/操作確認済み。認証後ADMIN実ルートは保存済みログイン状態未提供で保留。

### 管理マスタ8 Step 1（2026-10-14）

Red: MasterDialog作成trigger高さ40pxで6件失敗。Green/Refactor: triggerへcontrol、独立Portalへcontrolsを接続。新6件+親select/reduced-motion1件7/7、既存一覧6/6、関連RTL29/29、型成功、lint0 errors/既存8 warnings。画像aria-hidden proxy入力への検査失敗はテスト対象誤りでRedに含めず除外。390px dark画像確認。既存取得/保存/削除/URL/親候補を保持。

### 管理マスタ8 Step 2（2026-10-14）

Red: standalone入力高さ40pxで6件失敗。Green/Refactor: CategoryFormへcontrols、Featured labelへcontrolを適用。p4新旧カテゴリ作成12/12、関連RTL31/31、型成功、lint0 errors/既存8 warnings。3幅/light/dark、親Root/候補・label操作・画像button・入力境界/focus・validation/保存失敗/retry・axe、390px dark画像目視。既存payload/slug/親深さ/Featured/作成遷移を保持。

### 管理マスタ8 Step 3（2026-10-14）

Red: メニュー角丸6px（期待3px）で6件失敗、続いて展開時aria-hidden-focusを6件検出。Green/Refactor: styles.popoverとmodal=falseを属性行メニューへ適用。p4新旧属性一覧12/12、関連RTL38/38、型成功、lint0 errors/既存8 warnings。light/dark・3幅・面/影/角丸・menu item44px・focus/Escape・編集/失敗保持/retry・axe、390px dark画像確認。key/scope/archive/convert/URL契約を保持。

### 管理マスタ8 Step 4（2026-10-14）

Red: 保存成功statusが通常文字色でbrand-success不一致、6件失敗。Green/Refactor: 共通SaveFeedbackへsuccess意味色を接続。p4新旧属性作成12/12、関連RTL22/22、型成功、lint0 errors/既存8 warnings。boolean label44px・ENUM選択・送信/validation/失敗保持/retry・axeと390px dark画像確認。最初の誤ったsubmit名による中断はRedに含めない。カテゴリ/型/scope/key/payload/遷移は不変。

### 管理マスタ8 Step 5（2026-10-14）

Red: 行メニュー角丸6pxで6件失敗。Green/Refactor: 属性一覧と同じpopover/non-modalを選択肢行へ明示。p4新旧選択肢12/12、関連RTLは2ファイルをrunTestsByPathで確認、型成功、lint0 errors/既存8 warnings。3幅/light/dark・menu/編集Portal・Value disabled/Label境界/focus・追加/失敗保持/retry・archive/empty・axe、390px dark画像確認。definitionId/value/label/状態契約は不変。

### 管理マスタ8 Step 6（2026-10-14）

Red: Activate/Deactivate button高さ40pxで6件失敗。Green/Refactor: ToggleCouponへcontrolを明示。p4新旧一覧12/12、関連RTL38/38、型成功、lint0 errors/既存8 warnings。3幅/light/dark・pending lock・error/retry・同一couponId payload・success意味色・編集/削除/空/取得失敗・axe、390px dark画像確認。scope/期間/有効化/Decimal表示投影と既存Action契約を保持。

### 管理マスタ8 Step 7（2026-10-14）

Red: 独立scope select高さ37pxで6件失敗。Green/Refactor: CouponFormへcontrols、Active labelへcontrolと共有controlの最小幅44px、native checkbox accentをprimaryへ接続。p4新旧作成12/12、関連RTL23/23、型成功、lint0 errors/既存8 warnings。scope切替/Store ID・日時/割引/Active label操作・境界/focus・保存失敗/retry・axeを確認。3幅/light/dark、scope/storeId/isActive/payloadと既存refreshを保持。

### 管理マスタ8 Step 8（2026-10-14）

既存実装回帰（新規Redなし）: 共有MasterDialog/SaveFeedbackの適用を確認。p4新旧一覧+対象外独立作成18/18、関連RTL15/15、型成功、lint0 errors/既存8 warnings。3幅/light/dark・取得失敗/retry44px・入力境界/focus・編集/削除/値保持/成功・axe、390px dark画像確認。追加の固有改修なし。name/url/作成と編集のID/遷移を保持。

## 管理マスタ8最終統合（2026-10-14）

全体Jest3168 passed / 3171 total（3 skipped）、327スイート（326 passed／1 skipped）、127 snapshots。Statements88.26%（10969/12428）／Branches78.63%（6785/8628）／Functions84.66%（2147/2536）／Lines88.79%（9988/11248）。dashboard408 files / 405 lcov / 18 of 80 cells。補助ブラウザーp4 104/104＋p3 73/73、認証後実ルート48/48（1440/768/390px × light/dark）。 実ルートは既存専用DBと既存Clerk管理者を読み取り利用し、表示・検索・編集データ取得・メニュー/ダイアログ開閉・Escape focus復帰・44px/境界3:1・theme・overflow・全体axe AAを確認。実保存・削除・archive/restore・型変換・有効化・画像uploadは範囲外で、失敗/retry/pending/successはfixture/RTLで検証。アカウント作成・seed・DB初期化なし。DS-PAGE-046独立オファータグ作成は共有回帰のみ。
