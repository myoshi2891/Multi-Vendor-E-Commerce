# Plan: review-details OI-8 CI フレーク修正（真因確定 → テスト側 act 修正）

## Context

`docs/ci/unit-tests-run-reactive-kazoo.md` の診断計画に従い、CI でのみ間欠失敗する
`review-details.test.tsx` フレーク（OI-8）を精査した。**診断ファースト（ci-flake-diagnosis Step 3）の結果、真因を確定した。**

### 観測事実（最新失敗 run `27485497130` / push・SHA `932604a`、pull_request `27485497879` も同時失敗）

| 項目 | 観測 |
|------|------|
| 失敗テスト | `should handle submit error and show error log`（以前は `should submit review successfully`。**同一ファイル内の2つの async submit テスト間をフレークが移動**） |
| 失敗署名 | `1 failed, 12 skipped, 1271 passed`。同名テスト**3回列挙・本文すべて空**（OI-8 署名） |
| `[FLAKE-DIAG:unhandledRejection]` | **出力なし** → 真因は unhandledRejection ではない（診断ドキュメントが予告した「想定外分岐」に的中） |
| 代わりに大量出力 | `An update to ReviewDetails inside a test was not wrapped in act(...)` および `An update to null inside a test was not wrapped in act(...)` |
| 警告のスタック | `react-hook-form/src/useForm.ts:92` / `useWatch.ts:166` / `createFormControl.ts:420(isValid)` / `:841(isValid)` |
| ローカル再現 | `bunx jest review-details` → **8 pass・緑**だが `not wrapped in act` 警告が **8 件**発生（典型的 CI フレーク: ローカル緑・CI赤） |

### 確定した真因

[review-details.tsx:187-189](src/components/store/forms/review-details.tsx#L187-L189) の
`useForm({ mode: 'onChange', resolver: zodResolver(...) })` は、**フィールド変更ごとに非同期バリデーション**
（zodResolver → `isValid` 解決）を走らせる。テストの `fireEvent.click(star)` / `fireEvent.mouseDown(sizeOption)` /
`fireEvent.change(textarea)` は **act 外**で発火し、各 `field.onChange` が起動した onChange バリデーションの
`setState`（`dispatchSetState`）が、同期 `fireEvent` 完了後の**マイクロタスクで act 外に着地**する。

低速 CI runner 上では、このリーク更新が後続の `await act()` / `waitFor` 境界と競合して act 環境を破壊し、
OI-8 署名（同名3回・本文空）の失敗を生む。2つの async submit テストだけが `await` 境界を持つため、
フレークはこの2テスト間を移動する（同期テストは警告は出すが await 境界が無いため失敗しない）。

### ゴール
観測された真因（onChange バリデーションの act 外リーク）を、**テスト側で `act` 包囲**して封じ込め、
本番コード・ユーザー向け挙動を変えずにフレークを根絶する（ユーザー決定: テスト側 act 包囲）。

## Approach

### Step 1 — テスト修正（commit 1, テストコードのみ）

対象: [src/components/store/forms/review-details.test.tsx](src/components/store/forms/review-details.test.tsx) の
**2テスト** `should submit review successfully`（277-327行）と
`should handle submit error and show error log`（329-375行）。

各テストの**フィールド入力 `fireEvent` を `await act(async () => {...})` で包む**（既存の submit-in-act は維持）。
パターン（両テスト共通、star/size/textarea の3操作）:

```ts
// 星クリック（rating field.onChange → onChange バリデーション）を act 内でフラッシュ
await act(async () => {
    fireEvent.click(star, { clientX: 30 }); // 3.0
});

// サイズ選択: focus でドロップダウン展開 → option 取得 → mouseDown(field.onChange)
await act(async () => {
    fireEvent.focus(sizeInput);
});
const sizeOption = screen.getByText('One Size');
await act(async () => {
    fireEvent.mouseDown(sizeOption);
});

// レビュー本文（review field.onChange）を act 内でフラッシュ
await act(async () => {
    fireEvent.change(textarea, { target: { value: 'Good product!' } });
});

// 既存の submit-in-act + waitFor はそのまま
await act(async () => {
    fireEvent.click(submitBtn);
});
await waitFor(() => { /* 既存 assertion */ });
```

- `act` は `@testing-library/react` から既に import 済み（3行目）。新規依存なし。
- テスト**数は不変**（8件のまま、総数 1284 不変）→ `spec-sync-after-test` skill は**不要**。
- commit: `test(review): wrap RHF onChange interactions in act to fix OI-8 CI flake`
- 補足: 診断ドキュメントの Step C 仮説（submit ライフサイクルの `waitFor` 追加）は**観測で否定**された。
  リーク源は submit 後の `isSubmitting` 再レンダリングではなく、**フィールド変更時の onChange バリデーション**
  だったため、修正点を field-fill 包囲へ修正する。

### Step 2 — ローカル検証（commit 前 / 後）

```bash
bunx jest src/components/store/forms/review-details.test.tsx 2>&1 | grep -c "not wrapped in act"
```

- **修正前 = 8、修正後 = 0** を確認（act 外リークが封じ込められた決定論的シグナル）。
- `test-complete` skill（lint / tsc / test）が緑であることを確認してから commit（rule 02）。

### Step 3 — CI で 5 連続グリーン確認（push / pull_request 両 event）

- push 後 `gh run watch`。フレークは間欠のため、**push/pull_request 両 event × 5 連続グリーン**を満たすまで
  「修正成功」と即断しない（ci-flake-diagnosis Rationale の過去の誤認教訓）。
- 必要なら空コミット（`git commit --allow-empty`）で追加サイクルを回す。
- 各 run のログで `not wrapped in act`（review-details 帰属）が消えていることを併せて確認。

### Step 4 — 診断インストルメンテーションのロールバック（commit 2, 5連続グリーン後）

[tests-setup/jest.setup.ts:79-113](tests-setup/jest.setup.ts#L79-L113) の `[FLAKE-DIAG OI-8]` リスナー
（リスナー本体・グローバルフラグ・`afterAll` 解除）を削除。

- 検証: `grep -rn "FLAKE-DIAG" tests-setup/ src/` がゼロ。
- commit: `chore(test): remove temporary OI-8 diagnostics after review-details flake fixed`

### Step 5 — docs 同期（commit 3, ロールバックとは別 commit）

OI-8 のクローズを追跡 doc に記録（テスト統計は不変のため統計同期は対象外）:

- [docs/ci/unit-tests-run-reactive-kazoo.md](docs/ci/unit-tests-run-reactive-kazoo.md): 確定した真因（onChange
  バリデーションの act 外リーク・event-pair 証跡 `27485497130`/`27485497879`）と修正 commit を「想定外分岐の決着」として追記。
- [docs/testing/QA_HANDOFF.md](docs/testing/QA_HANDOFF.md): OI-8 Open Issue を解決済みに更新（active header の件数/日付ドリフトに注意）。
- [docs/architecture/decisions/003-modal-setopen-sync-for-react19.md](docs/architecture/decisions/003-modal-setopen-sync-for-react19.md):
  後続調査セクションに「RHF onChange バリデーションのリークは Provider setter 同期化（パターン D）と別系統。
  テスト側 act 包囲で解決」を追記。
- commit: `docs(testing): record OI-8 review-details flake root cause and fix`

## 変更ファイル（代表）

- `src/components/store/forms/review-details.test.tsx` — 2テストの field-fill を act 包囲（Step 1）
- `tests-setup/jest.setup.ts` — `[FLAKE-DIAG]` 診断リスナー削除（Step 4）
- `docs/ci/unit-tests-run-reactive-kazoo.md` / `docs/testing/QA_HANDOFF.md` / `docs/architecture/decisions/003-*.md` — 記録（Step 5）

## 検証

1. **リーク封じ込め（ローカル決定論シグナル）**: Step 2 の `grep -c "not wrapped in act"` が修正前 8 → 修正後 **0**。
2. **回帰なし**: `bun run test`（全体）でテスト総数不変（1284）・他スイート緑、`bunx tsc --noEmit` 緑、`bun run lint` 緑。
3. **フレーク根絶**: Step 3 で **push/pull_request 両 event × 5 連続グリーン**。
4. **ロールバック完了**: Step 4 後、`grep -rn "FLAKE-DIAG" tests-setup/ src/` がゼロ。

## 禁止事項（ci-flake-diagnosis / rule 02 準拠）

- `jest.retryTimes` でフレークを吸収しない。
- 本番コンポーネント（`mode: 'onChange'`）をフレーク回避目的で変更しない（ユーザー決定 = テスト側修正）。
- 「1サイクル両グリーン = 完了」と即断しない（5連続が基準）。
- テスト修正・診断ロールバック・docs を 1 commit に混ぜない（rule 02 フェーズ分離）。
- `bunx tsc --noEmit` が各コミット時点で通る状態を維持する。
