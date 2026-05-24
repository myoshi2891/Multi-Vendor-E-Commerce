---
name: ci-flake-diagnosis
description: >
  Diagnoses CI-only test flakes — tests that pass locally but fail intermittently
  on GitHub Actions. Triaged via gh CLI log inspection and event-pair comparison
  (push vs pull_request on the same SHA). Recommends minimal diagnostic
  instrumentation (Jest --verbose --ci) before any code change.
  Triggered by: "CI が落ちる", "CI でだけ失敗", "テストがフレーキー",
  "ローカルでは通る", "間欠的に失敗", "CI flake", "intermittent failure",
  "flaky test", "passes locally fails in CI".
invocation: automatic
allowed-tools: [Bash, Read, Grep, Edit]
---

# CI Flake Diagnosis スキル

## 目的

ローカルでは通るが CI でのみ間欠的に失敗するテスト（CI-only flake）の **原因切り分けと最小修正** を行う。投機的な test code 書き換えに進む前に、まず CI ログから真因を絞り込む。

---

## トリガー条件

ユーザーが以下のいずれかを言及した場合:

- 「CI が落ちる」「CI でだけ失敗する」
- 「ローカルでは通るのに CI で fail する」
- 「同じテストが間欠的に失敗する」
- GitHub Actions のテスト結果ログを貼り付けてきた

ローカルで毎回失敗するテストは別のスキル（test-complete / test-gen）で対応。本スキルは **CI 環境固有の問題** に絞る。

---

## 実行手順

### Step 1｜CI 失敗の事実関係を確定する

ローカル再現を試みる前に **CI ログから事実を集める**。最小限の `gh` コマンドで以下を確定する:

```bash
# 直近 8 件の workflow run を一覧（conclusion / event / SHA を確認）
gh run list --workflow=ci.yml --limit 8 \
  --json conclusion,headSha,event,createdAt

# 失敗した run の test job ログから対象テストの周辺を抽出
gh run view <FAILED_RUN_ID> --log 2>&1 \
  | grep -B 5 -A 50 "FAIL .*\.test\." | head -200
```

確定すべき事実:

| 項目 | 確認方法 |
|------|---------|
| 同一 SHA で push event と pull_request event の結果差 | `gh run list` の event/conclusion ペア |
| 失敗ログにエラー本文が出ているか | `gh run view --log` の `●` バレット後 |
| `Tests: X failed` の数と「Summary of all failing tests」の列挙数の一致 | ログ末尾 |
| 失敗テストが直近のどのコミットで追加・変更されたか | `git log --oneline -- <test file>` |

---

### Step 2｜真因仮説を分類する

Step 1 の事実から、以下のパターンに分類する:

#### パターン A: 環境変動による flake（最頻出）

**サイン**:
- 同一 SHA で push event は成功・pull_request event は失敗（または逆）
- 別 runner（並列実行）で結果が分かれる
- 失敗テストは複数 SHA で同じテスト名

**仮説**: GitHub Actions runner（2-core Ubuntu）の個体差・隣接プロセス負荷で React の concurrent commit / async timing が乱れる。

**対応**: Step 3 の診断 instrumentation → Step 4 の最小修正。

#### パターン B: エラー本文が空の不可視 failure

**サイン**:
- 「Summary of all failing tests」に同一テスト名が **複数回列挙**
- `Tests: 1 failed` だがバレットは 2 個以上
- バレット後の本文行が空白のみ

**仮説**: テスト本体の assertion 失敗ではなく **unhandled promise rejection** が複数発生し Jest 30 reporter が集約。MSW の `onUnhandledRequest: "error"` が無関係 fetch を誤検出するケースが該当。

**対応**: Step 3 で `--verbose` を有効にして真のエラーを surface させる。

#### パターン C: タイムアウト / handle leak

**サイン**:
- 失敗ログに `Exceeded timeout` / `Jest did not exit one second after the test run`
- `findByTestId` / `waitForElementToBeRemoved` のデフォルト 1000ms timeout 超過

**仮説**: CI runner の遅延で React 19 concurrent rendering / async event handler が間に合わない。

**対応**: timeout 拡大、または `--detectOpenHandles` で leak を特定。

---

### Step 3｜診断 instrumentation を入れる（コード修正の前に必ず実施）

**原則**: 真のエラーが見えるまでテスト code を書き換えない。投機的な書き換えはフレークの真因を埋もれさせる。

**最小侵襲な diagnostic**: `.github/workflows/ci.yml` の test job を 1 行だけ変更:

```yaml
      - name: Run Jest
        # Temporary --verbose for flake diagnostics; --ci suppresses snapshot writes.
        run: bunx jest --verbose --ci
```

| フラグ | 効果 | 副作用 |
|------|------|--------|
| `--verbose` | 各 test の pass/fail と matcher 失敗 message を行ごとに出力 | 出力量増（CI 時間ほぼ不変） |
| `--ci` | snapshot 自動更新を抑制、CI 用 reporter default を選択 | なし |
| `bunx jest` 直接呼び出し | `bun run test` の二重ラップを回避し引数伝搬を確実化 | bun runtime から node runtime へ実行系が変わる場合がある |
| `--runInBand`（**入れない**） | 並列実行を無効化 | 並列 race が真因なら隠してしまう |
| `--detectOpenHandles`（**入れない**） | open handle leak を検出 | CI 時間が 2〜5x に膨張、Step 4 で必要になったら追加 |

**コミット**: `chore(ci): enable jest verbose output to diagnose <area> flake`

---

### Step 4｜CI で再現させて真のエラーを観察する

Step 3 を push した後:

```bash
# 該当 PR の最新 run を watch（CI 完了まで待機）
gh run watch

# 完了後、失敗 run の test job ログから対象テストの本文を取得
gh run view <RUN_ID> --log 2>&1 \
  | grep -B 2 -A 40 "●.*<TEST_NAME>"
```

**フレークは 1 push で再発しないことがある**。1〜3 回 push（空コミット可）して再現を待つ。

```bash
git commit --allow-empty -m "chore: rerun CI for flake reproduction"
git push
```

---

### Step 5｜真因に応じた最小修正

verbose 出力で確認できたエラーパターン別:

#### A: `MSW unhandled request error`

[tests-setup/jest.setup.ts](../../tests-setup/jest.setup.ts) を条件付き bypass に変更:

```ts
const onUnhandledRequest =
  server.listHandlers().length === 0 ? "bypass" : "error";
beforeAll(() => server.listen({ onUnhandledRequest }));
```

**コミット**: `fix(test/setup): bypass unhandled requests when MSW handlers are empty`

#### B: `act() warning` / floating promise

テスト側に `void` を付けるだけ（`onClick={() => { void asyncFn(...); }}`）は **無意味**: TypeScript レベルの注釈で、runtime には floating promise が依然残る。

**正しい修正**: Provider / Context の `async` setter を **同期関数化** する。consumer 側で `await` されていないことを確認した上で `Promise<void>` → `void` に型変更し、非同期 work は fire-and-forget IIFE で起動:

```ts
const setOpen = (modal, fetchData): void => {
    if (!modal) return;
    setShowingModal(modal);
    setIsOpen(true);
    if (!fetchData) return;
    void (async () => {
        try {
            const data = await fetchData();
            setData(prev => ({ ...prev, ...data }));
        } catch (error) { /* ... */ }
    })();
};
```

具体例: [ADR-003](../../../docs/architecture/decisions/003-modal-setopen-sync-for-react19.md)、commit `9b77c59`。

**コミット**: `refactor(<provider>): change <setter> to sync to avoid floating promises and React 19 act issues`

#### C: `findByTestId timeout`

timeout を明示拡大:

```ts
expect(
  await screen.findByTestId("xxx", {}, { timeout: 5000 })
).toBeInTheDocument();
```

**コミット**: `test(<area>): widen findByTestId timeout for slow CI runners`

#### D: `--verbose でも error 本文が空` （★React 19 strict act mode の典型）

**サイン**:
- `--verbose --ci` を有効にしても `●` バレットの後の本文行が空白のまま
- 失敗 test の所要時間が通常範囲（タイムアウト未到達、数十〜数百 ms）
- 後続テストは正常通過（worker は生存）
- 同一テスト名が「Summary」に複数回列挙

**判断**: これは **通常の assertion failure ではない**。React 19 + `IS_REACT_ACT_ENVIRONMENT = true` のテスト環境で、test cleanup 段階で検出される **flush 漏れの非同期 work（floating promise / unflushed effect）** が「test の一部」として attribute されている可能性が極めて高い。

**修正**: 分岐 B と同じ。Provider の `async` setter を同期化する。

**この分岐の特殊性**: ローカル（高速マシン）では再現しないがリモート CI（遅延の大きい runner）でのみ顕在化する。`gh run list` で同一 SHA / 異なる event の結果差を確認すると環境変動 flake の証拠になる。

---

### Step 6｜診断 instrumentation のロールバック判断

Step 5 の修正後 CI が **5 連続グリーン** になったことを確認してから、Step 3 で入れた `--verbose --ci` を判断する:

- **`--verbose` のみ撤回**: 出力量を抑えて元のサマリ形式に戻す
- **`--ci` は残す**: snapshot auto-write 抑制は CI で恒久的に有用
- **`bunx jest` は残す**: `bun run test` 二重ラップ回避は維持価値あり

最低限の構成:

```yaml
      - name: Run Jest
        run: bunx jest --ci
```

**コミット**: `chore(ci): remove --verbose flag after flake fix, keep --ci`

---

## 禁止事項（NEVER）

| 禁止 | 理由 |
|------|------|
| `jest.retryTimes(N)` でフレークを吸収する | リポジトリに使用例ゼロ、`.claude/rules/02-tdd-step-commit.md` の「Red を隠さない」精神に反する、真因が埋もれる |
| `it.skip` で quarantine する | 同上、症状を隠すだけ。一時的に必要でも GitHub Issue を立ててから |
| ローカル再現できないまま test code を書き換える | 投機的修正の典型。Step 3 を飛ばすと修正が当てずっぽうになる |
| 1 コミットで複数の論理単位を混ぜる | [.claude/rules/02-tdd-step-commit.md](../../rules/02-tdd-step-commit.md) 違反。workflow / setup / test を別コミットに分ける |

---

## Rationale（このスキルが必要な理由）

2026-05-24 の `modal-provider.test.tsx` フレーク調査で、以下の失敗パターンを踏んだ:

1. **再現確認なしに test code を書き換えた**（commit `eb15fcf` で `waitFor` → `findByTestId` リファクタ）が CI 失敗は継続
2. **エラー本文が空でも assertion 失敗と仮定**して対応 → 真因（React 19 strict act mode の cleanup 段階エラー）を見落とした
3. **同一 SHA の push event と pull_request event の結果差**を見逃した（後から確認して環境変動 flake と判明）
4. **`--verbose --ci` を入れた直後の偶発的グリーン (`5cbf82a`) を「修正成功」と誤認**し ADR-002 を一度公開 → 翌コミット `2eb3049`（docs only）で両 event 再失敗 → 訂正

最終的に commit `9b77c59` の **Provider setter 同期化** で根本解消。詳細は [ADR-003](../../../docs/architecture/decisions/003-modal-setopen-sync-for-react19.md)。

本スキルはこの教訓を **次回のオペレータが踏まないため** の手順書:

- Step 1〜2 の事実確定を飛ばして Step 5 の code 修正に進まない
- 「数 push で消えた」を「修正完了」と即断しない（複数連続グリーンで判定）
- 「エラー本文が空」は assertion failure ではないシグナル（分岐 D へ）

---

## Related

- ADR: [`docs/architecture/decisions/002-ci-jest-verbose-flag.md`](../../../docs/architecture/decisions/002-ci-jest-verbose-flag.md) — 本スキルが生まれる契機となった調査と診断 instrumentation の決定
- ADR: [`docs/architecture/decisions/003-modal-setopen-sync-for-react19.md`](../../../docs/architecture/decisions/003-modal-setopen-sync-for-react19.md) — 真因（floating promise）と恒久修正の決定
- Steering: [`.claude/steering/tech.md`](../../steering/tech.md) — Context Provider setter の同期化パターン
- Rule: [`.claude/rules/02-tdd-step-commit.md`](../../rules/02-tdd-step-commit.md) — コミット粒度規約
- Skill: [`.claude/skills/test-complete/SKILL.md`](../test-complete/SKILL.md) — コミット前の lint/tsc/test 三点確認
