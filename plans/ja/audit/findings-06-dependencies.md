# Findings 06 — Dependencies & Migrations（raw・未 vet）

> 原本: [../../audit/findings-06-dependencies.md](../../audit/findings-06-dependencies.md)

> Explore サブエージェント報告（2026-07-03 / HEAD `f9752c0`）。**Phase 3 の vet 前の生データ**。
> プレイブック（§6 / Finding format / Prioritization rubric）と recon.md の読了確認済み。`bun audit` は再実行せず、`bun.lock` と `node_modules/*/package.json` でインストール実バージョンを直接検証。
> 総評: 最重要は Clerk の CRITICAL アドバイザリ（DEPS-01）。マイグレーション履歴は健全（DEPS-06）。プロンプトインジェクション様コンテンツ・秘密値の再現なし。

### [DEPS-01] `@clerk/nextjs` を auth-bypass アドバイザリ圏外へ更新（7.0.7 → 7.5.x）

- **Evidence**:
  - `package.json:21` — `"@clerk/nextjs": "^7.0.7"`。`bun.lock` と `node_modules/@clerk/nextjs/package.json` でインストール実体 7.0.7 を確認。CRITICAL [GHSA-vqx2-fgx2-5wq9]（影響 >=7.0.0 <=7.2.3、修正 7.2.4+）+ HIGH GHSA-w24r-5266-9c3c の影響圏内。
  - `src/middleware.ts:6-13` — アドバイザリが標的とするまさにこのパターン: `createRouteMatcher([...])` + `await auth.protect()` で `/dashboard`, `/dashboard/(.*)`, `/checkout`, `/profile`, `/profile/(.*)` を保護。
  - 影響範囲（アップグレード面）は小さい: Clerk import はテスト以外で約10箇所 — `src/middleware.ts:1`、`src/app/layout.tsx:12`（ClerkProvider）、`(auth)/sign-in|sign-up`・`(store)/profile/settings/page.tsx`（UI コンポーネント）、`src/app/api/webhooks/route.ts:4`（clerkClient + WebhookEvent）、`src/queries/store.ts:586`（動的 import）、各 dashboard layout / `src/queries/*`（order, product, review, profile, user, stripe, paypal, support）の `currentUser()`。7.0→7.5 間で削除された API は未使用。
  - peer 互換は既に充足: `@clerk/nextjs@7.0.7` の peer は `next: ^16.1.0-0`、リポジトリは `next@16.2.1`。7.5.x も同じ Next 16 / React 19 peer 窓で、Next/React の変更を強制しない。
- **Impact**: middleware 保護ルートシェル（`/dashboard`、`/checkout`、`/profile`）への未認証アクセス。実際のデータ露出は defense-in-depth で**減衰するがゼロではない**: `src/queries/` の server action は `src/lib/auth-guards.ts` で再検証し、dashboard layout はサーバー側で `currentUser()` を呼ぶ。残余リスクは「middleware が唯一のゲートであるページ/ルート」（保護ページ本文のサーバーレンダー内容が自前で再ガードしないケース）。依存カテゴリで最優先。
- **Effort**: S — バージョンバンプ + `bun install`。`src/middleware.test.ts` と Clerk モックの `src/queries/*.test.ts` を再実行。
- **Risk**: LOW-MED — v7 内のマイナーバンプ。使用 API 面は 7.0→7.5 で安定。Clerk のマイナーは `auth()`/`clerkMiddleware` 内部を変えることがあるため MED 寄り。全テスト + 未認証での保護ルート手動スモークでカバー。
- **Confidence**: HIGH — インストール版・影響範囲・使用面すべて直接検証済み。
- **Fix sketch**: `package.json` を `^7.5.x` にバンプ → 再インストールで `bun.lock` 更新 → Clerk モックのユニット + middleware テスト → 保護ルート1本を未認証スモーク。

### [DEPS-02] `js-cookie` HIGH が Clerk バンプで transitCVE 解消することの確認ゲート

- **Evidence**: `bun.lock` の経路 `@clerk/nextjs@7.0.7 › @clerk/shared@4.3.2 › js-cookie@3.0.5`（`node_modules/js-cookie/package.json` = 3.0.5）。`js-cookie` はツリー上 `@clerk/shared` 経由のみで、`package.json` に直接依存なし。
- **Impact**: 脆弱な `js-cookie@3.0.5` が Clerk shared 経由でクライアントバンドルに同梱。`@clerk/shared@4.3.2` にピン留めされているため単独更新は不可 — Clerk が新しい `@clerk/shared` を引くときのみ動く。独立アクションではなく **DEPS-01 の検証ゲート**。
- **Effort**: S（DEPS-01 に内包） / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: Clerk バンプ後に `bun.lock` を grep し `@clerk/shared` がパッチ済み `js-cookie` をピンする版へ進んだか確認。7.5.x でも `js-cookie@3.0.5` のままなら一時的な `overrides` を追加して再監査。

### [DEPS-03] `jodit` prototype pollution は本番到達性が低い — 出力はサニタイズ済み

- **Evidence**: `package.json:77` `"jodit-react": "^4.1.2"` → `jodit@4.6.2`。エディタ使用は seller 商品フォーム `src/components/dashboard/forms/product-details.tsx:59,595,626`（商品/バリアント説明）のみ。保存 HTML のストアフロント再表示は `src/components/store/product-page/product-description.tsx:11-12,22-23` で、`src/utils/sanitize.ts:8` の `sanitize()`（DOMPurify）を通過後に `dangerouslySetInnerHTML`。
- **Impact**: moderate の prototype pollution は**認証済み seller 自身のブラウザ内**のエディタで実行され、第三者の未信頼入力はエディタに到達しない。ストアフロント側の XSS シンクは DOMPurify で閉鎖済み。本番露出は低 — 緊急対応ではなくメンテナンス扱い。
- **Effort**: S / **Risk**: LOW-MED（Jodit 4.x マイナーはエディタ挙動が変わり得る。`product-details.tsx:132` の config memo は最小構成で回帰リスク小、要手動スモーク） / **Confidence**: HIGH
- **Fix sketch**: `jodit` >4.6.2 のパッチ版があればバンプ。なければサニタイズ境界 + seller 限定入力面を根拠に accepted risk として記録。

### [DEPS-04] Prisma 5.22.0 → 6.x メジャーラグ（コミット前に spike で特性把握）

- **Evidence**: `package.json:24,135` が `@prisma/client` / `prisma` を exact `5.22.0` にピン（5.x 最終版）。スキーマ面は控えめ: `prisma/schema.prisma:1-3` の previewFeatures は `["fullTextSearch"]` のみ、datasource は `url` + `directUrl`（`schema.prisma:6-10`）、金額は `@db.Decimal(12,2)` 約30箇所。`Unsupported()`・multi-schema・views なし。Accelerate は `src/lib/db.ts:2,5`（`$extends(withAccelerate())`、`@prisma/extension-accelerate@^1.2.0`）。
- **Impact**: 5.x 残留は Prisma のサポート/セキュリティ窓から外れていく。移行コストは**中程度**: Prisma 6 は Node ≥18.18 / TS ≥5.1（既に充足）、Postgres の `fullTextSearch` 取り扱い変更（本リポジトリ唯一の preview feature = 最重要検証点）、Accelerate 拡張の v6 対応版へのバンプが必要。Decimal/Text マッピングは不変。
- **Effort**: M — `prisma` + `@prisma/client` をロックステップでバンプ（等値必須）、Accelerate 拡張バンプ、全文検索クエリと `db.$transaction` 呼び出し点の再検証、client 再生成、testcontainers 統合スイート実行。
- **Risk**: MED — 全文検索 preview セマンティクスと Accelerate 拡張が破損候補筆頭。exact ピン規律が client/CLI ドリフトを抑制。
- **Confidence**: MED — スキーマ/Accelerate 面は検証済み。6.x 破壊的変更の正確な影響はブランチ spike が必要。
- **Fix sketch**: ブランチで spike: 3パッケージ同時バンプ → `prisma validate`/`generate` → tsvector クエリと統合スイート実行 → 必要な `fullTextSearch` クエリ書き換えを記録。

### [DEPS-05] dev 専用アドバイザリは本番非到達 — 低優先を維持

- **Evidence**: `handlebars` は `ts-jest`（`package.json:106`）、`ws` は `jsdom`/`jest-environment-jsdom`（`:78,130`）+ `@lhci/cli`（`:117`）、`picomatch` は jest/tailwind ツーリング経由。すべて devDependencies または dev ツール transitive。`src/` ランタイムからの import なし。
- **Impact**: `bun audit` 97 件のかさ増し要因だが、デプロイバンドル・サーバーランタイムに非到達。本番セキュリティ利益ゼロ。定期的な dev ツールリフレッシュで扱う。
- **Effort**: S / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: 優先度を下げ、セキュリティ修正バッチではなく定期 devDeps 更新に折り込む。

### [DEPS-06] マイグレーション履歴は整合 — `.DS_Store` の軽微な衛生問題のみ

- **Evidence**: `prisma/migrations/` に単調増加のタイムスタンプ付きマイグレーション15本（`20260222101357_init_postgresql` … `20260622061307_add_support_ticket`）、すべてディレクトリ形式（= `migrate dev` 由来、recon 規約 #5 の `db push` 禁止と整合）。`migration_lock.toml` は `provider = "postgresql"` で datasource と一致。欠番・重複タイムスタンプ・手編集 lock なし。`prisma/migrations/.DS_Store`（8KB）が commit されている。
- **Impact**: マイグレーション体制は健全 — `migrate deploy` を壊すドリフトなし。唯一の問題は tracked `.DS_Store`（ノイズであり正しさのリスクではない）。
- **Effort**: S / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: `**/.DS_Store` を `.gitignore` に追加し tracked コピーを untrack。マイグレーション内容の変更は不要。

### [DEPS-07] バージョンピン戦略は妥当 — 非メンテのランタイム UI 依存をウォッチリスト化

- **Evidence**: Prisma 2パッケージは exact `5.22.0`（`:24,135`、CLI と client の等値必須なので正しい）。他は caret レンジ。ただし `react-tag-input` のみ exact `6.9.0`（`:97`）で `@types/react-tag-input` は caret（`:60`）と不揃い。`bun.lock` は `node_modules` と整合（Clerk/js-cookie/jodit/Prisma/Next をスポットチェック）。低活性/レガシーなランタイム UI 依存: `react-color@^2.19.3`（`:85`、事実上非メンテ）、`react-rating-stars-component@^2.2.0`（`:93`）、`react-image-zooom@^1.3.5`（`:91`）、`next-share@^0.27.0`（`:82`）、`colorthief@^2.6.0`（`:67`）。
- **Impact**: 現時点でアドバイザリはないが、ランタイム経路上の放置リスク — 将来の React/Next メジャーで取り残される可能性（`react-color` は React 18 concurrent 以前の設計）。今は非アクション。`react-tag-input` の exact ピンは意図の文書化か caret への正規化を。
- **Effort**: S（パッケージごとの代替評価） / **Risk**: LOW / **Confidence**: MED（ピン/ロック状態は検証済み。「非メンテ」は保守シグナル判断）
- **Fix sketch**: レガシー UI 依存をウォッチリストに記録し、次の React/Next メジャー時に生存確認。`react-tag-input` の exact ピンの意図を確定。

### [DEPS-08] Next.js 16.2.1 は最新 — パッチアクション不要

- **Evidence**: `package.json:80` `"next": "^16.2.1"`、`bun.lock` + `node_modules/next/package.json` とも 16.2.1。peer（React 19、`@playwright/test` ^1.51）充足。`middleware→proxy` / AVIF 警告の非対応は決定済みトレードオフ（recon）。
- **Impact**: 未解決事項なし。Clerk/Prisma 作業に不要な Next バンプを同梱しないための完備記録。
- **Effort**: S（監視のみ） / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: 変更なし。16.2.x パッチリリースの追跡を継続。

---

**Leverage 順（サブエージェント自己申告）**: DEPS-01（HIGH confidence セキュリティ・S effort・DEPS-02 をアンブロック）→ DEPS-02（01 の検証ゲート）→ DEPS-04（M effort のメジャー負債）→ DEPS-03（緩和済み moderate）→ DEPS-06/07（衛生/ウォッチリスト）→ DEPS-05/08（明示的に低/非アクション。再監査防止のため記録）。
