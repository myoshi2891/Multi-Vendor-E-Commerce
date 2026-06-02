# 005. 静的解析プラットフォームに SonarCloud (CI) + SonarQube Community (ローカル) を採用

- **Status**: Accepted
- **Date**: 2026-06-02
- **Deciders**: project team

---

## Context

コード品質（バグ・コードスメル・セキュリティホットスポット・カバレッジ）を継続的に
可視化・改善する仕組みが無かった。本リポジトリは既に Jest が lcov を出力できる設定
（[`jest.config.js`](../../../jest.config.js) の `coverageReporters: ["lcov", ...]`）を
持つが、その lcov を消費して品質トレンドを追う基盤が存在しなかった。

制約:
- third-party GitHub Actions / コンテナイメージは SHA / digest 固定が必須
  （[`.claude/rules/01-engineering-standards.md`](../../../.claude/rules/01-engineering-standards.md)）。
- 既存コードに対しては指摘が大量に出るため、導入初期から CI をブロックすると開発が停滞する。
- 開発者がローカルでも CI と同等の解析を再現できることが望ましい。

---

## Decision

静的解析に **SonarQube** を採用し、実行環境を 2 系統に分ける:

1. **CI（PR ごとの解析）= SonarCloud (SaaS)**
   - `.github/workflows/ci.yml` の `test` ジョブで `--coverage` を付与して `coverage/lcov.info` を生成し artifact 化。
   - 非ブロッキングの `sonarcloud` ジョブ（`continue-on-error: true`）が artifact を復元し `SonarSource/sonarqube-scan-action` で送信。
   - `SONAR_TOKEN` (GitHub Secrets) 未登録時は scan ステップを skip し、CI 全体は緑のまま。
2. **ローカル（開発者の事前確認）= SonarQube Community (Docker)**
   - [`docker-compose.sonar.yml`](../../../docker-compose.sonar.yml) で SonarQube + 専用 PostgreSQL + scanner-cli を起動。
   - `make sonar-up` / `make sonar-scan` / `make sonar-down` で操作。

Quality Gate は **初期は非ブロッキング（レポートのみ）**。可視化を優先し、New Code 基準を
整えた段階でブロッキングへ切り替える。

---

## Alternatives Considered

### Option 1: SonarCloud (SaaS) を CI、SonarQube Community を ローカル（採用）

**説明**: CI はマネージド SaaS、ローカルは自己ホスト Docker のハイブリッド。

**メリット**:
- CI 側はサーバー運用不要。PR デコレーション・解析トレンド・New Code 履歴が SaaS 側に永続化。
- 公開リポジトリは無料。`SONAR_TOKEN` のみで完結。
- ローカルは Docker で CI と同等の解析を再現でき、PR 前に手元で確認できる。

**デメリット**:
- SonarCloud アカウント / Organization / Project の事前セットアップと Secret 登録が必要。
- CI 結果（SaaS）とローカル（self-hosted）でルールセットの版が完全一致しない可能性がある。

### Option 2: self-hosted SonarQube を常設し CI から送信

**説明**: SonarQube サーバーを常設（VPS 等）し、CI は `SONAR_HOST_URL` + `SONAR_TOKEN` で送信。

**メリット**: トレンド・Quality Gate 履歴を自前で完全管理。SaaS 依存なし。

**デメリット**: サーバーの常設・運用・アップグレード・可用性確保のコスト。学習目的の本リポジトリには過剰。
**→ 却下**: 運用コストが便益に見合わない。

### Option 3: CI 内で SonarQube を service container として一時起動

**説明**: GitHub Actions の service container で毎回 SonarQube を起動 → 解析 → 破棄。

**メリット**: 外部インフラ・Secret 不要で Docker 完結。

**デメリット**: 起動に 1〜2 分かかり CI を圧迫。解析履歴・トレンドが残らず（毎回まっさら）、品質改善の追跡という本来の目的を果たせない。
**→ 却下**: 履歴が残らないため可視化基盤として機能しない。

---

## Consequences

### Positive
- 既存の lcov 出力を再利用するだけで、新しい計測基盤を足さずに品質を可視化できる。
- 非ブロッキング導入のため、既存コードの大量指摘が CI を止めない。
- ローカル Docker により CI と同等の解析を手元で再現できる。

### Negative（トレードオフ）
- `test` ジョブに `--coverage` が加わり実行時間が増加する。
- SonarCloud の事前セットアップ（アカウント・Org・Project・Secret）が前提として必要。
- CI（SaaS）とローカル（self-hosted）でルール版が乖離し得る。

### Risks
- `SONAR_TOKEN` 失効時は scan が skip される（CI は緑のまま）→ 解析が止まったことに気づきにくい。
  対策: SonarCloud 側で解析停止のアラートを設定する（将来課題）。

---

## Implementation

- [x] `sonar-project.properties`（root）。`sonar.coverage.exclusions` を `jest.config.js` の除外と一致させる。
- [x] `ci.yml`: `test` ジョブに `--coverage` + artifact 化、非ブロッキング `sonarcloud` ジョブ追加。
- [x] `docker-compose.sonar.yml` + Makefile（`sonar-up` / `sonar-down` / `sonar-scan`） + `.env.docker.example`。
- [x] ドキュメント同期（本 ADR / `docker-dev.md` / `steering/tech.md` / `PROGRESS.md`）。
- [ ] （将来）New Code 基準を整えてから Quality Gate をブロッキングへ切替。

**前提（リポジトリ外の手動作業）**: SonarCloud アカウント / Organization / Project 作成、
`sonar-project.properties` の `sonar.organization` / `sonar.projectKey` 記入、GitHub Secrets への `SONAR_TOKEN` 登録。

**関連コミット**: ブランチ `chore/sonarqube-integration`

---

## Related

- 関連 ADR: [ADR-002: CI Jest --verbose フラグ](002-ci-jest-verbose-flag.md) / [ADR-004: integration テスト DB 戦略](004-integration-test-db-strategy.md)
- 関連ルール: [`.claude/rules/01-engineering-standards.md`](../../../.claude/rules/01-engineering-standards.md)（CI / Supply Chain の SHA・digest 固定）
- 関連ファイル: [`sonar-project.properties`](../../../sonar-project.properties) / [`docker-compose.sonar.yml`](../../../docker-compose.sonar.yml) / [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)
- セットアップ手順: [`docs/development/docker-dev.md`](../../development/docker-dev.md)

---

## Notes

- カバレッジは現状ユニット/コンポーネント（`jest.config.js`）のみを送信する。integration テスト
  （`jest.integration.config.js`）のカバレッジ統合は将来課題（`sonar.javascript.lcov.reportPaths`
  はカンマ区切りで複数 lcov を受け付ける）。
