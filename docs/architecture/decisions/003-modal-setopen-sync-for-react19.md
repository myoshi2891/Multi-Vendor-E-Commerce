# 003. `ModalProvider.setOpen` を同期関数化（React 19 strict act mode 対応）

- **Status**: Accepted
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

- **フレーク解消**: commit `9b77c59` 以降 CI 両 event 安定グリーン
- **設計の明瞭化**: `async` だが await されない関数の anti-pattern を解消
- **型シグネチャの正直化**: 戻り値が実際には消費されないことを `void` で明示
- **テストの脱フレーク**: ローカルと CI の挙動差が解消（floating promise 経路がなくなった）
- **将来の Provider 設計指針**: 「Context Provider の setter が consumer に await されない場合は同期関数で実装する」というパターンを [`.claude/steering/tech.md`](../../../.claude/steering/tech.md) に追加

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
- [x] CI 両 event グリーン確認（commit `9b77c59`）
- [x] [`.claude/skills/ci-flake-diagnosis/SKILL.md`](../../../.claude/skills/ci-flake-diagnosis/SKILL.md) Rationale に本件の教訓を追記
- [x] [`.claude/steering/tech.md`](../../../.claude/steering/tech.md) に「Context Provider setter 同期化パターン」を追加
- [x] [ADR-002](002-ci-jest-verbose-flag.md) の誤認部分（`--verbose` で解消した云々）を訂正

**関連コミット**:
- `9b77c59` — 本決定の実装（`refactor(providers/modal): change setOpen to sync...`）

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
