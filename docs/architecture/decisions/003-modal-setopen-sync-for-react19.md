# 003. `ModalProvider.setOpen` を同期関数化（React 19 strict act mode 対応）

- **Status**: **Partial Mitigation** — 設計改善としては妥当だが **CI flake の根本解消には至らず**。2026-05-25 追加調査で仮説 A (isMounted 撤廃) / 仮説 B (MSW warn) の単独試行も決定的な解消に至らないことが確定。詳細は本 ADR 末尾「[後続調査と一時スキップ判断](#後続調査と一時スキップ判断)」および「[2026-05-25 追加調査](#2026-05-25-追加調査と次回着手点)」を参照
- **Date**: 2026-05-24
- **Deciders**: myoshizumi（実装）, Claude Code（調査支援）

---

## Context

[`src/providers/modal-provider.tsx`](../../../src/providers/modal-provider.tsx) の `setOpen` メソッドが CI 環境でフレーキーな失敗を引き起こしていた。詳細な調査経緯と diagnostic 試行は [ADR-002](002-ci-jest-verbose-flag.md) を参照。

### 直接的な技術的問題

旧 `setOpen` は `async` 関数として定義されていた:

```ts
const setOpen = async (modal, fetchData) => {
    if (modal) {
        setShowingModal(modal);
        setIsOpen(true);
        if (fetchData) {
            try {
                const fetchedData = await fetchData();
                setData(prev => ({ ...prev, ...fetchedData }));
            } catch (error) { /* ... */ }
        }
    }
};
```

全 18 箇所の呼び出し（`src/app/dashboard/**/columns.tsx` ほか）は **誰も `await setOpen(...)` していない**:

```tsx
// 典型的な呼び出しパターン
<button onClick={() => setOpen(<CustomModal>...</CustomModal>)}>
```

この `onClick={() => setOpen(...)}` は **常に floating promise** を生成する。`fetchData` を渡さない経路でも、`async` 関数である以上 `Promise<undefined>` を返してしまうため。

### React 19 + RTL 16 + Jest 30 環境での顕在化

React 19 の strict act mode（`globalThis.IS_REACT_ACT_ENVIRONMENT = true` を設定したテスト環境）では、テスト cleanup 段階で **flush されなかった非同期 work が "unflushed effect" として検出**される。floating promise が microtask キューに残った状態で test 本体が完了すると、cleanup 時に検出される。

CI で観察された具体的症状:

- 失敗テストは `✕` マークがつくが、実行時間は 125ms（タイムアウトではない）
- 後続テストは全て正常通過（worker は生存）
- Jest「Summary of all failing tests」に同一テスト名が **3 回列挙**、本文は完全に空
- `--verbose` フラグでも error 本文出ず（通常の assertion failure reporter を通っていない証拠）
- ローカル（M-series Mac）では 20 連続実行で再現せず、CI runner（2-core Ubuntu）の遅延でのみ顕在化

### 制約

- ローカル再現できないため、修正後の検証は CI 観察に頼る必要がある
- `Promise<void>` の型シグネチャを変更する場合、全呼び出し元の互換性を確認する必要がある
- [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md) の精神（Red を隠さない）から `jest.retryTimes` での回避は禁忌

---

## Decision

[`src/providers/modal-provider.tsx`](../../../src/providers/modal-provider.tsx) の `setOpen` を **同期関数化**し、`fetchData` 経路は **fire-and-forget の IIFE** で起動する:

```ts
type ModalContextType = {
    setOpen: (
        modal: React.ReactNode,
        fetchData?: () => Promise<Partial<ModalData>>
    ) => void;  // ← Promise<void> → void
    // ...
};

const setOpen = (
    modal: React.ReactNode,
    fetchData?: () => Promise<Partial<ModalData>>
): void => {
    if (!modal) return;
    setShowingModal(modal);
    setIsOpen(true);
    if (!fetchData) return;

    void (async () => {
        try {
            const fetchedData = await fetchData();
            setData(prev => ({ ...prev, ...fetchedData }));
        } catch (error) {
            if (error instanceof Error) {
                console.error("Failed to fetch modal data:", error.message, error.stack);
            } else {
                console.error("Failed to fetch modal data:", error);
            }
        }
    })();
};
```

### テスト側の追従

`fetchData が例外を投げても...` テスト ([`src/providers/modal-provider.test.tsx:158-218`](../../../src/providers/modal-provider.test.tsx#L158-L218)) は `console.error` 呼び出し検証を `waitFor` 内に移動。IIFE 経由で microtask 後に実行されるため、`await user.click(...)` 直後の同期 assertion は race する。

### 検証

- `bunx tsc --noEmit`: 0 errors
- `bun run lint`: 0 errors (warnings は既存のみ)
- `bunx jest src/providers/modal-provider.test.tsx --verbose --ci`: 10/10 pass
- ローカル連続 15 回実行: 全パス
- CI: commit `9b77c59` で push event / pull_request event 両方グリーン
- 全 18 callers の互換性: 誰も `await setOpen(...)` していない → 型変更は無破壊

---

## Alternatives Considered

### Option 1: `jest.retryTimes(2)` でリトライ吸収

**説明**: 該当テストファイル冒頭に `jest.retryTimes(2)` を追加し、フレークを 3 回まで許容。

**メリット**:
- 1 行で済む

**デメリット**:
- リポジトリ既存使用例ゼロ
- [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md) の「Red を隠さない」精神に反する
- 真因が埋もれ将来の保守困難
- 他テストでの同様問題に毎回対応必要

**なぜ選ばなかったか**: 症状を隠すだけで根本解決にならず、技術負債が積み上がる。

### Option 2: テストを `it.skip` で quarantine + 別タスク化

**メリット**:
- CI 即グリーン化

**デメリット**:
- カバレッジ低下
- quarantine が恒久化する典型パターン

**なぜ選ばなかったか**: 同上、最終手段。

### Option 3: テストコードに `await act(async () => {...})` を明示追加

**説明**: `await user.click(...)` を `await act(async () => { await user.click(...); })` で囲む。

**メリット**:
- Provider 本体に手を入れない

**デメリット**:
- `userEvent.setup().click()` は内部で `act()` 済み → 二重 `act()` は無意味の可能性
- 真因（floating promise）を解消しないので別の経路で再発する可能性
- 全テスト箇所で defensive コーディング必要

**なぜ選ばなかったか**: 症状的対処であり、根本的な「async 関数を await しない」という設計問題が残る。

### Option 4: `flushSync` で commit を atomic 化

**説明**: `react-dom` の `flushSync` で `setShowingModal` + `setIsOpen` を強制 atomic commit。

```ts
flushSync(() => {
    setShowingModal(modal);
    setIsOpen(true);
});
```

**メリット**:
- React 19 concurrent rendering の commit 分割を防ぐ

**デメリット**:
- `flushSync` は React の推奨パターンでない（パフォーマンス影響）
- floating promise 問題は依然として残る
- 本問題の真因は concurrent commit 分割ではなく floating promise の可能性が高い

**なぜ選ばなかったか**: 副作用が大きい割に真因への切れ味が不確実。本 ADR の同期化で問題が解消したため、不要となった。

---

## Consequences

### Positive

- **設計の明瞭化**: `async` だが await されない関数の anti-pattern を解消
- **型シグネチャの正直化**: 戻り値が実際には消費されないことを `void` で明示
- **将来の Provider 設計指針**: 「Context Provider の setter が consumer に await されない場合は同期関数で実装する」というパターンを [`.claude/steering/tech.md`](../../../.claude/steering/tech.md) に追加

> ⚠️ **当初記載していた「フレーク解消」「ローカルと CI の挙動差が解消」は誤りでした**。`9b77c59` の直後 1 サイクルだけ両 event グリーンとなり「修正完了」と判断したが、後続 commit `9040dcc` で再び PR event で失敗。詳細は [後続調査と一時スキップ判断](#後続調査と一時スキップ判断) を参照。

### Negative

- **`Promise<void>` を期待するコードが将来追加された場合に await が無意味になる**: 同期関数になったため `await setOpen(...)` を書いても何も待たない。lint rule の追加 (`@typescript-eslint/no-floating-promises` の逆向き) は現状なし
- **fetchData エラー伝播経路が分離**: IIFE 内 catch で console.error のみ。呼び出し元では fetchData 失敗を知る術がない（旧実装でも同様だったため実質変化なし）

### Risks

- **fetchData IIFE 内で setState する際の race**: コンポーネントがアンマウントされた後に setData が呼ばれる可能性。React 19 では警告も出ない（黙って無視される）ので実害なし
- **他の Provider に同パターンが残存**: 本リポジトリ内で同様の `async` setter を持つ Context Provider があれば同じ問題が発生する可能性。`grep "= async (" src/providers/` で要確認（今回は ModalProvider のみ）

---

## Implementation

- [x] [`src/providers/modal-provider.tsx`](../../../src/providers/modal-provider.tsx): 型と実装を変更
- [x] [`src/providers/modal-provider.test.tsx`](../../../src/providers/modal-provider.test.tsx): fetchData 失敗テストの assertion を `waitFor` 内に移動
- [x] `bunx tsc --noEmit` / `bun run lint` / `bunx jest` の三点クリア
- [x] [`.claude/skills/ci-flake-diagnosis/SKILL.md`](../../../.claude/skills/ci-flake-diagnosis/SKILL.md) Rationale に本件の教訓を追記
- [x] [`.claude/steering/tech.md`](../../../.claude/steering/tech.md) に「Context Provider setter 同期化パターン」を追加
- [x] [ADR-002](002-ci-jest-verbose-flag.md) の誤認部分（`--verbose` で解消した云々）を訂正
- [ ] **CI 両 event 安定グリーン**: ❌ 未達成。詳細は [後続調査と一時スキップ判断](#後続調査と一時スキップ判断)
- [ ] **真因解消**: 仮説 A〜F が未検証。下記セクション参照

**関連コミット**:
- `9b77c59` — 本決定の実装（`refactor(providers/modal): change setOpen to sync...`）
- `9040dcc` — docs sync。コード不変だが PR event で再失敗（→ 仮説の決定的反証）

---

## Related

- 関連 ADR: [ADR-002: CI で `bunx jest --verbose --ci` を採用](002-ci-jest-verbose-flag.md) — 本件の調査経緯と診断 instrumentation
- 関連 Skill: [`.claude/skills/ci-flake-diagnosis/SKILL.md`](../../../.claude/skills/ci-flake-diagnosis/SKILL.md) — CI フレーク調査プレイブック
- 関連 Steering: [`.claude/steering/tech.md`](../../../.claude/steering/tech.md) — Context Provider setter パターン項
- 関連ファイル:
  - [`src/providers/modal-provider.tsx`](../../../src/providers/modal-provider.tsx)
  - [`src/providers/modal-provider.test.tsx`](../../../src/providers/modal-provider.test.tsx)
  - 18 箇所の呼び出し元（`grep -rn "setOpen" src --include="*.tsx" | grep -v test`）

---

## Notes

### React 19 strict act mode の floating promise 検出について

React 19 で `IS_REACT_ACT_ENVIRONMENT = true` を設定したテスト環境では、test 完了時点で React の internal scheduler に残っている非同期 work（floating promise / unflushed effect）を error として attribute する。

具体的には:

- `act()` で wrap されていない非同期処理がある場合、cleanup 段階で「test の一部として完了すべき work が未完了」とみなす
- このエラーは通常の `expect()` failure reporter を通らないため、`--verbose` でも `--silent=false` でも本文が空のまま表示される
- 同じ test 内で複数の floating promise があると、各々別 entry として「Summary of all failing tests」に列挙される（「1 failed, 3 entries」現象の正体）

### 同種問題の予防策

Context Provider / カスタムフックで setter を定義する際は:

1. **consumer が await しないなら同期関数で実装する**: `Promise<void>` を返すと floating promise を誘発
2. **async work が必要なら fire-and-forget IIFE で起動する**: `void (async () => { ... })()` パターン
3. **テストで `IS_REACT_ACT_ENVIRONMENT = true` を設定する場合は特に注意**: 上記原則を破ると CI でのみフレーク化する

このパターンは [`.claude/steering/tech.md`](../../../.claude/steering/tech.md) の「実装パターン例」に追加済み。

---

## 後続調査と一時スキップ判断

> **2026-05-24 追加** — 本 ADR の修正後も CI flake が継続したため、対象テストを `it.skip` で一時退避した。次回調査の出発点として情報を集約する。

### 何が起きたか（時系列・確定事実）

| commit | 変更内容 | push event | pull_request event |
|--------|---------|-----------|--------------------|
| `5223dfd` | （既存問題のベースライン） | ❌ | ❌ |
| `81a8d97` | test mock 修正 | ✅ | ❌ |
| `eb15fcf` | テストを `findByTestId` リファクタ | ✅ | ❌ |
| `5cbf82a` | `bunx jest --verbose --ci` ([ADR-002](002-ci-jest-verbose-flag.md)) | ✅ | ✅ ← 偶然 |
| `2eb3049` | docs only | ❌ | ❌ |
| `9b77c59` | **本 ADR: setOpen 同期化** | ✅ | ✅ ← 偶然 |
| `9040dcc` | docs only | ✅ | ❌ |
| `<skip適用後>` | `it.skip` 適用 | ✅ | ✅（恒久） |

**観察された CI 失敗の固有パターン**（複数回再現）:

- 失敗テストは `✕` マークで所要時間 125ms（タイムアウトではない）
- 後続テストは全て正常通過（worker は生存）
- Jest「Summary of all failing tests」に同一テスト名が **3 回列挙**、本文は **完全に空**
- `--verbose --ci` でも error 本文が出現しない（通常の assertion failure reporter を通っていない）
- ローカル（M-series Mac）20+ 連続実行で **再現不可**
- 同一 commit SHA で `push` event と `pull_request` event の結果が **頻繁に分かれる**（runner 個体差）

### 真因の候補（未検証・優先度順）

| # | 仮説 | 信頼度 | 検証アクション |
|---|------|------|--------------|
| A | **`useEffect → setIsMounted` の二重 render race** ([modal-provider.tsx:33-37](../../../src/providers/modal-provider.tsx#L33-L37))。ESLint も `react-hooks/set-state-in-effect` で警告中。`"use client"` 配下なら不要なパターン | 高 | isMounted パターンを撤廃。`describe("ハイドレーション")` テストの調整必要 |
| B | **MSW `onUnhandledRequest: "error"` (handler 0)** ([tests-setup/jest.setup.ts:9](../../../tests-setup/jest.setup.ts#L9))。React 19 / RTL の内部 fetch が偶発時に error 化、unhandled rejection として「3 件本文空」の症状を生む | 中 | `server.listHandlers().length === 0 ? "bypass" : "error"` 条件化 |
| C | **Jest 30 + React 19 + jsdom の reporter 互換性バグ**（assertion 以外のエラーが serialize できない） | 中 | jest issue tracker 検索、`@testing-library/jest-dom` のバージョン精査 |
| D | **`ハイドレーション` テストの `React.useEffect` spy leak**（[modal-provider.test.tsx:318-320](../../../src/providers/modal-provider.test.tsx#L318-L320)）。worker 内の test 並び順次第で別テストの useEffect コールに mock がリーク | 低 | ハイドレーションテストを別ファイル隔離、または spy を使わない実装に変更 |
| E | **`bunx jest` の bun↔node runtime 切替が間欠的**。bun runtime は React 19 の Promise scheduling と完全互換でない既知問題あり | 低 | workflow で `node node_modules/jest/bin/jest.js` を明示 |
| F | **GitHub Actions runner 個体差・隣接ジョブ干渉**。push と pull_request は別 concurrency group のため別 runner | 環境依存 | 我々側で対応不能 |

### 試行済みアプローチと結果

| アプローチ | commit | 結果 |
|----------|--------|------|
| テスト書換: `waitFor` 多重 → `findByTestId` | `eb15fcf` | ❌ 効果なし |
| CI 診断: `bunx jest --verbose --ci` | `5cbf82a` | △ 真のエラー本文を surface せず、しかし「assertion failure でない」事実を確定。1 サイクル偶発グリーン |
| アーキ修正: `setOpen` 同期化 + IIFE | `9b77c59` | △ 設計改善としては妥当。1 サイクル偶発グリーンだが恒久解消せず |
| 一時退避: 該当 1 件のみ `it.skip` | （本対応） | ✅ CI 即安定。**カバレッジ損失は限定的**（下記参照） |

### スキップ判断の根拠

- **同等カバレッジが残存**: スキップ対象は「[P1] モーダルを開くと isOpen=true...」で、is-open=true の検証は `[P1] fetchData なしでモーダルを開ける` ([modal-provider.test.tsx:140](../../../src/providers/modal-provider.test.tsx#L140)) でカバー。差分は modal-content の DOM 存在検証のみで、リスクは限定的
- **CI 不安定の組織衛生コストが上回る**: 赤い CI を放置すると「CI 無視文化」が定着するリスク
- **次回投資の効率を上げるため一旦整理**: 後続調査時に hypothesis A〜F のどれから着手するか即座に判断できる状態を残す（本セクション）

### 期限と再開条件

- **期限**: 2026-06-07（2 週間後）までに **仮説 A（isMounted 撤廃）または 仮説 B（MSW bypass）** のどちらかを試行
- **再開条件**: いずれかの仮説検証 → ローカルで CI と同等の遅延を模擬して再現確認 → 修正適用 → `it.skip` 解除
- **追跡先**: [`docs/testing/QA_HANDOFF.md`](../../testing/QA_HANDOFF.md) "OI-8"

### 次回着手手順（プレイブック）

1. [`.claude/skills/ci-flake-diagnosis/SKILL.md`](../../../.claude/skills/ci-flake-diagnosis/SKILL.md) Step 1〜2 で事実を再確定
2. 本セクションの仮説 A から順に **1 つずつ** 試行（同時並行しない＝因果切り分け不能になる）
3. それぞれの試行ごとに **連続 5 サイクル両 event グリーン** を観察してから「解消」と判定
4. 解消が確認できたら本 ADR の Status を `Accepted` に更新、`it.skip` を解除、`9040dcc` 以降の状況差分を本セクションに追記

---

## 2026-05-25 追加調査と次回着手点

> **2026-05-25 追加** — 仮説 A (isMounted 撤廃) と仮説 B (MSW warn) を順に試行し、
> いずれも root cause 解消に至らないことが確定した。skip 戦略の限界も判明したため
> 次回は **workflow layer (`.github/workflows/ci.yml`) の修正** を優先する。

### 試行ログ (commit × event の累積観測)

| commit | 変更 | push | pull_request | flake test |
|--------|------|------|--------------|-----------|
| `a85460b` | 仮説 A (isMounted 撤廃) + 2 件目 `it.skip` | ✅ | ✅ | — |
| `73609ef` | product.test.ts: scoped mock 強化 (CodeRabbit 対応) | ❌ | ❌ | `fetchData throws` |
| `12aef66` | setOpen `describe.skip` | ✅ | ❌ | `setClose 閉じると...` |
| `bacfe2e` | ModalProvider file-level skip | ❌ | ✅ | `shipping-form: creates new address` |
| `c579642` | 仮説 B (MSW `onUnhandledRequest: warn`) | ✅ | ✅ | — |
| `5851756` | modal unskip (cycle 2/5 観察) | ❌ | ✅ | `fetchData ありで data マージ` |
| `7559884` | modal 再 file-level skip | (観察対象外) | (観察対象外) | — |
| `63ec5cc` | (modal skip 維持・コード不変) | ❌ | — | `shipping-form: handles API errors correctly` |

**12 観測中 5 失敗** (push 50% 成功 / pull_request 67% 成功)。完全なランダム性。

> **2026-05-29 追記** — `63ec5cc` で再び CI fail（`shipping-form.test.tsx > handles API errors correctly`、`●` が本文空で 2 回列挙される OI-8 固有症状）。modal-provider は file-skip 維持・本テスト/コンポーネントは未変更で、ローカルでは単体・フルファイルとも決定的に pass。これは「skip は症状を別ファイルへ移動させるだけ」（`bacfe2e` 行）の再々現であり、**真因が RTL + fireEvent/waitFor を使うテスト全般のメタ問題である**ことを再確認した。次手は本ファイルの未着手候補（仮説 E → G）の workflow layer 修正。

### この調査で確定した事実

1. **skip 戦略は症状を別ファイルへ移動させるだけ**
   - it.skip → describe.skip → file-skip と段階的に拡大しても、最終的に shipping-form.test.tsx (modal 完全 skip 状態で) に flake が出現
   - つまり flake source は modal-provider 固有ではなく **RTL + userEvent + waitFor を使うテスト全般** が CI runner で偶発的にハングするメタ的問題
2. **同一 commit で push / pull_request の結果が分かれる現象が頻発**
   - `12aef66` / `bacfe2e` / `5851756` で観測。**コード変更ではなく runner 個体差 / worker 分担の変動が trigger** (仮説 F) が支配的
3. **仮説 A (isMounted 撤廃) 単独効果は限定的**
   - `a85460b` で両グリーンだったが、次の commit `73609ef` (modal 未触) で flake 再発 → 単独では不十分
4. **仮説 B (MSW warn) 単独効果も限定的**
   - `c579642` で両グリーン (modal skip 状態) → `5851756` で modal unskip すると push fail → modal を含めると依然 flake する

### 残候補と推奨次手

| # | 候補 | 信頼度 | 検証コスト | 次回着手案 |
|---|------|------|-----------|----------|
| E | **Jest を node 直接呼出** — `.github/workflows/ci.yml` で `bunx jest` → `node node_modules/jest/bin/jest.js` | 中 | 低 (workflow 1 行修正) | bun runtime の React 19 Promise scheduling 非互換を排除 |
| G | **`--maxWorkers=1` で並列起動排除** — `.github/workflows/ci.yml` の jest コマンドに追加 | 中 | 低 (CI 時間 1.5-2 倍だが許容) | worker race を切り分け |
| H | **`--testRunner=jest-circus` 明示** や Jest reporter の差し替え | 低 | 中 | 仮説 C (Jest 30 + React 19 reporter 互換性バグ) 検証 |
| I | **continue-on-error: true で Jest 失敗を許容** | (回避策) | 低 | 根本解決ではないが PR ブロック解除 |

**推奨**: まず E (workflow 修正のみ) を試し、効果がなければ G (`--maxWorkers=1`) を追加。
両方が無効なら I (continue-on-error) で運用を回しつつ Jest / React 19 のメジャーバージョン更新を待つ。

### 現在の skip 状態 (2026-05-25 終了時点)

- [`src/providers/modal-provider.test.tsx`](../../../src/providers/modal-provider.test.tsx): file-level skip (9 tests skipped, 1 suite skipped)
- 既存の idempotency 3 件 skip は維持
- **合計**: 12 skipped tests / 2 skipped suites / 1003 passed / 1015 total

### 次回着手手順 (プレイブック)

1. **新規ブランチ** で仮説 E (`bunx jest` → `node node_modules/jest/bin/jest.js`) を試行
2. 同コミット内で `src/providers/modal-provider.test.tsx` の `describe.skip` を `describe` に戻して効果検証
3. **連続 5 サイクル両 event グリーン** を観察してから本ブランチへマージ
4. グリーン継続を確認したら本 ADR の Status を `Accepted` に更新し file-level skip を解除
5. もし仮説 E も否決なら、仮説 G (`--maxWorkers=1`) を同じ手順で試行
6. 全候補が無効なら仮説 I (continue-on-error) を最終手段として導入

---

## 教訓

- **「1 サイクル両グリーン = 修正完了」は誤り**。本件で 3 回繰り返した判断ミス（commits `5cbf82a` / `9b77c59` / `c579642`）。次回からは **連続 5 サイクル**を判定基準にする
- **「assertion failure に見えない」failure は assertion ではない**。`--verbose` でも本文空なら React 19 act / runtime 層 / Jest reporter 互換性を疑う
- **「禁忌」ルール（`it.skip`）も状況次第で必要悪**。条件付き運用（期限・同等カバレッジ確認・追跡 doc）で適用
- **skip 戦略はテストファイル境界で止まらない**。同型 (RTL + userEvent + waitFor) のテストが他ファイルにあると flake が移動するため、infra layer の解消が本筋
- **同一 commit で push / pull_request の結果が分かれる場合は code でなく env を疑う**。次回からは workflow yml / runner 設定の修正を優先候補に
