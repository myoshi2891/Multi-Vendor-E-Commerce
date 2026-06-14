# Plan: review-details "should submit review successfully" CI フレーク診断

## Context

`review-details.test.tsx › should submit review successfully` が CI でのみ間欠失敗。
**事実確定（ci-flake-diagnosis Step 1, event-pair 対比）**:

| 項目 | 観測 |
|------|------|
| 同一 SHA `2c1be6c` の結果差 | push run `27468097127` = **failure** / pull_request run `27468097968` = **success** |
| 失敗ログ | `1 failed, 12 skipped, 1271 passed`。`● ...should submit review successfully` が **3 回列挙・本文すべて空白**、所要 286ms（timeout 未到達） |
| ローカル | 1272 全 pass |
| 既存の診断フラグ | CI は既に `bunx jest --verbose --ci --coverage`（ADR-002）。**それでも本文が空** |
| 過去の修正試行 | `13a8c45`(act でラップ), `e74bba3`, `06fbe73` — いずれも未解決 |

**分類**: パターン A（環境変動 flake）＋ パターン D / OI-8 の署名（3×バレット・本文空・非timeout）。
通常の assertion 失敗ではなく、React 19 strict act mode の cleanup 段階で **握り潰された非同期 work**（unhandled rejection）がテストに帰属している。

**真因仮説**: `form.handleSubmit(handleSubmit)`（RHF）の非同期チェーン
（validation → `await upsertReview` → `setReviews`/`toast` → `isSubmitting:false` re-render）のうち、
末尾の `isSubmitting` 再レンダリングが、`await act(() => fireEvent.click())` 退出後・`waitFor` 再進入前に
低速 runner 上で着地し、act 外 state 更新としてフレーク化している。
`--verbose` でも本文が空 = console.error ではなく **unhandledRejection** が真因の可能性が高い
（Jest 30 reporter が集約し本文を出さない）。

**ゴール**: コードを投機的に書き換える前に、握り潰された rejection のスタックを CI ログに surface させ、
真因を観測してから最小修正する（skill Step 3 「コード修正の前に必ず実施」）。

## Approach（診断ファースト・確定事項）

ユーザー決定: **unhandledRejection リスナーをグローバル `jest.setup.ts` に追加**（診断のみ・可逆）。

### Step A — 診断インストルメンテーション（commit 1）

`tests-setup/jest.setup.ts` の末尾に、`[FLAKE-DIAG]` ラベル付き・**1 リスナー**を追加:

```ts
// [FLAKE-DIAG OI-8] TEMP — remove after review-details flake root-caused (QA_HANDOFF OI-8 / Step 6)
// 握り潰された unhandled rejection を、どのテスト実行中かと共に CI ログへ surface させる。
// 通常の assertion 失敗には影響しない（観測専用）。
process.on("unhandledRejection", (reason: unknown) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    const current =
        typeof expect !== "undefined" && typeof expect.getState === "function"
            ? expect.getState().currentTestName
            : undefined;
    console.error(
        `[FLAKE-DIAG:unhandledRejection] test="${current ?? "unknown"}"`,
        err.message,
        err.stack,
    );
});
```

- `unknown` + `instanceof Error` 型ガード（CLAUDE.md 規約準拠、`any` 不使用）。
- `expect.getState().currentTestName` で帰属テストを特定。
- グローバル登録のため `beforeAll` 不要だが、重複登録回避のためファイルトップレベルで 1 回のみ。
- commit: `chore(test): add temporary unhandledRejection diagnostics for OI-8 review-details flake`
  （診断のみの独立 commit。rule 02 のフェーズ分離に従い、修正・docs とは別 commit）

### Step B — CI で再現させ真のスタックを観測（push）

```bash
git push origin dev
gh run watch                       # 完了まで待機
# 失敗 run を取得して診断行を抽出
gh run view <RUN_ID> --log 2>&1 | grep -A 30 "\[FLAKE-DIAG:unhandledRejection\].*should submit review"
```

フレークは 1 push で再発しないことがある → 最大 3 回まで空コミットで再現を待つ:

```bash
git commit --allow-empty -m "chore: rerun CI for OI-8 review-details flake reproduction"
git push
```

**判断**: `[FLAKE-DIAG]` 行が surface したスタックで真因を確定してから Step C に進む。
surface しない（= rejection ではなく act-warning が真因）場合は、診断を console.error 監視へ
切り替える別案を再評価する（本プランの想定外分岐）。

### Step C — 観測結果に基づく最小修正（commit 2, 別 PR/commit）

最有力の修正（観測で裏付けが取れた場合）:
`review-details.test.tsx` の `should submit review successfully` 末尾に、
**送信ライフサイクルの完了（isSubmitting=false 復帰）を act 内で確定フラッシュ**する待機を追加。

```ts
// 既存 waitFor の後に、ローダー解除（isSubmitting=false 再レンダリング）を待機して
// 末尾の state 更新を act 内で確定フラッシュする
await waitFor(() =>
    expect(
        screen.getByRole("button", { name: "Submit Review" }),
    ).toBeInTheDocument(),
);
```

- Provider setter 同期化（skill パターン D の標準処方）は本ケースに**写像しない**
  （RHF submit ライフサイクル由来で、同期化できる Context setter が存在しない）。
- 真因が component 側（`handleSubmit` の post-await state 更新）にあると判明した場合のみ
  component を触る。原則テスト側の確定待機で解決を優先。
- commit: `test(review): settle submit lifecycle to fix OI-8 CI flake`

### Step D — 安定確認 → 診断ロールバック（commit 3, skill Step 6）

- 修正後 **5 連続グリーン**（push/pull_request 両 event）を確認するまで「修正成功」と即断しない
  （skill Rationale の過去の誤認教訓）。
- 5 連続グリーン後、Step A のリスナーを削除。
  commit: `chore(test): remove temporary OI-8 diagnostics after review-details flake fixed`
- `--verbose` は ADR-002 管理下のため本プランでは触らない（別判断軸）。

### Step E — docs 同期

- テスト**数**は変わらない（修正のみ）想定 → `spec-sync-after-test` 不要。
- ただし OI-8 の調査記録として `docs/testing/QA_HANDOFF.md` の該当 Open Issue と
  `docs/architecture/decisions/003-*.md` 後続調査セクションに、本フレークの event-pair 証跡と
  確定した真因・修正 commit を追記（skill CONDITIONAL / 追跡 doc 規定）。

## 変更ファイル（代表）

- `tests-setup/jest.setup.ts` — 診断リスナー追加（Step A）/ 削除（Step D）
- `src/components/store/forms/review-details.test.tsx` — 末尾待機追加（Step C）
- `docs/testing/QA_HANDOFF.md`, `docs/architecture/decisions/003-modal-setopen-sync-for-react19.md` — 記録（Step E）

## 検証

1. **診断が効くこと**: Step B で `[FLAKE-DIAG:unhandledRejection] test="...should submit review successfully"` 行が
   失敗 run のログに出ること（出れば真因スタック取得、出なければ分岐再評価）。
2. **修正の有効性**: Step C 後、ローカル `bunx jest src/components/store/forms/review-details.test.tsx` 全 pass、
   かつ CI で **push/pull_request 両 event × 5 連続グリーン**。
3. **回帰なし**: `bun run test`（全体）でテスト総数不変・他スイート緑。
4. **ロールバック**: Step D 後、`jest.setup.ts` に `[FLAKE-DIAG]` が残っていないこと（grep ゼロ）。

## 禁止事項（skill 準拠）

- `jest.retryTimes` でフレーク吸収しない。
- 真因スタックを観測する前に test code を投機的に書き換えない（Step B → C の順序厳守）。
- 「1 サイクル両グリーン = 完了」と即断しない（5 連続が基準）。
- 診断・修正・docs・ロールバックを 1 commit に混ぜない（rule 02 フェーズ分離）。
