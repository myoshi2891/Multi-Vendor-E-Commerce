# Findings 06 — Dependencies & Migrations（raw・未 vet）

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
- > **TODO(needs-detail)**: **バンプ先の具体的なピンが未確定**。本 finding の `7.5.x` は
  > 監査時点（2026-07-03 / HEAD `f9752c0`）の記述であり、**現時点で何が解決されるかは
  > 実行して確かめる必要がある**（`^7.5.x` は範囲指定なので、いつ実行するかで
  > 解決版が変わる）。確認手順:
  > ```bash
  > bun install                                        # package.json を ^7.5.x にした後
  > grep -n "@clerk/nextjs" bun.lock                   # lock 上の解決版を確認
  > cat node_modules/@clerk/nextjs/package.json | grep '"version"'
  > ```
  > **確定すべきこと**: (a) 解決されたパッチ版が GHSA-vqx2-fgx2-5wq9 の修正版
  > （7.2.4+）**および** HIGH GHSA-w24r-5266-9c3c の修正版の**両方**を満たすか、
  > (b) その版を `package.json` にどう記録するか（範囲のままか、
  > 再現性のため厳密ピンにするか）。判定はユーザー確認の上で行い、
  > **実測した解決版を本ファイルと plan 004 の両方に記録**すること
  > （「^7.5.x にした」だけでは、後から何が入ったのか追えない）。

### [DEPS-02] `js-cookie` HIGH が Clerk バンプで transitCVE 解消することの確認ゲート

- **Evidence**: `bun.lock` の経路 `@clerk/nextjs@7.0.7 › @clerk/shared@4.3.2 › js-cookie@3.0.5`（`node_modules/js-cookie/package.json` = 3.0.5）。`js-cookie` はツリー上 `@clerk/shared` 経由のみで、`package.json` に直接依存なし。
- **Impact**: 脆弱な `js-cookie@3.0.5` が Clerk shared 経由でクライアントバンドルに同梱。`@clerk/shared@4.3.2` にピン留めされているため単独更新は不可 — Clerk が新しい `@clerk/shared` を引くときのみ動く。独立アクションではなく **DEPS-01 の検証ゲート**。
- **Effort**: S（DEPS-01 に内包） / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch（再現可能な検証ゲートとして手順化）**: 「grep して確認」では合否基準が
  実行者依存になるため、**そのまま実行できるコマンドと判定条件**を定義する。
  Clerk バンプ（DEPS-01）後に以下を順に実行する:

```bash
# 1. 依存経路の実体を確認する（なぜ js-cookie が入っているか・誰がピンしているか）
bun why js-cookie
#    期待: @clerk/shared 経由のみ。他の親が現れたら DEPS-02 の前提（Clerk 経由のみ）が崩れる

# 2. lock 上の解決版を確認する（node_modules ではなく lock を正とする）
grep -n "js-cookie" bun.lock

# 3. 実インストール版
cat node_modules/js-cookie/package.json | grep '"version"'
```

  **判定**:
  - **解決版がパッチ済み（>3.0.5 の修正版）** → ゲート通過。DEPS-02 をクローズし、
    その旨と実測版を記録する。
  - **7.5.x でも `js-cookie@3.0.5` のまま** → `@clerk/shared` が旧版をピンし続けている。
    `package.json` に一時的な `overrides` を追加して強制解決する:

```jsonc
// package.json（一時措置。Clerk 側が追従したら削除する）
"overrides": { "js-cookie": "<パッチ済み版>" }
```

    追加後は **`bun install` → 上記 1〜3 を再実行**して解決版が変わったことを確認し、
    さらに **Clerk のサインイン/サインアウト導線をスモーク**すること
    （`js-cookie` は Clerk のセッション cookie 操作に使われるため、強制上書きは
    認証の回帰リスクを持つ。`tests/e2e/a11y/sign-in.spec.ts` + plan 053 の
    auth-surface spec が最小の受け皿になる）。
  - `overrides` を入れた場合は**恒久措置ではない**ことを `package.json` のコメントと
    本ファイルに明記し、Clerk 側が追従した時点で削除する（削除忘れは将来の
    Clerk アップグレードを黙って阻害する）。

### [DEPS-03] `jodit` prototype pollution は本番到達性が低い — 出力はサニタイズ済み

- **Evidence**: `package.json:77` `"jodit-react": "^4.1.2"` → `jodit@4.6.2`。エディタ使用は seller 商品フォーム `src/components/dashboard/forms/product-details.tsx:59,595,626`（商品/バリアント説明）のみ。保存 HTML のストアフロント再表示は `src/components/store/product-page/product-description.tsx:11-12,22-23` で、`src/utils/sanitize.ts:8` の `sanitize()`（DOMPurify）を通過後に `dangerouslySetInnerHTML`。
- **Impact**: moderate の prototype pollution は**認証済み seller 自身のブラウザ内**のエディタで実行され、第三者の未信頼入力はエディタに到達しない。ストアフロント側の XSS シンクは DOMPurify で閉鎖済み。本番露出は低 — 緊急対応ではなくメンテナンス扱い。
- **Effort**: S / **Risk**: LOW-MED（Jodit 4.x マイナーはエディタ挙動が変わり得る。`product-details.tsx:132` の config memo は最小構成で回帰リスク小、要手動スモーク） / **Confidence**: HIGH
- **脆弱性の同定（プラン化前に必ず埋めること）**:
  | 項目 | 値 |
  |---|---|
  | アドバイザリ ID（GHSA / CVE） | **未記載** — 本 raw findings では特定できていない |
  | 影響版レンジ | **未記載**（現行は `jodit@4.6.2`） |
  | 修正版 | **未記載**（存在するか自体が未確認） |
  | 種別 | prototype pollution（moderate） |
  > **ID・影響レンジ・修正版が無い finding は検証も追跡もできない**（「パッチ版があれば
  > バンプ」が実行不能になる）。`bun audit` の出力から **GHSA ID を転記**し、
  > アドバイザリを開いて影響レンジと修正版を確認して上表を埋めること。
  > **修正版が未リリースの場合は、その旨（「未リリース」）を明示的に記録する** —
  > 空欄のままだと「調べていない」のか「無い」のかが後任に伝わらず、毎ラウンド
  > 再調査される（本ファイルが「再監査防止」を目的にしていることに反する）。
- **影響範囲（確認済み）**: 未信頼入力はエディタに到達せず（seller 自身のブラウザ内でのみ実行）、
  ストアフロント側の XSS シンクは DOMPurify（`src/utils/sanitize.ts:8`）で閉鎖済み。
  **本番到達性が低いことは上記 Evidence で裏付け済み**であり、ID が埋まっても
  この評価（緊急対応不要・メンテナンス扱い）は変わらない見込み。
- **Fix sketch**: 上表を埋めた上で、**修正版が存在すれば**バンプ（Jodit 4.x マイナーは
  エディタ挙動が変わりうるため、`product-details.tsx` の商品説明エディタを手動スモーク）。
  **修正版が未リリースなら**、サニタイズ境界 + seller 限定入力面を根拠に
  **accepted risk として記録**し、アドバイザリ ID と再評価条件（修正版のリリース）を
  併記する。

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

### [DEPS-08] Next.js 16.2.1 — 監査時点では最新・パッチアクション不要

- **Evidence（実測できる範囲）**: `package.json:80` `"next": "^16.2.1"`、`bun.lock` +
  `node_modules/next/package.json` とも **16.2.1**（インストール実体）。
  peer（React 19、`@playwright/test` ^1.51）充足。`middleware→proxy` / AVIF 警告の
  非対応は決定済みトレードオフ（recon）。
- > **TODO(needs-detail)**: **「16.2.1 が最新」という判定は監査時点
  > （2026-07-03 / HEAD `f9752c0`）のものであり、リポジトリ内からは検証できない**
  > （最新版の情報は外部レジストリにしか無い）。本 finding が実測で言えるのは
  > **「インストール実体が 16.2.1 である」ことまで**で、それが最新かどうかは別の主張。
  > 確認事項: **現時点の Next.js の最新安定版**（`bun outdated next` /
  > `npm view next version` / リリースノート）。
  > - **16.2.1 が最新のまま** → 本 finding は「アクション不要」で確定。判定日を追記する。
  > - **より新しい版が出ている** → 「最新」の記述を撤回し、差分がセキュリティ修正を
  >   含むかを確認する。含む場合は独立した finding として起票する
  >   （**Clerk/Prisma の作業に Next バンプを同梱しない**という本 finding の
  >   本来の目的は維持すること）。
  >
  > **「最新である」は時間で腐る主張**なので、再監査のたびに判定日とセットで
  > 更新すること（判定日の無い「最新」は次のラウンドで誤情報になる）。
- **Impact**: 監査時点で未解決事項なし。Clerk/Prisma 作業に不要な Next バンプを
  同梱しないための完備記録。
- **Effort**: S（監視のみ） / **Risk**: LOW /
  **Confidence**: HIGH（インストール実体 16.2.1）/ **未確認**（それが最新であること）
- **Fix sketch**: 変更なし。16.2.x パッチリリースの追跡を継続し、
  **判定日を添えて**「最新」の記述を更新する。

---

**Leverage 順（サブエージェント自己申告）**: DEPS-01（HIGH confidence セキュリティ・S effort・DEPS-02 をアンブロック）→ DEPS-02（01 の検証ゲート）→ DEPS-04（M effort のメジャー負債）→ DEPS-03（緩和済み moderate）→ DEPS-06/07（衛生/ウォッチリスト）→ DEPS-05/08（明示的に低/非アクション。再監査防止のため記録）。
