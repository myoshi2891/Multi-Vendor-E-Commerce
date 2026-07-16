# Findings 08 — Direction（将来機能・raw・未 vet）

> Explore サブエージェント報告（2026-07-03 / HEAD `f9752c0`）。**Phase 3 の vet 前の生データ**。
> プレイブック（§9 / Finding format / Prioritization rubric）と recon.md の読了確認済み。
> **重要な検証結果（冒頭報告）**: recon の「残り候補」画面は**すべて実装済み** — `src/app/dashboard/admin/orders/page.tsx`、`src/app/dashboard/admin/coupons/page.tsx`、`src/app/dashboard/seller/stores/[storeUrl]/inventory/page.tsx`（`src/queries/inventory.ts` に接続済み）が存在。stale-doc ルールに従い direction からは除外（DX 側の stale doc 問題として扱う）。
> スコープ外遵守: 多通貨・税計算・高度分析・配送キャリア連携（`product.md:33-36`）は提案していない。プロンプトインジェクション様コンテンツ・秘密値の再現なし。

### [DIRECTION-01] Refunded 遷移時に実際の Stripe/PayPal 返金を実行する（資金移動ダウンストリーム）

- **Evidence**: `src/queries/order.ts:554-560` — `updateOrderPaymentStatus` の docstring が「Stripe/PayPal の決済 API は呼ばない」と明言し DB status のみ変更。`specs/multi-vendor-ecommerce/08-open-questions.md:7-9` — "The downstream refund processing (... Stripe/PayPal refund) ... remain out of scope."。`docs/design/support-forms/design.md:511` — 運営返金フローは後続扱い。
- **Impact**: 現状 ADMIN が注文を `Refunded` にしても**資金は動かない** — 返金は Stripe/PayPal ダッシュボードで手動発行が必要で、2システムが静かに乖離。これを閉じると payment-status 操作が authoritative になり、手動でエラーを誘発する運用ステップが消える。ADMIN KPI「運用維持コストの低減」に直結。
- **Effort**: L（粗い見積）— プロバイダ返金 API 呼び出し、部分/全額返金セマンティクス、冪等性、webhook との突合、監査ログ。
- **Risk**: HIGH — 実際の資金移動。二重返金/部分返金バグは金銭的に重大。リトライに対して冪等でプロバイダ webhook と突合必須。
- **Confidence**: HIGH — 「DB のみ・決済 API は呼ばない」境界がコードと仕様に逐語で記載。
- **Design spike が先に答えるべき問い**: 部分返金対応か全額のみか？返金の source of truth（アプリ起点 vs プロバイダ webhook 起点）？冪等キー戦略？既存の `updateOrderPaymentStatus` 内 `PaymentStatus`↔`OrderStatus`↔`OrderItem` カスケードとの相互作用？

### [DIRECTION-02] Cancelled/Returned/Refunded 時の在庫復元（restock）フックの実装

- **Evidence**: `src/queries/order.ts` — `// TODO(在庫連動・スコープ外): status が Canceled/Returned のとき在庫復元フックをここに（判断5-2）`。`order.ts:286` — モジュールレベル注記「在庫連動はスコープ外・TODO コメントのフック位置のみ残す」。`08-open-questions.md:7-8` が "stock restock" をスコープ外ダウンストリームとして命名。restock は `placeOrder`（`src/queries/user.ts`、原子的 `$transaction`）の既存 decrement の鏡像。
- **現 HEAD の実装状態（実測で確定）**: **未実装**。`updateOrderItemStatusAsAdmin` 内に
  上記 TODO コメントが**残存**しており、restock の書き込みは存在しない
  （return 文の直前がフック位置）。本 finding の前提は現在も有効。
  > **行番号のドリフトに注意**: 監査時点（2026-07-03 / HEAD `f9752c0`）の `order.ts:538` は
  > 現 HEAD では **`order.ts:530`** に移動している。**引用行をそのまま現 HEAD に
  > 当てはめないこと**（[`VETTED_FINDINGS.md`](VETTED_FINDINGS.md) 冒頭のラウンド継続運用
  > 参照）。プラン化時は行番号ではなく **TODO 文字列で grep** して位置を特定すること:
  > `grep -n "TODO(在庫連動・スコープ外)" src/queries/order.ts`
- **Impact**: 現状、キャンセル/返品/返金された商品の在庫は**二度と戻らない** — 返品のたびに販売可能数が恒久的に過少計上され、SELLER KPI「在庫管理の操作性」を直接毀損、幻の在庫切れで GMV を押し下げる。注文時 decrement は存在するのに逆方向 restore が無い非対称。
- **Effort**: M — 既存 status 遷移 `$transaction` 内への restock 書き込み + 二重 restock ガード。
- **Risk**: MED — 冪等必須（Cancelled→Cancelled の再発火や admin 操作の繰り返しで二重加算しない）。`placeOrder` と同じトランザクション規律が必要。
- **Confidence**: HIGH — フック位置と意図がコードに明記。
- **Design spike が先に答えるべき問い**:
  - 「item ごとに restock はちょうど 1 回」を保証する状態は何か
    （`restocked` フラグ vs status 履歴からの導出）？
  - **発火条件を status ごとに分離して決めること**（一括で「Cancelled/Returned/Refunded で
    restock」と決めない）:
    | status | 発火条件の候補 | 論点 |
    |---|---|---|
    | **Cancelled** | **status 単独で発火**してよい | 出荷前のキャンセルであり、商品は物理的に手元にある。返金の有無と在庫の所在は独立 |
    | **Returned** | **status 単独で発火**してよい（ただし「返品**到着**」を意味する status か要確認） | 商品が戻ってきたことが在庫復元の根拠。「返品**申請**」段階で復元すると幻の在庫になる |
    | **Refunded** | **返金完了と結合すべき**（status 単独では発火させない） | Refunded は**金銭の状態**であって商品の所在を意味しない。返金したが商品は未返送というケースで在庫が増える（= 実在庫との乖離）。DIRECTION-01（実 Stripe/PayPal 返金実行）と結合し、**返金完了 かつ 商品返送確認**を条件にするのが安全側 |
    > **なぜ分離が必要か**: 3 つを同じ条件で扱うと、**Refunded の扱いが最も危険**になる。
    > 「返金 = 在庫が戻る」は成り立たない（返金だけして商品は顧客の手元、という
    > 正当なケースがある）。この誤りは幻の在庫を生み、本 finding が解こうとしている
    > 「幻の在庫切れ」の**逆方向の同じ病**（実在しない在庫の販売 = オーバーセル）になる。
  - DIRECTION-01 の返金実行と結合するか、status 単独で発火するかは**上表のとおり
    status ごとに答えが異なる**ため、spike ではこの粒度で結論を出すこと。

### [DIRECTION-03] 運営向けサポートチケットコンソール（閲覧 + status 更新）の構築

- **Evidence**: `src/queries/support.ts:16` は `createSupportTicket`（公開受付）のみ公開 — read/update action が**存在しない**。`prisma/schema.prisma:757,766` — `SupportTicket` は `status String @default("OPEN")` + `@@index([category, status])`。`docs/design/support-forms/design.md:92` — 「運営対応ステータス。閲覧 UI は後続（本 MVP は保存のみ）」、`:511` — 「運営対応ステータスを操作する管理 UI は無い（スコープ外・§4 要件）」。`08-open-questions.md:8-9` — operator 側チケット閲覧/更新 UI はスコープ外と明記。
- **Impact**: 返品依頼・紛争チケット（`category=RETURN_REQUEST`/`DISPUTE`）が**収集されるだけで誰にも表示されない** — write-only 受付という create-without-read の非対称で、送信はブラックホール行き。ADMIN 向け一覧/詳細 + status 遷移で support-forms 機能全体が actionable になり、DIRECTION-01/02 の自然な前段（返金/restock 判断の起点はチケット）。ADMIN ペルソナと USER の信頼に寄与。
- **Effort**: M — `requireAdmin` ガード付きの `getSupportTickets`/`updateTicketStatus` action ペア + admin/orders の既存 TanStack table パターンを再利用した一覧/詳細ページ。
- **Risk**: LOW — read + 狭い status write。既存 admin テーブル + auth-guard パターンがそのまま移植可能。
- **Confidence**: HIGH
- **Design spike が先に答えるべき問い**: `status` を自由 `String` から enum/状態機械へ昇格するか（design §4 はワークフロー確定まで意図的に String 維持）？合法遷移は？RETURN_REQUEST チケットのクローズは DIRECTION-01/02 をトリガーするか？

### [DIRECTION-04] 設計済みの i18n 基盤（next-intl）の立ち上げ

- **Evidence**: `docs/design/i18n-localization/` に設計文書一式（`requirements.md`, `design.md`, `tasks.md`, `PROGRESS.md`）。`README.md:1-5` が `next-intl` 辞書基盤をゴールと明記。**実装ゼロ**: `package.json` に `i18n`/`next-intl` 依存なし、`src/` に i18n コードなし、`src/i18n/` なし。`README.md:20` が具体的な痛みを文書化: `src/lib/schemas.ts` は現在英語（L8）と日本語（L658）の文字列が混在。
- **Impact**: 約51ページ / 269コンポーネントに UI 文字列がハードコードされた「半英半日」状態が文書化されたまま放置 — コピーの SSOT なし。基盤착지（辞書 + `next-intl` 配線、ja デフォルト）で全ペルソナの不整合を解消し、将来の `en.json` を解放。USER のチェックアウト理解を改善（KPI: チェックアウト完了率 / カート離脱）。
- **Effort**: L — ただし設計自体が独立 PR 5フェーズに分割済みで、Phase 0 基盤単体は M。
- **Risk**: MED — `layout.tsx`、`next.config.mjs`、Zod スキーマファクトリに触れる。設計が Zod のモジュール定数ロケール束縛と Clerk `(auth)` ローカライズを open question として明示。
- **Confidence**: HIGH（意図の根拠。設計文書完備）— リスクは設計自身の未解決事項。
- **Design spike が先に答えるべき問い**: 設計が先送りした Zod-i18n 判断（ファクトリ vs 注入）の解決。Clerk ローカライズオプションの確認。Cookie-`NEXT_LOCALE`（ルーティングなし）方式が `force-dynamic` 規約と両立するかの検証 — Phase 0 コミット前に。

### [DIRECTION-05] エラーモニタリング/可観測性の導入（SaaS ロードマップ Phase 5）— Phase 2/3 ではなく次の infra ステップとして

- **Evidence**: `docs/architecture/saas-roadmap.md:76` — Phase 5「監視 + ログ基盤（Sentry 等）」。`package.json`・`src/` に sentry 参照なし。対照的に Phase 2（orgId+RLS、roadmap:74）と Phase 3（課金、roadmap:39-48）はロードマップ自身のヘッダ（roadmap:3-4, :64）が「現時点では不要／個人開発の現フェーズでは不要」とゲート済みで、存在しないマルチテナント需要を前提とする。一方、本番の信頼性ギャップは recon で追跡中: OI-9（ホーム `/` の本番 SSR 500）と OI-11（seller ダッシュボードの本番 SSR ReferenceError）。
- **Impact**: Phase 2（RLS）と Phase 3（課金）は時期尚早 — ロードマップ自身が単一テナントの現状では不要とマークし、RLS は現在ドライバーのないマルチテナント追求の大規模変更。Phase 5 が自然な次ステップ: **本番限定クラッシュが既知なのに自動捕捉がなく**、運営は障害を事後的にしか知れない。エラーモニタリングは ADMIN 運用性に即座に効き、USER のチェックアウト完了率を直接保護。現行コード状況で最もレバレッジの高いロードマップフェーズ。
- **Effort**: M — SDK 導入 + Next.js 16.2.1 の instrumentation hook + CI での source-map アップロード。既存の構造化ログ規約（`console.error("[Module:Function]", { error, stack })`）を置換でなく補完。
- **Risk**: LOW — 追加的な計装。主な注意点はイベントに PII/秘密を載せないこと（リクエストボディのスクラブ）。
- **Confidence**: MED — ロードマップのフェーズは明示（意図は HIGH）。「次はどのフェーズか」はロードマップ自身のゲート文言 + 追跡中の本番インシデントから論証した判断。
- **Design spike が先に答えるべき問い**: Sentry か **Next.js 16.2.1**/Turbopack 互換の代替か？監査ルールが禁じる秘密/PII クラスをイベントが運ばないためのスクラブポリシー？現行 `console.error` 構造化ログを包含するか併存するか？
  > **Next の版表記は `16.2.1`（実測のインストール実体）に統一する**。本ファイル内および
  > 他の findings（[`findings-06-dependencies.md`](findings-06-dependencies.md) DEPS-08）と
  > 揃えること。「Next.js 16」のような系列表記と混在させると、SDK の互換性判定
  > （どの版で検証したか）が読めなくなる。
