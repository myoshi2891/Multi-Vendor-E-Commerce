# 04. 汎用骨組みのアーキテクチャ方針 — 10本柱

> 位置づけ: [拡張計画ドキュメント群](README.md)の第4章。統合元: Round 2 ブループリント §4
> （柱①〜⑤）/ Round 3 ブループリント §3（柱⑥〜⑩）。
> 各柱は spike プラン 1 本（`plans/013〜022`・未追跡の advisor 作業領域）に対応する。
> **各 spike が「決めるべきこと」を確定させてから実装プランを生成する二段構え**であり、
> 設計確定時に本章の該当項目を決定事項で置き換える（[README 更新規約](README.md#更新規約)）。

**全体構造**: 柱①②が土台で、③⑤はこれらに依存する。④は①②から独立して着手でき、Phase A と並行可能（カタログ基盤・発見性 = 構造的性質 1〜4）。
柱⑨が⑥⑦⑩の共通前提で、⑥⑦⑩は「信頼ループ」、⑧は「成長」を担う（構造的性質 5〜6）。

---

## カタログ基盤・発見性（柱①〜⑤）

### ① カテゴリ N 階層ツリー（browse node 化）→ spike 013 ／ B-1 解消

- `Category` に self-relation（`parentId` + `depth` + materialized path）を導入し、
  `SubCategory` を統合する方向を第一候補として検討
- **影響範囲は本計画中最大**: `Product.categoryId/subCategoryId` の二重 FK、Zod スキーマ、
  商品フォーム、URL 構造（`filters.category`/`subCategory`）、admin UI、シーダー、E2E。
  spike の主目的は**移行戦略（新旧並走 or 一括移行）の確定**
- 決めるべきこと: ツリー表現（隣接リスト + path か closure table か）／旧 `SubCategory` の
  データ移行／URL 後方互換（既存 slug を生かすか）

### ② カテゴリ別属性スキーマ（ファセット基盤）→ spike 014 ／ B-2 解消

- カテゴリノードに「属性定義」（名前・型・単位・許容値・必須/任意・ファセット対象か）を紐づけ、
  商品/バリアントが「属性値」を持つ 2 層構造
- 既存 `Spec`（自由記述）は**残しつつ「その他仕様」へ降格**し、構造化属性を主役にする移行案を検討
- 決めるべきこと: 属性値の格納（正規化テーブル vs JSONB + GIN）／商品フォームの動的生成
  （React Hook Form + Zod の動的スキーマ）／[03 §2](03-category-taxonomy.md) の代表ファセットを
  シードにする範囲

### ③ ファセット検索・ブラウズ → spike 015 ／ B-3 解消

- tsvector を**生成列 + GIN インデックス**に載せ替え、対象を name/description から
  brand・variant keywords・カテゴリ名へ拡大
- ブラウズ（`getProducts`）と検索（`search-products` route）の**2系統を統合**し、
  属性ファセットの件数集計・価格ソートを追加
- 決めるべきこと: ファセット集計の実行方式（GROUP BY vs マテビュー vs キャッシュ）／
  参照データキャッシュ（監査 PERF-05）との統合／`filters: any`（`src/queries/product.ts:602`）の型付け

### ④ カタログガバナンス（出品審査）→ spike 016 ／ B-4 解消

- 既存の店舗承認（StoreStatus）の商品版: `Product` に公開状態（DRAFT / PENDING_REVIEW /
  ACTIVE / REJECTED / SUSPENDED 相当）を導入
- **審査モードをポリシーとして選べる**構造にする（全商品審査 / 新規販売者のみ / 事後審査）—
  ブランド未定のため、厳格さをデータで切り替えられることが「汎用骨組み」の要件
- 併せて BANNED/DISABLED 店舗の商品がストアフロントに露出していないかを検証し、
  漏れていれば公開クエリの共通 where に店舗状態を組み込む
- 決めるべきこと: `ProductStatus` という enum 名が**注文アイテム配送状態に既に使われている**
  （`prisma/schema.prisma:560`）ため命名の衝突回避／審査 UI は admin/orders の TanStack table
  パターン再利用

### ⑤ レコメンド基盤（ルールベース v1）→ spike 017 ／ B-5 解消

- 外部 ML 基盤なしで、既存シグナルの SQL 合成による v1:
  「同一リーフカテゴリ × views/sales 上位」（関連商品）、「共起注文」（一緒に購入）、
  「wishlist 人気」— `relatedProducts: []`（`src/queries/product.ts:1080`）のスロットを埋める
- **インターフェイスを固定**（`getRelatedProducts(productId, strategy)` のような seam）し、
  将来の協調フィルタリング/ベクタ検索への差し替え点を作ることが真の目的
- スコープ外の「高度な分析ダッシュボード」とは線を引く: レコメンドは購買動線の機能であり
  分析 UI は作らない

---

## 運用・信頼・成長（柱⑥〜⑩）

### ⑥ 返品・交換 RMA ワークフロー → spike 018 ／ B-6 解消

- `ReturnRequest`（仮称）エンティティを導入: 対象 `OrderItem`・数量・理由コード・
  解決種別（返金/交換/店舗クレジット）・状態機械（申請→承認/却下→返送待ち→受領検品→解決）
- 既存資産と接続する: 受付は `SupportTicket(RETURN_REQUEST)` からの昇格 or 注文履歴からの直接申請／
  解決時は `OrderItem.status` を `Returned` へ遷移／下流に返金実行（監査 DIRECTION-01）と
  restock（plan 012）が接続
- 決めるべきこと: SupportTicket と RMA の関係（昇格 or 並立）／状態機械の遷移ガード実装
  （現状 `updateOrderItemStatus` は任意遷移可能）／返品ポリシーのデータ化
  （期間・対象外カテゴリ。`Store.returnPolicy String` の構造化を含む）

### ⑦ レビュー・UGC 品質ガバナンス → spike 019 ／ B-7 解消

- レビューに (a) 購入検証バッジ（OrderItem 履歴との照合）、(b) モデレーション状態機械
  （公開/審査中/非公開/通報済み）+ 通報受付、(c) 評価集計の更新（Product と**死にフィールド化
  している `Store.averageRating`** の両方）、(d) helpful 投票の per-user 化（`likes Int` の置き換え）を導入
  - **注意**: `$transaction` は原子性は与えるが、並行レビューの read-modify-write（現在値を読んで
    平均を再計算し書き戻す）競合は防げない。集計更新はアトミックインクリメント／行ロック
    （`SELECT ... FOR UPDATE` 相当）／集計の再計算をトランザクション内で行う等で
    ロストアップデートを避けること（spike 019 の設計判断項目）
- モデレーションモード（事前/事後/無審査）は柱④と同じ「ポリシーをデータで差し替え」
- 決めるべきこと: 購入検証の判定基準（Delivered のみか）／通報の受け皿
  （SupportTicket 拡張 vs 専用モデル）／`rating Float` の Decimal 化の要否

### ⑧ プロモーション・キャンペーンエンジン → spike 020 ／ B-8 解消

- 3層で拡張する: (a) `Coupon` の表現力（型付き日付・固定額/率・利用回数上限・最低購入額・
  対象絞り込み）、(b) プラットフォーム主導キャンペーン エンティティ（期間・対象商品・割引・編成 —
  現状の販売者自己申告 `isSale` の上位構造）、(c) 価格履歴テーブル
  （二重価格表示の根拠・`saleEndDate String` の型付け直しを含む）
- 既存の PLATFORM クーポン基盤・CAS 適用・admin UI は再利用する
- 決めるべきこと: キャンペーンと variant セールの優先順位・併用規則／価格履歴の粒度
  （サイズ単位か variant 単位か）／セール自動終了の実行方式（cron vs 読み取り時判定）

### ⑨ 通知・トランザクショナルメッセージ基盤 → spike 021 ／ B-9 解消

- 3点セット: (a) `Notification` テーブル（アプリ内通知の SSOT・`Message.isRead` パターン踏襲）、
  (b) 送信チャネル抽象（in-app 必須 + email はプロバイダ差し替え可能な seam — 柱⑤の
  `strategy` seam と同じ発想）、(c) イベント→通知マッピングのデータ化
  （どのイベントでどのロールに何を送るか）
- **最初の消費者は柱④（審査合否）と柱⑥（RMA 状態遷移）**。注文状態遷移
  （`updateOrderGroupStatus` 等）への後付けも設計に含める
- 決めるべきこと: email プロバイダ選定（ADR 化）／送信の実行モデル
  （同期送信 vs Outbox テーブル + 遅延処理 — Vercel 環境の制約込み）／通知設定（ユーザーの opt-out）

### ⑩ セラーパフォーマンス指標と自動措置 → spike 022 ／ B-10 解消

- 3層: (a) **事実タイムスタンプ**（OrderItem/OrderGroup の状態遷移記録 — `shippedAt`/`deliveredAt`
  相当。イベントログ型 vs カラム型は spike で判断）、(b) 店舗メトリクス集約（遅延率 =
  約束 `shippingDeliveryMin/Max` vs 実績／キャンセル率／返品率／評価 — 柱⑦の集計修正が供給）、
  (c) 閾値ポリシー（データ化）→ 措置（警告 → DISABLED → BANNED）の接続
- 分析ダッシュボードは作らない（スコープ外）。措置判断と販売者への通知（⑨経由）に限定
- 決めるべきこと: タイムスタンプの持ち方（イベントログ vs 専用カラム）／集計の実行方式
  （リアルタイム vs 日次バッチ）／自動措置の human-in-the-loop 要件（BANNED は人間承認必須か）

---

## 柱間の設計整合（spike 実施時の soft 依存）

- **⑥ と ⑩**: 「状態遷移の記録方式（イベントログ vs 専用カラム）」を一本化する
  （先行した方の決定に他方が従う）
- **⑦ → ⑩**: 評価集計（`Store.averageRating` 更新経路）の修正が ⑩ のシグナル1系統を供給する
- **⑨ → ④⑥**: イベント→通知マッピング形式を ④⑥ の通知定義が消費する（⑨を先に確定させると単純化）
- **④ と ⑩**: 入口の品質（審査）と継続の品質（措置）の対。BANNED 店舗の露出チェックを共有する

## 実装フェーズで適用される規約（[`tech.md`](../../../.claude/steering/tech.md)）

- 金額系は `Decimal(12,2)` + `Prisma.Decimal` 演算（⑧の価格履歴・固定額クーポンで必須）
- 状態遷移 + **DB 副作用**（複数テーブル更新・在庫減算・集計更新）は `db.$transaction`（④⑥⑦⑩で必須）
  - **外部副作用（email 送信・Stripe/PayPal 呼び出し等）は `$transaction` の内側に置かない**。
    外部呼び出しはロールバックできず、DB コネクションをその間占有するため。柱⑨は
    **Outbox パターン**（トランザクション内では通知イベントを DB に記録するに留め、送信は
    トランザクション確定後に別処理で実行）で DB 確定と外部送信の境界を分離する（本節 柱⑨ 参照）
- auth-guards（`requireUser`/`requireAdmin`/`requireSeller`/`requireStoreOwner`）使用・
  Server Action は `src/queries/` 配置
- スキーマ変更時は ERD 再生成（`03-data-model-diagram-sync` ルール）と `safe-migration` スキル
- コミットは `02-tdd-step-commit` の粒度規律、テストは `docs/testing/TESTING_DESIGN.md` のパターン
  （スキーマ変更はシードテスト `prisma/seed/__tests__/` を伴う）
- `rating Float`／`Size.discount Float` の扱い: Float 禁止規約は金額フィールド対象だが、
  ⑦⑧では評価・割引率の型見直し（Decimal 化 or 現状維持の明示判断）を ADR 判断項目に含める
