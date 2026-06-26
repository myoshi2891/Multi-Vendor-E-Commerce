# i18n Localization — タスク（tasks.md）

> どの順で作るか。各フェーズは独立 PR。`.claude/rules/02-tdd-step-commit.md`（TDD・コミット粒度・SKILL 起動）に従う。
> 要件は [requirements.md](./requirements.md)、設計は [design.md](./design.md)。

---

## SKILL 呼び出しルール（必須）

| 局面 | 起動する SKILL |
| --- | --- |
| テスト数・スイート数・スナップショット数が変動したフェーズ完了時 | `spec-sync-after-test`（dashboard 再生成 + 統計同期を同一コミットに含める） |
| コミット前（lint/tsc/test の 3 点） | `test-complete` |
| 仕様↔実装・規約浸透のドリフト確認（各フェーズ末） | `spec-sync-check` |
| 新規 server action（`setLocale`）の雛形 | `server-action-scaffold`（任意・パターン流用） |

---

## フェーズ0: 基盤（最初の PR）

> ゴール: next-intl を導入し、cart 1 画面をパイロット移行して疎通（AC-1,2,3）。

- [ ] **0-1** next-intl を Next.js 16 対応バージョンで追加し `package.json` にピン留め（`bun add next-intl@<ver>`）。`@clerk/localizations` も追加。
- [ ] **0-2** `src/i18n/config.ts`（locales/defaultLocale/normalizeLocale）を作成。
- [ ] **0-3** `src/i18n/request.ts`（getRequestConfig: Cookie → locale → messages）を作成。
- [ ] **0-4** `src/i18n/get-locale.ts` / `src/i18n/set-locale.ts` を作成。
- [ ] **0-5** `src/i18n/messages/ja.json` / `en.json` を骨格作成（`meta` + `common` + `cart` + `product` の最小キー）。
- [ ] **0-6** `src/types/i18n.d.ts`（next-intl 型拡張）を作成。
- [ ] **0-7** `next.config.mjs` を `withNextIntl` でラップ（images 保持）。
- [ ] **0-8** `src/app/layout.tsx`: `async` 化・`NextIntlClientProvider`・`<html lang={locale}>`・`generateMetadata`・`ClerkProvider localization={jaJP}`。
- [ ] **0-9** パイロット: cart 画面（`src/components/store/cart-page/**` + `src/app/(store)/cart/`）を `t()` へ移行。
- [ ] **0-10** キー一致テスト（`ja↔en`）の最小スクリプト/テストを追加（NFR-6）。
- [ ] **0-11** `test-complete` → コミット分割: ①基盤一式 ②cart パイロット ③キー一致テスト。
- [ ] **0-12** ADR `docs/architecture/decisions/00X-i18n-next-intl.md` 作成（routing 有無・next-intl vs 自前辞書の比較）。`tech.md` に「i18n 実装パターン」節を追記。README から ADR を参照。

**検証**: `bun run dev` で cart 日本語表示 → `NEXT_LOCALE=en`/`fr` 切替・フォールバック（AC-1,2,3）。`bunx tsc --noEmit`。

---

## フェーズ1: 顧客向け store（最大ボリューム・高優先）

> ゴール: `(store)` + `src/components/store/**`（~140）を辞書化。ドメイン単位で PR 分割。

- [ ] **1-1** `layout/`（header/footer/category-header/newsletter）— 19 ファイル。
- [ ] **1-2** `home/`（11）+ `cards/`（10）。
- [ ] **1-3** `product-page/`（23）。
- [ ] **1-4** `profile/`（17）+ `order-page/`（6）。
- [ ] **1-5** `shared/`（15）+ 残り（browse/compare/store-page/support/track-order）。
- [ ] **1-6** 各ドメインで toast 文字列も辞書化。既存日本語（messages/track-order）を辞書へ吸収（FR-6）。
- [ ] **1-7** ドメインごとに `test-complete` → コミット。スナップショット変動時 `spec-sync-after-test`。

**検証**: 各ドメイン完了時に grep で直書き残存ゼロ（AC-4）。

---

## フェーズ2: フォーム + Zod

> ゴール: フォーム文言・Zod・toast をロケール対応（FR-7・AC-5）。

- [ ] **2-1** Zod 移行方式を確定: `src/queries/*.test.ts` のメッセージ assert を grep → 案A（ファクトリ）/案B（キー）を決定（design §5）。
- [ ] **2-2** （Red）対象テストをキー/翻訳後文字列に書き換え、まず fail を 1 件確認。
- [ ] **2-3** （Green）`src/lib/schemas.ts` を選定案で改修。`validation.*` キーを `ja.json` へ。
- [ ] **2-4** `src/components/dashboard/forms`（16）+ `src/components/store/forms`（13）の placeholder/label/toast を辞書化。
- [ ] **2-5** RHF の `FormMessage` 表示が辞書値になることを確認。
- [ ] **2-6** `spec-sync-after-test`（テスト数変動）→ `test-complete` → コミット分割（テスト / schema / フォーム）。

**検証**: フォーム未入力 submit で ja バリデーション（AC-5）。`bun run test` green（AC-8）。

---

## フェーズ3: dashboard（seller / admin）

> ゴール: `dashboard/**` + `src/components/dashboard/**`（~60）+ サイドバー定数。

- [ ] **3-1** `src/constants/data.ts` の `label` を翻訳キーへ変更し、描画側で `t(label)`（design §4・0-7）。
- [ ] **3-2** `dashboard/seller/**`（13 page）+ `src/components/dashboard/seller/**`（16）。既存日本語（inventory/stats/stock）を辞書へ吸収。
- [ ] **3-3** `dashboard/admin/**`（11 page）+ `src/components/dashboard/admin/**`（4）+ `forms` 残り。
- [ ] **3-4** `shared/`（テーブルセル/概要カード）11。
- [ ] **3-5** `test-complete` → コミット分割（定数 / seller / admin）。

**検証**: サイドバー・統計・在庫バッジが辞書経由 ja（AC-4）。

---

## フェーズ4: 仕上げ

> ゴール: 残存文言の完全吸収・品質ガード昇格。

- [ ] **4-1** `static/` 長文を `src/i18n/messages/ja/static-*.json` へ分割（design §6）。
- [ ] **4-2** `generateMetadata` を各 page で辞書化（FR-9・AC-9）。
- [ ] **4-3** `src/queries/**` の UI 表示 Error をキー化 → 表示境界で `t()`。認可ガード固定文言は据え置き（0-5）。
- [ ] **4-4** ESLint「JSX 直書き検出」を移行完了ディレクトリで **error 昇格**（NFR-5）。
- [ ] **4-5** 全体 grep で直書き英語/日本語の残存ゼロを確認。`en.json` 構造ミラー完成。
- [ ] **4-6** `spec-sync-check` で仕様↔実装・規約浸透のドリフト最終確認。

**検証**: [design.md §10](./design.md) の全手順。`bun run build` 成功。

---

## コミット粒度の原則（`.claude/rules/02-tdd-step-commit.md`）

- 「テストコード」「実装」「ドキュメント同期」「ESLint ルール整備」は**別コミット**。
- 各コミットは単独で `bunx tsc --noEmit` が通る状態を維持。
- テスト統計が動いたら SSOT は `QA_HANDOFF.md`。`spec-sync-after-test` で `coverage-dashboard.html` 再生成を同一コミットに含める。

---

## 完了の定義（DoD）

- [ ] AC-1〜AC-9 をすべて満たす。
- [ ] NFR-1〜NFR-8 を満たす（特に middleware 不変・型安全・キー一致・直書きゼロ）。
- [ ] ADR 作成 + `tech.md` 追記済み。
- [ ] `bun run lint` / `bunx tsc --noEmit` / `bun run test` / `bunx playwright test` / `bun run build` がすべて green。
