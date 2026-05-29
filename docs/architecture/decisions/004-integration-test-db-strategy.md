# 004. Integration テストの DB 戦略: testcontainers + ローカル docker-compose

- **Status**: Accepted
- **Date**: 2026-05-29
- **Deciders**: myoshizumi（実装）, Claude Code（調査支援）

---

## Context

`docs/testing/COVERAGE_REPORT.md` §3 で定義された **B3 (Cart → Checkout Integration Test)** および後続の Integration テスト群（B4 / B5 / IDOR セキュリティテスト等）を実装するには、ユニットテストで一般化している Prisma モック方式とは異なる **実 DB を伴う検証** が必要となる。理由:

1. Cart → Checkout の状態橋渡しは **Zustand persist（client）** ⇔ **DB の `Cart` / `CartItem` / `Coupon` テーブル** ⇔ **`CheckoutContainer` の SSR props** の 3 層構造で、モックを多重に積むと検証の信頼性が「モック設計の正しさ」に依存してしまう
2. `tsvector` / `Decimal(12,2)` / cascade 削除など PostgreSQL 固有挙動は SQLite では再現できない
3. `specs/multi-vendor-ecommerce/07-testing.md` § Test Layers は Integration を "Prisma + PostgreSQL with reset and seed per suite" と定義しており、SDD の SSOT に一致させる必要がある

### 既存インフラと制約

| 観察事項 | 影響 |
|---|---|
| `docker-compose*` ファイル不在、`@testcontainers/*` 依存ゼロ | 新規インフラ整備が必要 |
| `.github/workflows/ci.yml` の `seed-idempotency` ジョブが既に `services.postgres` パターンで PostgreSQL 16 を起動して `prisma migrate deploy` まで通している | CI 側は実績ある選択肢が一つ存在 |
| `prisma/seed/__tests__/*.test.ts` は「DB-touching」テストの命名だが、実際は SEED constants の整合性検証のみで実 DB に触れない | 既存の真の "DB integration test" 慣行は ゼロ |
| ADR-003 で報告された CI flake (RTL + userEvent + waitFor + jsdom + React 19) が未解決 | Integration テストでも同じ infra layer のリスクを継承する可能性 |
| Jest worker 並列実行時、共有 DB は INSERT / TRUNCATE が衝突しやすい | テスト分離戦略の選択が必要 |

---

## Decision

**testcontainers-node (`@testcontainers/postgresql`) を Jest の `globalSetup` で起動し、Integration テストスイート全体が独立した PostgreSQL コンテナに対して実行されるよう構成する。**

- ローカル開発: testcontainers が Docker daemon を直接利用してテスト専用コンテナを起動
- CI: GitHub Actions Runner の Docker daemon を testcontainers が利用（`services` ブロック不要）
- ローカルで testcontainers が動かない環境（Docker Desktop 未導入の調査時など）への fallback として `docker-compose.test.yml` を併設し、`.env.test` で接続先を上書き可能とする
- 並列性: 初期実装では `maxWorkers: 1` で開始し、per-worker container 戦略は Future Work で評価

### スキーマ反映方法

`prisma migrate deploy` を `globalSetup` 内で実行。テストごとの再マイグレーションは行わず、各 `describe` の `beforeEach` で関連テーブルを `TRUNCATE ... RESTART IDENTITY CASCADE` する。

### 外部 DB モードの安全ガード

`DATABASE_URL` が非スタブ値の場合 (docker-compose fallback) は、`migrate deploy` と `TRUNCATE` が実 DB に向くため、`globalSetup` で **2 段ガード**を必須とする:

1. **明示オプトイン**: `INTEGRATION_DB_ALLOW_EXTERNAL=1` が無ければ throw（testcontainers モードを使うよう促す）
2. **DB 名ガード**: 接続先 DB 名が `test` / `integration` を含まなければ throw（dev/prod の誤接続防止）

加えて `DIRECT_URL` が未設定なら `DATABASE_URL` を流用する（schema の `directUrl = env("DIRECT_URL")` を解決するため）。testcontainers モード（`DATABASE_URL` 空）はこのガードの対象外で、従来どおり自動起動する。

### Jest 環境

`testEnvironment: "jsdom"` をデフォルトとし、Cart / Checkout コンポーネントの hydration を実環境で検証可能にする。**ただし ADR-003 で報告されている CI flake (RTL + userEvent + waitFor) のリスクを継承する** 点を明示的に受け入れ、ADR-003 末尾の playbook（仮説 A〜I）に沿って Integration スイートでも継続観察する。

---

## Alternatives Considered

### Option A: testcontainers-node + Docker（採用）

**説明**: `@testcontainers/postgresql` の `PostgreSqlContainer` を `globalSetup` で起動し、`process.env.DATABASE_URL` に接続文字列を注入。`globalTeardown` でコンテナ停止。

**メリット**:
- スイート間 / 開発者間で完全に独立した DB 状態
- Postgres バージョン・拡張（`tsvector` 等）をコードで固定可能
- per-worker container 戦略への拡張余地（並列高速化）
- ローカル / CI で同一の起動経路（Docker daemon があれば動く）
- 後続の B4 / B5 / IDOR テスト等で再利用可能な汎用基盤

**デメリット**:
- Docker daemon 依存（ローカル開発者が Docker Desktop を要件として持つ必要あり）
- 初回コンテナ起動 5〜10 秒のオーバーヘッド（ただし `globalSetup` で 1 回のみ）
- `@testcontainers/postgresql` 依存追加（devDependency）

**選択理由**: 後続テストでの再利用性 + per-suite 分離が将来の並列化を可能にする点で、初期コストを正当化できる。

### Option B: 共有 docker-compose Postgres + TRUNCATE 戦略

**説明**: `docker-compose.test.yml` で常駐の Postgres コンテナを開発者が起動、Jest はそこに接続して各 test で TRUNCATE。

**メリット**:
- 起動が透明（Jest を毎回 spinup する必要がない）
- testcontainers 依存不要

**デメリット**:
- Jest worker 並列時に **共有 DB へ同時 INSERT** が起き、TRUNCATE タイミングと干渉して flaky
- 開発者が `docker compose up` を忘れるとテストが原因不明で fail
- CI でも別途 `services.postgres` 経由になり、ローカル / CI で起動経路が分岐する
- testcontainers と比較した将来の per-worker 拡張余地が小さい

**なぜ選ばなかったか**: 並列実行時の競合がフレーク原因になりやすい（ADR-003 で既に存在する flake の上に積み増しになる）。fallback 用途として併設するに留める。

### Option C: GitHub Actions `services.postgres` のみ（CI 専用）+ ローカルは Prisma モック

**説明**: 既存の `seed-idempotency` ジョブのパターンを Integration test job にも適用。ローカルでは既存どおり Prisma を `jest.mock` で差し替え。

**メリット**:
- 既存 CI パターンと完全に同じ（学習コスト最小）
- `services.postgres` は GitHub Actions の機能でデーモン管理不要
- ローカルに Docker 不要

**デメリット**:
- **ローカルとCI で挙動が乖離する**（ローカルは mock、CI は real）→ "works on my machine" 問題が CI のみで顕在化
- B3 の核心目的（hydration → DB sync → checkout 表示の状態橋渡し検証）はモック層では検証不能。ローカル開発で B3 が形骸化する
- Real DB テストの「素早い反復」体験がローカルで失われる

**なぜ選ばなかったか**: B3 の目的そのものを毀損する。ただし ADR-003 系 flake が testcontainers 経路でも顕在化した場合の **緊急フォールバック** として記録に残す（Future Work 参照）。

### Option D: Neon の専用ブランチ DB（クラウド）

**説明**: 既存の Neon (Prisma Accelerate) インスタンスに `integration-test` ブランチを作り、テスト用接続文字列を `.env.test` / GitHub Secrets で管理。

**メリット**:
- Prisma Accelerate を含む production と同等の経路でテスト可能
- ローカルに Docker 不要

**デメリット**:
- ネットワーク往復が入り 1 テスト 100ms 以下の Integration tier 目標から逸脱
- credentials を GitHub Secrets / 開発者ローカルに配布する運用コスト
- 並列テスト時にブランチ単位の rate limit / 接続上限に当たる
- Accelerate の caching が test 結果を非決定的にする可能性

**なぜ選ばなかったか**: コスト感とテスト速度の両面で B3 の要件に合わない。

### Option E: SQLite + Prisma

**説明**: `DATABASE_URL=file:./test.db` で SQLite を使う。

**メリット**:
- 依存ゼロ・最速

**デメリット**:
- `tsvector` / `tsquery`（全文検索）未対応
- `Decimal(12,2)` の挙動が PostgreSQL と乖離（`Float` 系にフォールバック）
- 既存 schema の `@db.Decimal(12,2)` 指定で Prisma generate が失敗する可能性
- production との挙動乖離が大きく、Integration tier の価値（fidelity）を毀損

**なぜ選ばなかったか**: schema との互換性なし、即却下。

---

## Consequences

### Positive

- **B3 以降の Integration テスト全体で再利用可能な基盤**: 後続 B4 / B5 / セキュリティ系 IDOR テストが同じ infra に乗る
- **ローカル / CI の挙動一致**: testcontainers が両環境で Docker daemon を経由するため、`process.env.DATABASE_URL` だけ違う完全同型のセットアップ
- **モックの累積を防ぐ**: Cart→Checkout のような複層状態橋渡しを実 DB で検証することで、モック設計の正しさに信頼性が依存しない
- **Prisma schema の真正性検証**: マイグレーションが每回 deploy されるため、`prisma/migrations/` の drift も自然に発見される

### Negative

- **Docker Desktop が開発者要件に追加される**: README / 環境構築ドキュメントへの追記が必要
- **CI 実行時間の増加**: 1 ジョブあたり container 起動 5〜10 秒 + migrate 5〜10 秒
- **`@testcontainers/postgresql` という新規 devDependency**: メンテナンス対象に追加
- **`src/lib/db.ts` シングルトンの例外パスが増える**: テストでは独立 `PrismaClient` を直接 instantiate（`.claude/steering/structure.md` の "テストスクリプトは例外" 規定に依拠）

### Risks

- **ADR-003 系 CI flake の継承**: jsdom + RTL + userEvent + waitFor の組合せ起因のフレークが Integration スイートでも発生する可能性。発生時は ADR-003 の "次回着手手順" 仮説 E (node 直接呼出) / 仮説 G (`--maxWorkers=1`) を Integration 専用 config にも適用する
- **Docker daemon 不在環境（一部 CI runner や開発者環境）でのテスト不能**: `docker-compose.test.yml` を fallback として併設し、`.env.test` に `DATABASE_URL` を手動指定すれば testcontainers をバイパスできるよう設計（→ `tests/integration/setup/container.ts` でフォールバック判定）
- **per-worker container 化の未着手**: `maxWorkers: 1` で開始するため、テストファイル数が増えると線形に遅くなる。Future Work で per-worker 化を評価

---

## Implementation

- [x] `docs/architecture/decisions/004-integration-test-db-strategy.md`（本 ADR）
- [x] `docker-compose.test.yml`: ローカル fallback 用 Postgres 16
- [x] `.env.test.example` + `.gitignore` 更新
- [ ] `package.json`: `@testcontainers/postgresql` devDependency + `test:integration` script
- [ ] `tests/integration/setup/container.ts`: `globalSetup`（既存 `DATABASE_URL` があれば testcontainers をスキップ）
- [ ] `tests/integration/setup/teardown.ts`: `globalTeardown`
- [ ] `tests/integration/setup/db.ts`: テスト用 `PrismaClient`
- [ ] `tests/integration/setup/reset-db.ts`: TRUNCATE CASCADE ヘルパー
- [ ] `tests/integration/setup/seed.ts`: DB INSERT 版 fixtures
- [ ] `jest.integration.config.js` + `jest.config.js` の `testPathIgnorePatterns` 更新
- [ ] `.github/workflows/ci.yml`: `integration-tests` ジョブ追加
- [ ] `.claude/steering/tech.md`: testcontainers 利用方針セクション追加

**関連コミット**: （Phase 0 PR 完了時に追記）

---

## Related

- 関連 ADR: [ADR-003: ModalProvider.setOpen 同期化](003-modal-setopen-sync-for-react19.md) — CI flake (jsdom + RTL) の継続観察対象
- 関連仕様書: [`specs/multi-vendor-ecommerce/07-testing.md`](../../../specs/multi-vendor-ecommerce/07-testing.md) § Test Layers
- 関連 Plan: B3 Cart → Checkout Integration Test Plan
- 関連 Steering: [`.claude/steering/tech.md`](../../../.claude/steering/tech.md) （testcontainers 実装パターン追加予定）
- 関連 Rule: [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md) — Integration テストファイルも Tier 1 / 単一新規ファイル = 1 commit

---

## Notes

### Future Work

1. **per-worker container 戦略**: `globalSetup` ではなく `testEnvironment` を自作して worker 毎に container を起動する設計に進化させる。並列化により Integration スイート全体の実行時間が線形に短縮可能
2. **`.env.test` 経由のローカル接続上書き運用が定着したら ADR を改訂**: Option B (docker-compose のみ) パスが事実上のメイン経路になる可能性。利用統計を取ってから判断
3. **ADR-003 系 flake が Integration スイートでも顕在化した場合**: `jest.integration.config.js` で `node node_modules/jest/bin/jest.js` 直接呼出 + `--maxWorkers=1` を試行（ADR-003 仮説 E + G）

### 緊急時のフォールバック

testcontainers がブロッカーになった場合の即時退避先:

1. `docker-compose.test.yml` 起動 + `.env.test` で `DATABASE_URL` を直接指定 → testcontainers バイパス
2. それでも不安定なら Option C (GitHub Actions `services.postgres` 経由) に一時退避し、ローカルは Prisma mock に戻す
