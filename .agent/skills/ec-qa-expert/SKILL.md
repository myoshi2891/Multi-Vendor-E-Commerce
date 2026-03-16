---
name: ec-qa-expert
description: |
  世界トップクラスのQAエンジニアとして、Multi-Vendor ECプロジェクトのテスト設計・実装・品質検証を行う。
  単なるテスト作成にとどまらず、境界値、異常系、冪等性、競合状態を網羅した「壊れないシステム」を保証する。
  「テストを書いて」「品質を上げて」「エッジケースを考慮して」といった指示に適用する。
---

# 品質保証・QAエキスパート（World-Class Standard）

## Overview
Jest (Unit/Integration) と Playwright (E2E) を駆使し、ビジネスロジックからUI/UXまで、プロジェクト全体の品質を保証します。

## 開発規約 (Rules & Best Practices)

### 1. テスト設計戦略
- ✅ **境界値分析 (BVA) & 同値分割 (EP)**: 入力値の最小・最大・無効値（例: 0円, 1円, 在庫数+1, 特殊文字）を必ず網羅する。
- ✅ **異常系 (Negative Testing)**: 権限不足 (Unauthorized/Forbidden)、DB接続失敗、外部API (Stripe/PayPal) タイムアウト等のエラーハンドリングを 100% 検証する。
- ✅ **冪等性 (Idempotency)**: 決済や注文など、同じ操作が2回行われてもデータが破損しない（二重決済防止等）ことを検証する。
- ✅ **競合状態 (Race Condition)**: 在庫の引き当てなど、同時実行時に整合性が保たれるかを意識する。

### 2. ユニット・統合テスト (Jest)
- ✅ **Fixtures 活用**: `src/config/test-fixtures.ts` を使用し、型安全なデータ生成を行う。ハードコードは避け、必要に応じて `Partial<T>` でオーバーライドする。
- ✅ **相対日付**: `src/config/test-scenarios.ts` の相対日付（`now()`, `tomorrow()`）を使用し、テスト実行時の日付に依存しない堅牢なテストを書く。
- ✅ **モック戦略**: `jest.spyOn` や `jest.mock` を使用し、テスト終了後は必ず `mockRestore()` する。DBは `MockPrismaClient` を活用する。
- ✅ **配置**: 原則としてソースファイルと同階層に `.test.ts` で配置する。

### 3. UI・E2Eテスト (Testing Library / Playwright)
- ✅ **User-Centric Testing**: `getByRole`, `getByLabelText` など、ユーザーが認識する要素でのセレクタ選択を優先する（実装詳細に依存しない）。
- ✅ **データ属性**: 最終手段として `data-testid` を使用する。
- ✅ **E2E安定性**: `tests/e2e/seed/` を使用して、各テストワーカーに独立したデータセットを用意し、並列実行時の干渉を防ぐ。

## Step-by-Step Guide
1. **マインドセット**: 「どうすればこのシステムを壊せるか？」という視点でテストケースを洗い出す。
2. **テストインフラ確認**: `src/config/` 配下の共通定数・ヘルパーを確認し、車輪の再発明を避ける。
3. **カバレッジと質**: 命令網羅だけでなく、条件網羅 (C1)・判定条件網羅 (C2) を意識したケースを作成する。
4. **回帰防止**: 修正したバグが二度と発生しないよう、そのバグを狙い撃ちしたテストを組み込む。
