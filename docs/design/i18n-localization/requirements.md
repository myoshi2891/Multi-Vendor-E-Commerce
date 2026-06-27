# i18n Localization — 要件（requirements.md）

> 何を満たすか。受け入れ基準(AC)は実装・テストで検証可能な粒度で記述する。
> 設計は [design.md](./design.md)、手順は [tasks.md](./tasks.md)。

---

## 1. 機能要件（FR）

| ID | 要件 |
| --- | --- |
| FR-1 | 全画面の UI 表示文字列を辞書（`src/i18n/messages/<locale>.json`）へ集約し、コンポーネントは `t('key')` 経由で参照する |
| FR-2 | デフォルトロケールは `ja`。ロケールは Cookie `NEXT_LOCALE` で決定し、未設定・不正値は `ja` にフォールバックする |
| FR-3 | `<html lang>` は現在のロケールに連動する（固定 `"en"` を廃止） |
| FR-4 | 将来 `en.json` に翻訳を埋めるだけで英語表示へ切替できる（キー構造は `ja.json` とミラー） |
| FR-5 | Cookie `NEXT_LOCALE` を切り替えると、再読込で該当ロケールの辞書値が表示される（切替の最小ハンドラを提供） |
| FR-6 | 既に日本語直書きされている新機能（inventory / messages / support / track-order）の文言も辞書へ移し、直書きを残さない |
| FR-7 | Zod バリデーションメッセージをロケール対応にする（フォームのエラー表示が辞書値になる） |
| FR-8 | UI に表示される Server Action のエラーは辞書キー経由で翻訳する。内部ログ専用・認可ガード固定文言は対象外 |
| FR-9 | metadata（`title` / `description`）をロケール対応にする |

---

## 2. 受け入れ基準（AC）

| ID | シナリオ | 期待結果 | 対応 FR |
| --- | --- | --- | --- |
| AC-1 | 既定状態（Cookie 無し）でストアフロントを開く | 全文言が日本語で表示され、`<html lang="ja">` | FR-1,2,3 |
| AC-2 | Cookie `NEXT_LOCALE=en` をセットして再読込 | 該当キーが `en.json` の値で表示され、`<html lang="en">` | FR-4,5 |
| AC-3 | `NEXT_LOCALE=fr`（未対応値）をセット | `ja` にフォールバック表示（クラッシュしない） | FR-2 |
| AC-4 | 移行完了ディレクトリを grep | JSX 直書きテキスト・直書き日本語が残っていない | FR-1,6 |
| AC-5 | フォームを未入力で submit | バリデーションエラーが辞書値（ja）で表示される | FR-7 |
| AC-6 | `ja.json` のキーを 1 つ削除して tsc/テスト実行 | 型エラー or キー一致テストが fail する（欠落を検出） | NFR-3 |
| AC-7 | `t('存在しないキー')` を書いて tsc 実行 | 型エラーになる（未定義キー検出） | NFR-3 |
| AC-8 | 既存ユニット/E2E（`src/queries/*.test.ts`, `tests/e2e/*`） | 文字列 assert がキー/翻訳後文字列に追随し green | NFR-4 |
| AC-9 | metadata 確認 | `<title>` がロケールに応じた辞書値 | FR-9 |

---

## 3. 非機能要件（NFR）

| ID | 区分 | 要件 |
| --- | --- | --- |
| NFR-1 | 互換性 | 既存 `src/middleware.ts`（Clerk + `userCountry` Cookie）・全ページの `force-dynamic` 規約・既存ルート構造を変更しない |
| NFR-2 | 性能 | ルーティング無し方式で追加 middleware を持たない。辞書はロケール単位で読み込む（全ロケール同梱を避ける） |
| NFR-3 | 型安全 | next-intl 型拡張で `t()` のキーを静的型付け。未定義キーは `bunx tsc --noEmit` で検出（`any` 禁止・`CLAUDE.md` 準拠） |
| NFR-4 | 回帰防止 | テスト数・スナップショットが変動する場合 `spec-sync-after-test` を起動。既存テストのメッセージ assert を追随 |
| NFR-5 | 流出防止 | JSX 直書きテキストを ESLint で検出（段階導入: 警告 → 移行完了ディレクトリで error 昇格） |
| NFR-6 | 辞書整合 | `ja.json` ↔ `en.json` のキー集合一致を CI/テストで検証（欠落 = fail） |
| NFR-7 | 規約整合 | 認可ガード固定文言（`"Unauthenticated."` 等）を変更しない。`NEXT_LOCALE` は単純文字列 Cookie のため `parseUserCountryCookie` の対象外だが、`locales` allowlist で検証 |
| NFR-8 | 保守性 | 辞書を SSOT とし、文言の二重管理（直書き + 辞書）を禁止 |

---

## 4. スコープ外（本設計では扱わない）

- `en.json` の翻訳全文埋め（構造ミラー + 暫定値までが本スコープ）。
- `[locale]` URL セグメント方式・多言語 SSG・hreflang。
- 言語切替ドロップダウンの本格 UX（Cookie 切替の最小ハンドラのみ）。
- 多通貨・税計算・日付ローカライズの本格化（`product.md` スコープ外。数値/日付は必要に応じ `Intl`/next-intl format を利用する程度）。

---

## 5. 制約・前提

- Next.js 16（async request APIs）・Clerk v7・Bun。next-intl は Next.js 16 対応バージョンをピン留め（実装時確認）。
- Clerk の認証 UI（sign-in/sign-up）は Clerk 側の `localization` プロパティで日本語化する（辞書対象外・design.md で方式を記す）。
- 全ページ `force-dynamic` のため、ロケール解決を SSR リクエスト毎に行ってよい（性能上の SSG 制約なし）。
