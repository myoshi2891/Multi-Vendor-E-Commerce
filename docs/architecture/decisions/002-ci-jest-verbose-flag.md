# 002. CI で `bunx jest --verbose --ci` を採用（`bun run test` から置き換え）

- **Status**: Accepted
- **Date**: 2026-05-24
- **Deciders**: myoshizumi（実装）, Claude Code（調査支援）

---

## Context

`src/providers/modal-provider.test.tsx` の `ModalProvider › setOpen › [P1] モーダルを開くと isOpen=true...` テストが CI で **断続的に失敗** していた。

### 観察された事実

| 項目 | 観察結果 |
|------|---------|
| ローカル再現 | `bunx jest` を 20 連続実行 → 全パス。M1 Mac で再現不可 |
| CI 失敗パターン | **同一 commit SHA で `push` event は成功・`pull_request` event は失敗** が複数 SHA で再現 (`5223dfd` / `81a8d97` / `eb15fcf`) |
| エラー本文 | Jest「Summary of all failing tests」に **同一テスト名が 3 回列挙**、`Tests: 1 failed`、本文は完全に空白 |
| 既存仕様 | `package.json` の `test` script = `jest`、CI workflow から `bun run test` で呼び出し |

### 失敗した最初のアプローチ

コミット `eb15fcf test(providers/modal): refactor open state test using findByTestId for better reliability` でテスト code を `waitFor` 内多重 assertion → `findByTestId` パターンに書き換え。**CI 失敗は継続**。

→ 真因はテスト code ではないと判明。

### 制約

- ローカルで再現できないため、CI 自体を診断環境として使う必要がある
- フレークの真因仮説が複数あり（MSW unhandled request / React 19 microtask race / bun runtime と node runtime の差異）絞り込み不能
- `.claude/rules/02-tdd-step-commit.md` の精神（Red を隠さない）から `jest.retryTimes` は禁忌

---

## Decision

CI workflow [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) の `test` job を以下に変更:

```yaml
      - name: Run Jest
        # Temporary --verbose for modal-provider flake diagnostics; --ci suppresses snapshot writes.
        run: bunx jest --verbose --ci
```

- **`bun run test` → `bunx jest` 直接呼び出し**: スクリプト二重ラップを回避し、引数伝搬を確実化。同時に bun runtime ではなく node runtime で jest を実行するルートに切り替わる
- **`--verbose`**: 各 test の pass/fail と matcher 失敗 message を行ごとに出力（診断目的）
- **`--ci`**: snapshot 自動更新を抑制、CI reporter default を選択
- **`--runInBand` は入れない**: 並列実行を維持し、race が真因なら隠さない
- **`--detectOpenHandles` は入れない**: CI 時間が 2〜5x に膨張するため、必要なら段階的に追加

コミット: `5cbf82a ci: add --verbose and --ci flags to jest for diagnostics`

### 観察された副次的効果

この変更を push した直後（commit `5cbf82a`）から、**push event と pull_request event の両方が同一 SHA で成功するようになった**。診断目的の変更が結果的にフレークの解消にも寄与した。

確認済み CI 結果:

| Run ID | event | conclusion |
|--------|-------|-----------|
| 5cbf82a push | push | ✅ success |
| 5cbf82a PR | pull_request | ✅ success（フレーク消失） |
| eb15fcf push | push | ✅ success |
| eb15fcf PR | pull_request | ❌ failure（修正前） |

---

## Alternatives Considered

### Option 1: `jest.retryTimes(2)` でテスト側にリトライを仕込む

**説明**: 該当テストファイル冒頭に `jest.retryTimes(2)` を追加してフレークを吸収。

**メリット**:
- 1 行で済む

**デメリット**:
- リポジトリ既存使用例ゼロ → 規約ドリフト
- `.claude/rules/02-tdd-step-commit.md` の「Red を隠さない」精神に反する
- 真因が埋もれ、将来的にデバッグ困難
- 他のテストに同様の問題が出た場合に都度個別対応が必要

**なぜ選ばなかったか**: 症状を隠すだけで再発リスクが残る。

### Option 2: テストを `it.skip` で quarantine

**説明**: 該当テストを `it.skip(...)` でスキップし、GitHub Issue を立てて後追い。

**メリット**:
- CI を即座にグリーンに戻せる

**デメリット**:
- カバレッジ低下
- スキップが恒久化する典型パターン
- 真因不明のまま

**なぜ選ばなかったか**: スキップは最終手段。診断する余地が残っていた。

### Option 3: テスト code をさらに書き換える（act() 明示ラップ等）

**説明**: `userEvent.click` を `fireEvent.click` + 明示的 `act()` 待機に変更。

**メリット**:
- React 19 の同期保証を強化できる

**デメリット**:
- 既に `findByTestId` リファクタ（commit `eb15fcf`）で改善せず、code 修正の延長線では真因に届かない可能性が高い
- testing-library の推奨パターン（`userEvent`）から外れる

**なぜ選ばなかったか**: 投機的修正のリスクが高く、診断 instrumentation を優先するべきと判断。

### Option 4: `--detectOpenHandles` を Phase 1 から有効化

**説明**: open handle leak を一気に surface。

**メリット**:
- async leak の特定に直接効く

**デメリット**:
- Jest 30 では強制的に `--runInBand` 相当になり並列実行が殺される
- CI 時間が 2〜5x に膨張
- leak が真因でない場合、無駄なコスト

**なぜ選ばなかったか**: 先に `--verbose` で error message を見てから判断するのが順序として正しい。

---

## Consequences

### Positive

- **CI が安定**: push / pull_request 両 event でグリーン
- **将来のフレーク調査の足場**: `--verbose` 出力が常時あれば、次にフレークが出た時に Step 1（事実確定）の労力が大幅減
- **`bun run test` 二重ラップ排除**: `bun run` → `jest` の経路で引数が落ちる事故を予防
- **診断パターンの形式知化**: 本 ADR と [`.claude/skills/ci-flake-diagnosis/SKILL.md`](../../../.claude/skills/ci-flake-diagnosis/SKILL.md) で再現可能なプレイブックを残した

### Negative

- **CI ログ出力量増**: 各 test 1 行ずつ出るため、ログサイズが従来比でやや増える（GitHub Actions の制限内）
- **`bunx jest` への切り替えで runtime が変わる可能性**: `bun run test` は bun runtime / `bunx jest` は jest shebang の `#!/usr/bin/env node` 経由で node runtime になる可能性がある。bun runtime と node runtime の microtask/scheduling 差異がフレークの真因だった可能性は否定できないが、確証なし

### Risks

- **真因が完全に特定できていない**: `5cbf82a` で結果的に解消したが、`--verbose --ci` のどの要素が効いたか（あるいは bun→node runtime 切替が効いたか）は未確定。**再発する可能性**は残る
- **`--verbose` を撤回するタイミングが曖昧**: 当面は残し、5 連続グリーンを 2 週間程度維持できたら段階的に `--verbose` のみ撤回・`--ci` と `bunx jest` は恒久化することを検討

---

## Implementation

- [x] [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) の test job を `bunx jest --verbose --ci` に変更
- [x] CI で push event / pull_request event が両方グリーンになることを確認
- [x] [`.claude/skills/ci-flake-diagnosis/SKILL.md`](../../../.claude/skills/ci-flake-diagnosis/SKILL.md) で診断プレイブックを形式知化
- [x] 本 ADR で決定理由を記録
- [ ] **将来課題**: 2 週間グリーン継続を確認したら `--verbose` の撤回判断（`--ci` と `bunx jest` は維持）

**関連コミット**:
- `eb15fcf` — 失敗した最初のアプローチ（テスト code の `findByTestId` リファクタ）
- `5cbf82a` — 本決定の実装（`bunx jest --verbose --ci`）

---

## Related

- 関連 Skill: [`.claude/skills/ci-flake-diagnosis/SKILL.md`](../../../.claude/skills/ci-flake-diagnosis/SKILL.md)
- 関連 Rule: [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md)
- 関連ファイル:
  - [.github/workflows/ci.yml](../../../.github/workflows/ci.yml)
  - [src/providers/modal-provider.tsx](../../../src/providers/modal-provider.tsx)
  - [src/providers/modal-provider.test.tsx](../../../src/providers/modal-provider.test.tsx)
  - [tests-setup/jest.setup.ts](../../../tests-setup/jest.setup.ts)
  - [tests/mocks/server.ts](../../../tests/mocks/server.ts)

---

## Notes

### 真因の最有力仮説（未確定）

調査時点で残った仮説:

1. **`bun run test` vs `bunx jest` の runtime 差**: `bun run` 経由は bun runtime、`bunx jest` は node runtime になる場合があり、React 19 の Promise/microtask scheduling が異なる可能性
2. **MSW `onUnhandledRequest: "error"`**: [tests/mocks/server.ts](../../../tests/mocks/server.ts) はハンドラ 0 個 → 内部 fetch が稀に発生すると即 error 化、それが unhandled rejection として集約される（「同名 3 回 + 本文空」の典型）
3. **GitHub Actions runner の個体差**: 2-core Ubuntu の負荷変動で React 19 concurrent commit のタイミングが揺れる

これらは結果から逆引きしての推定であり、再発時に再度切り分けが必要。

### 関連する debugging skill

将来同様のフレークが出たら [`.claude/skills/ci-flake-diagnosis/SKILL.md`](../../../.claude/skills/ci-flake-diagnosis/SKILL.md) の Step 1〜2 から開始すること。投機的に test code を書き換えない。
