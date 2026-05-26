# B1+ shadcn/ui Snapshot Tests Expansion Plan

> **Status**: Plan approved 2026-05-26 — Sprint 1 完了（2026-05-26、Tier 1 前半 10 プリミティブ snapshot 追加 / `b55e177`〜`66fb8d5`）。残り 30 プリミティブは Sprint 2-4 で段階実行中。
> **Owner**: project team
> **Related**: [QA_HANDOFF.md §3.3 NA-NS-01](./QA_HANDOFF.md), [COVERAGE_REPORT.md §3](./COVERAGE_REPORT.md), [TESTING_DESIGN.md "shadcn/ui Snapshot テスト"](./TESTING_DESIGN.md), [.claude/rules/02-tdd-step-commit.md](../../.claude/rules/02-tdd-step-commit.md)

---

## Context

**問題**: 現在 [`tests/component/ui/`](../../tests/component/ui/) の snapshot テストは B1 MVP の **9 プリミティブ / 40 snapshot** しか存在せず、[`src/components/ui/`](../../src/components/ui/) 配下にある残り 40 プリミティブは Tailwind/Radix の意図しないクラス変更を検知できない盲点となっている。

**動機**:
- B1+ タスク (`NA-NS-01`) は [`scripts/coverage-dashboard/render-html.ts`](../../scripts/coverage-dashboard/render-html.ts) の `NEXT_ACTIONS` および `QA_HANDOFF.md §3.3` に medium priority で既登録。
- B1 MVP (2026-05-23 完了) で確立した規約 — `/** @jest-environment jsdom */` + `expect(container.firstChild).toMatchSnapshot()` — は機械的に複製可能。
- Tailwind v4 / Radix UI のマイナー更新時の退行検知範囲を **9/49 → 49/49** へ拡大する。

**想定成果**:
- `tests/component/ui/*.test.tsx` が **9 → 49 ファイル**に拡張
- snapshot 総数は **~40 → ~120**（Tier 1=3-4/file, Tier 2=4-5/file, Tier 3=2-3/file 想定）
- `docs/coverage-dashboard.html` の §03 Next Actions から `NA-NS-01` を削除予定（最終コミットで実施、= 完了アーカイブへ移行）

---

## Scope（実装スコープ）

| 項目 | 内容 |
|---|---|
| **対象** | 残り 40 プリミティブすべて（Tier 1=21 / Tier 2=8 / Tier 3=7 / 補助=4） |
| **Tier 3 戦略** | **デフォルト状態のみ**スナップショット取得（form は空フォーム、calendar は固定日付、carousel は初期 slide、command は閉状態）。状態バリエーションは将来 B1++ として分離 |
| **実装ペース** | Sprint 単位（4 Sprint）で段階的に実装。各 Sprint 末で `spec-sync-after-test` を起動 |

---

## Tier 分類とコミットマップ

### Tier 1: 単純プリミティブ（21 個 / 推定 21 commits）

外部 lib 依存なし。基本パターン（default / variant / className merge / asChild [対応する場合]）のみテスト。**原則 1 ファイル 1 commit**。

| # | Primitive | Source | 想定 snapshot 数 |
|---|---|---|---|
| 1 | alert | [src/components/ui/alert.tsx](../../src/components/ui/alert.tsx) | 3 (default / destructive / with title) |
| 2 | alert-dialog | [src/components/ui/alert-dialog.tsx](../../src/components/ui/alert-dialog.tsx) | 3 (closed / defaultOpen / asChild trigger) |
| 3 | aspect-ratio | [src/components/ui/aspect-ratio.tsx](../../src/components/ui/aspect-ratio.tsx) | 2 (16:9 / 1:1) |
| 4 | avatar | [src/components/ui/avatar.tsx](../../src/components/ui/avatar.tsx) | 3 (with image / fallback / size variants) |
| 5 | breadcrumb | [src/components/ui/breadcrumb.tsx](../../src/components/ui/breadcrumb.tsx) | 3 (basic / with separator / ellipsis) |
| 6 | checkbox | [src/components/ui/checkbox.tsx](../../src/components/ui/checkbox.tsx) | 3 (unchecked / checked / disabled) |
| 7 | collapsible | [src/components/ui/collapsible.tsx](../../src/components/ui/collapsible.tsx) | 2 (closed / open) |
| 8 | hover-card | [src/components/ui/hover-card.tsx](../../src/components/ui/hover-card.tsx) | 2 (closed / defaultOpen) |
| 9 | input-otp | [src/components/ui/input-otp.tsx](../../src/components/ui/input-otp.tsx) | 2 (empty / partial value) |
| 10 | pagination | [src/components/ui/pagination.tsx](../../src/components/ui/pagination.tsx) | 3 (basic / with ellipsis / disabled) |
| 11 | popover | [src/components/ui/popover.tsx](../../src/components/ui/popover.tsx) | 2 (closed / defaultOpen) |
| 12 | progress | [src/components/ui/progress.tsx](../../src/components/ui/progress.tsx) | 3 (0% / 50% / 100%) |
| 13 | radio-group | [src/components/ui/radio-group.tsx](../../src/components/ui/radio-group.tsx) | 3 (default / with selection / disabled) |
| 14 | resizable | [src/components/ui/resizable.tsx](../../src/components/ui/resizable.tsx) | 2 (horizontal / vertical) |
| 15 | scroll-area | [src/components/ui/scroll-area.tsx](../../src/components/ui/scroll-area.tsx) | 2 (vertical / horizontal) |
| 16 | separator | [src/components/ui/separator.tsx](../../src/components/ui/separator.tsx) | 2 (horizontal / vertical) |
| 17 | slider | [src/components/ui/slider.tsx](../../src/components/ui/slider.tsx) | 3 (default / range / disabled) |
| 18 | switch | [src/components/ui/switch.tsx](../../src/components/ui/switch.tsx) | 3 (unchecked / checked / disabled) |
| 19 | toggle | [src/components/ui/toggle.tsx](../../src/components/ui/toggle.tsx) | 3 (off / on / variants) |
| 20 | tooltip | [src/components/ui/tooltip.tsx](../../src/components/ui/tooltip.tsx) | 2 (closed / defaultOpen) |
| 21 | chart | [src/components/ui/chart.tsx](../../src/components/ui/chart.tsx) | 2 (basic bar / line) |

### Tier 2: Compound Radix プリミティブ（8 個）

`@radix-ui/react-menu` 等を共有。**同梱コミットの候補**だが、[.claude/rules/02-tdd-step-commit.md](../../.claude/rules/02-tdd-step-commit.md) の閾値（3 ファイル ≤ 200 行 + import 共有 50%）を満たす場合のみ。

| Group | Primitives | Commit 戦略 |
|---|---|---|
| Menu family | [dropdown-menu](../../src/components/ui/dropdown-menu.tsx), [context-menu](../../src/components/ui/context-menu.tsx), [menubar](../../src/components/ui/menubar.tsx) | **同梱コミット候補**（3 ファイル / 同じ Radix Menu API / asChild & defaultOpen パターン共有）。閾値検証して 200 行未満なら 1 commit、超えたら分離 |
| Sheet family | [sheet](../../src/components/ui/sheet.tsx), [drawer](../../src/components/ui/drawer.tsx) | **同梱コミット候補**（2 ファイル / Dialog バリエーション） |
| Tabs / Toggle | [tabs](../../src/components/ui/tabs.tsx), [toggle-group](../../src/components/ui/toggle-group.tsx) | 個別 1 ファイル 1 commit |
| Table | [table](../../src/components/ui/table.tsx) | 個別 1 commit（compound: Table/THead/TBody/TR/TD） |

### Tier 3: 外部 lib 依存（7 個 / 必ず 1 ファイル 1 commit）

各プリミティブで個別の lib mock / setup を要するため**同梱コミット禁止**。

| # | Primitive | 外部 lib | デフォルト snapshot 設計 |
|---|---|---|---|
| 22 | form | `react-hook-form` | `useForm()` ラッパーで空フォーム + `FormField` 1 個 |
| 23 | calendar | `react-day-picker` | `selected={new Date("2026-01-15")}` 固定 |
| 24 | carousel | `embla-carousel-react` | 3 slide 初期状態（slide 0 アクティブ） |
| 25 | command | `cmdk` | 閉状態 + 開状態（defaultOpen）の 2 種 |
| 26 | sidebar | 内部 compound（Sheet/Tooltip/Button/Input/Separator/Skeleton） | `<SidebarProvider><Sidebar>...</Sidebar></SidebarProvider>` 最小構成 |
| 27 | navigation-menu | `@radix-ui/react-navigation-menu` | 単一 root + 子 NavigationMenuItem |
| 28 | sonner | `sonner` | `<Toaster />` 単独（toast 発火なし） |

### 補助コンポーネント（4 個 / 各 1 commit）

| Primitive | 備考 |
|---|---|
| accordion | Tier 1 寄り（Radix Accordion 単独） |
| toast | 既存 toaster との関連で個別テスト |
| toaster | toast の Provider |
| data-table | TanStack Table ラッパー想定 — 既存実装を読んで判断 |

**合計コミット数の目安**: Tier 1 = 21, Tier 2 = 5–7（グルーピング次第）, Tier 3 = 7, 補助 = 4, ドキュメント同期 = 各 Sprint 末で 1 + 最終 archive 1。**合計 ~40–44 commits**。

---

## 標準テストテンプレート

既存 [button.test.tsx](../../tests/component/ui/button.test.tsx) と [card.test.tsx](../../tests/component/ui/card.test.tsx) を踏襲。

```typescript
/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Foo, FooBar } from "@/components/ui/foo";

describe("Foo (snapshot)", () => {
    it("renders default", () => {
        const { container } = render(<Foo>content</Foo>);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("variant=destructive renders", () => {
        const { container } = render(<Foo variant="destructive">content</Foo>);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("merges className", () => {
        const { container } = render(<Foo className="custom">content</Foo>);
        expect(container.firstChild).toMatchSnapshot();
    });
});
```

**Portal 系**（alert-dialog / popover / hover-card / tooltip / dropdown-menu / context-menu / menubar / sheet / drawer / command / sonner）: `defaultOpen` プロップで portal を強制マウントし、`screen.getByRole(...)` で **コンポーネントが出力する styled 要素だけ**をスナップショット対象にする。`document.body` 全体は Radix の focus-guard span / overlay div / scroll-lock 属性などコンポーネント外の副作用を取り込み flake 源になるため使用禁止（[`tooltip.test.tsx`](../../tests/component/ui/tooltip.test.tsx) / [`popover.test.tsx`](../../tests/component/ui/popover.test.tsx) / [`dialog.test.tsx`](../../tests/component/ui/dialog.test.tsx) 参照）。

```typescript
import { render, screen } from "@testing-library/react";

// パターン A: styled content 自体が role を持つ場合（popover / dialog / alert-dialog / sheet / drawer 等）
it("renders PopoverContent in defaultOpen state", () => {
    render(
        <Popover defaultOpen>
            <PopoverTrigger>Open</PopoverTrigger>
            <PopoverContent>Popover body</PopoverContent>
        </Popover>
    );
    // PopoverContent は role="dialog" の styled div として描画される。
    expect(screen.getByRole("dialog")).toMatchSnapshot();
});

// パターン B: role が ARIA 専用の隠し span に付いている場合（tooltip）
it("renders TooltipContent in defaultOpen state", () => {
    render(
        <TooltipProvider>
            <Tooltip defaultOpen>
                <TooltipTrigger>Hover</TooltipTrigger>
                <TooltipContent>Tip body</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
    // role="tooltip" の ARIA span から親要素 (styled TooltipContent div) を取得する。
    expect(screen.getByRole("tooltip").parentElement).toMatchSnapshot();
});
```

**role の選び方**: 各プリミティブのソース (`src/components/ui/<name>.tsx`) で Radix の `Content` 要素が出力する role を確認する。多くは `dialog` / `menu` / `tooltip` のいずれか。role が styled div ではなく隠し span にしか付かないケース（tooltip 系）はパターン B を使う。

---

## 各コミットの作業フロー

### A. テスト追加コミット（1 commit / プリミティブ）

1. `tests/component/ui/<primitive>.test.tsx` を作成（標準テンプレート）
2. `bun run test -- --testPathPattern=tests/component/ui/<primitive>` で実行 → snapshot 自動生成
3. 生成された `tests/component/ui/__snapshots__/<primitive>.test.tsx.snap` を git add
4. `bunx tsc --noEmit` を通すこと（[.claude/rules/02-tdd-step-commit.md](../../.claude/rules/02-tdd-step-commit.md) MUST 要件）
5. コミットメッセージ例: `test(ui): add <primitive> snapshot tests (B1+)`

### B. `spec-sync-after-test` 起動（各 Sprint 末で**必ず**実行）

複数プリミティブを連続コミットした後、論理単位（Sprint 完了）の区切りで以下を実行:

1. `Skill spec-sync-after-test` 起動 → 以下 5 ファイルを同期:
   - [QA_HANDOFF.md](./QA_HANDOFF.md)（SSOT: テスト数 / suite 数 / snapshot 数）
   - [../../specs/multi-vendor-ecommerce/07-testing.md](../../specs/multi-vendor-ecommerce/07-testing.md)
   - [COVERAGE_REPORT.md](./COVERAGE_REPORT.md)
   - [../PROGRESS.md](../PROGRESS.md)
   - `docs/coverage-dashboard.html` ← `bun run coverage:dashboard` で再生成（手動編集禁止）
2. 上記 5 ファイルを**単一の同期コミット**にまとめる: `docs: sync test stats after B1+ Tier <n> expansion`

### C. 完了時の `NEXT_ACTIONS` / `QA_HANDOFF.md §3.3` 削除コミット

全 40 プリミティブ完了の最終コミットで:

1. [`scripts/coverage-dashboard/render-html.ts`](../../scripts/coverage-dashboard/render-html.ts) の `NEXT_ACTIONS` から `NA-NS-01` を削除
2. [`QA_HANDOFF.md §3.3`](./QA_HANDOFF.md) の対応プロンプトを削除（**両者は二重 SSOT** であり同一コミット内で同期必須 — [02-tdd-step-commit.md](../../.claude/rules/02-tdd-step-commit.md) MUST 規定）
3. [`COVERAGE_REPORT.md §3`](./COVERAGE_REPORT.md) の B1+ 行に完了日 / commit hash を追記してアーカイブ化
4. `bun run coverage:dashboard` 再実行 → HTML 反映
5. 本ファイル ([B1_SNAPSHOT_EXPANSION_PLAN.md](./B1_SNAPSHOT_EXPANSION_PLAN.md)) のステータスを `Status: Completed YYYY-MM-DD` に更新
6. コミット例: `docs: archive NA-NS-01 (B1+ shadcn snapshot expansion complete)`

---

## Sprint 計画（推奨実装順序）

### Sprint 1: Tier 1 前半（10 commits + sync）

aspect-ratio → separator → progress → switch → checkbox → radio-group → slider → toggle → tooltip → popover → **spec-sync**

理由: 外部依存ゼロ・snapshot 数少（2-3）・Radix 単純コンポーネントから着手し、パターン定着を狙う。

### Sprint 2: Tier 1 後半（11 commits + sync）

alert → alert-dialog → avatar → breadcrumb → collapsible → hover-card → input-otp → pagination → resizable → scroll-area → chart → **spec-sync**

### Sprint 3: Tier 2（5-7 commits + sync）

Menu family（同梱 or 分離判断）→ Sheet family（同梱 or 分離判断）→ tabs → toggle-group → table → **spec-sync**

判断基準: 各 family の合計行数を `wc -l` で計測し、200 行 + import 共有 50% の閾値超過時は分離。

### Sprint 4: Tier 3 + 補助（11 commits + sync + archive）

form → calendar → carousel → command → sidebar → navigation-menu → sonner → accordion → toast → toaster → data-table → **spec-sync** → **NA-NS-01 archive**

各 Sprint は独立した PR として提出可能（[.claude/workflows/submit-pr.md](../../.claude/workflows/submit-pr.md) 準拠）。

---

## Critical Files

### 新規作成
- `tests/component/ui/<primitive>.test.tsx` × 40
- `tests/component/ui/__snapshots__/<primitive>.test.tsx.snap` × 40（jest 自動生成）

### 修正
- [`scripts/coverage-dashboard/render-html.ts`](../../scripts/coverage-dashboard/render-html.ts) — `NEXT_ACTIONS` から `NA-NS-01` を削除予定（最終コミットで実施）
- [`QA_HANDOFF.md`](./QA_HANDOFF.md) — テスト統計 + §3.3 同期
- [`COVERAGE_REPORT.md`](./COVERAGE_REPORT.md) — B1+ アーカイブ行追加
- [`07-testing.md`](../../specs/multi-vendor-ecommerce/07-testing.md) — テスト数
- [`PROGRESS.md`](../PROGRESS.md) — 統計同期
- `docs/coverage-dashboard.html` — `bun run coverage:dashboard` で再生成

### 参照（変更不要）
- [`button.test.tsx`](../../tests/component/ui/button.test.tsx) — テンプレート参考（variants / asChild パターン）
- [`dialog.test.tsx`](../../tests/component/ui/dialog.test.tsx) — Portal 系参考
- [`card.test.tsx`](../../tests/component/ui/card.test.tsx) — compound component 参考
- [`TESTING_DESIGN.md`](./TESTING_DESIGN.md) "shadcn/ui Snapshot テスト" セクション
- [`tests-setup/jest.setup.ts`](../../tests-setup/jest.setup.ts) — グローバル setup（変更不要）

---

## 既存パターンの再利用方針

- **既存 snapshot テストの import / describe / render パターンをそのまま流用** — 新規ヘルパーは作らない（[CLAUDE.md](../../CLAUDE.md) "投機的な編集禁止" / "外科的なパッチを優先" 方針）
- **`jest.setup.ts` 変更不要**。MSW / jest-dom は既にセットアップ済み
- **Tier 3 form テスト**: 既存 [src/queries/*.test.ts](../../src/queries) の react-hook-form モックパターンは server action 用なので不適。`render(<FormProvider>...<form>)` の最小ラッパーを各テストファイル内で local に定義（共有ヘルパー化は YAGNI）

---

## Verification

各 Sprint 完了後に以下を確認:

```bash
# 1. ユニットテスト全件パス
bun run test

# 2. 型チェック
bunx tsc --noEmit

# 3. Lint
bun run lint

# 4. snapshot 差分なし（CI 偽陽性検出）
bun run test -- --ci

# 5. カバレッジダッシュボード再生成 & 差分目視
bun run coverage:dashboard
git diff docs/coverage-dashboard.html

# 6. 統計同期確認: QA_HANDOFF.md の Jest snapshot 数が __snapshots__ の実 snapshot エントリー数と一致
#    （ls | wc -l はファイル数しか数えないため、1 ファイル内に複数 snapshot がある実態と乖離する）
ACTUAL=$(grep -rhE "^exports\[" tests/component/ui/__snapshots__/ | wc -l | tr -d ' ')
REPORTED=$(grep -E "Jest スナップショット" docs/testing/QA_HANDOFF.md | grep -oE "[0-9]+" | head -n 1)
echo "Actual snapshot entries: $ACTUAL"
echo "Reported in QA_HANDOFF.md: $REPORTED"
[ "$ACTUAL" = "$REPORTED" ] && echo "OK: synced" || echo "MISMATCH: update QA_HANDOFF.md"
```

### 最終（Sprint 4）完了条件
- [ ] `tests/component/ui/*.test.tsx` が 49 ファイル
- [ ] `bun run test` グリーン、`bunx tsc --noEmit` エラーゼロ
- [ ] `render-html.ts` `NEXT_ACTIONS` から `NA-NS-01` 削除済み
- [ ] `QA_HANDOFF.md §3.3` から `NA-NS-01` プロンプト削除済み
- [ ] `COVERAGE_REPORT.md §3` に B1+ 完了アーカイブ行追加済み
- [ ] `docs/coverage-dashboard.html` 再生成済み
- [ ] 本計画書のステータスを `Completed YYYY-MM-DD` に更新

---

## リスクと緩和

| リスク | 緩和策 |
|---|---|
| Tier 3（form/carousel/sidebar）で予期しない provider 要求が露呈 | デフォルト状態 only の方針を堅持。エラー時は当該プリミティブを Sprint 4 末尾に移動し、必要なら個別 ADR 化 |
| snapshot 大量更新により PR レビュー困難 | Sprint 単位で PR 分割（最大 10-15 commits / PR）。`__snapshots__/*.snap` は機械的に検証可能 |
| `render-html.ts` と `QA_HANDOFF.md §3.3` の二重 SSOT drift | 各 Sprint 末で同一コミット内更新を厳守（[02-tdd-step-commit.md](../../.claude/rules/02-tdd-step-commit.md) MUST 規定） |
| Tailwind クラス順序の非決定性で snapshot が flaky 化 | 既存 9 ファイルは安定運用中（同 Tailwind 設定）。flaky 発生時は ESLint `tailwindcss/classnames-order` で序列化を強制（既に warn 設定済み） |
| Sprint 跨ぎセッションで文脈喪失 | 各 Sprint 末で本計画書 + `QA_HANDOFF.md §3.3` の進捗チェックボックスを更新 |
