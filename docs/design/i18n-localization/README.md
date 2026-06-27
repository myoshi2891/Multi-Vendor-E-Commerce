# i18n Localization — 全画面 日本語対応 設計書

> 全画面（51 page/layout・269 コンポーネント・Zod 128・toast/Error 等）を一貫した日本語表示にし、
> 文言を辞書へ集約する。将来 `en.json` 追加だけで英語版を足せる i18n 基盤を `next-intl` で導入する。
> 言語ポリシー: **日本語デフォルト + 将来 en 切替可**（ユーザー決定）。

---

## 読み順

1. [requirements.md](./requirements.md) — 何を満たすか（要件・受け入れ基準 AC・非機能）
2. [design.md](./design.md) — どう実装するか（中核。next-intl wiring・辞書構造・カテゴリ別移行・Zod i18n）
3. [tasks.md](./tasks.md) — どの順で作るか（フェーズ0〜4・TDD・**SKILL 呼び出し**・コミット粒度）
4. [PROGRESS.md](./PROGRESS.md) — 進捗 SSOT（Phase 単位の現在地）

---

## 背景（なぜやるか）

現状 i18n 未導入で UI 文字列は各 `.tsx` に直書き。さらに「英語ベース + 後付けの日本語機能」が混在した過渡期にあり、言語ポリシーが未確定（`src/lib/schemas.ts` 内で英語 L8 `"Category name is required."` と日本語 L658 `"メッセージを入力してください。"` が同居）。この混在を解消し、**辞書を SSOT** とした一貫運用へ移行する。

---

## 対象範囲（全画面）

| ルートグループ | 画面数 | 対象利用者 | コンポーネント規模 |
| --- | --- | --- | --- |
| `(store)` | 19 | 顧客 | `src/components/store/**` ~140 |
| `(fullscreen)` | 3 | 顧客/販売者 | — |
| `(auth)` | 3 | 認証 | Clerk 統合（要 localization オプション確認） |
| `dashboard/seller` | 13 | 販売者 | `src/components/dashboard/**` ~60 |
| `dashboard/admin` | 11 | 管理者 | （同上） |
| 共通 | — | — | `src/components/shared/**` ~11, `src/components/ui/**` 50 |

文字列カテゴリ別の総量（推定ユニーク 600〜800）:

| カテゴリ | 規模 | 主な所在 |
| --- | --- | --- |
| JSX テキスト直書き | ~100 | `src/components/store/**`, `dashboard/**` |
| 属性（placeholder/aria-label/alt/title） | 182 | 同上 |
| Zod メッセージ | 128 | `src/lib/schemas.ts` |
| Error（`throw new Error`） | 187（UI 表示 ~40） | `src/queries/**` |
| toast | 31 | 各 client コンポーネント |
| 定数 | ~50 | `src/constants/data.ts` |

---

## スコープ境界

|  | 含む | 含まない（後続・別 PR） |
| --- | --- | --- |
| **言語** | ja（デフォルト）+ en 切替**基盤** | en 翻訳の全文埋め（`en.json` は構造ミラー + 暫定値） |
| **方式** | next-intl「ルーティング無し（Cookie `NEXT_LOCALE`）」 | `[locale]` URL セグメント方式・多言語 SSG/hreflang |
| **対象文言** | UI 表示文字列（JSX/属性/toast/Zod/UI 表示 Error/定数/static 長文） | 内部ログ専用 Error・認可ガード固定文言（`tech.md` 規約で不変） |
| **フォーマット** | 文言の辞書化 | 多通貨・税計算（`product.md` でスコープ外） |
| **切替 UI** | Cookie 切替の最小ハンドラ（基盤として配置） | 言語切替ドロップダウンの本格 UX |

---

## 核心判断（詳細は design.md の判断章）

| 判断 | 結論 | 理由 |
| --- | --- | --- |
| routing 方式 | **ルーティング無し（Cookie `NEXT_LOCALE`）** | 全ページ既に `force-dynamic`（SSG 放棄済）→ `[locale]` の旨味なし。既存ルートグループ全移動の破壊を回避し、`middleware.ts`・force-dynamic 規約を温存 |
| ライブラリ | **next-intl** | App Router 標準・Server/Client 両対応・型拡張・将来切替が容易（ユーザー決定） |
| middleware | **既存に手を入れない** | ルーティング無し方式は next-intl 専用 middleware 不要。Clerk + `userCountry` Cookie をそのまま温存 |
| 既存日本語 | **辞書へ吸収（直書き禁止）** | inventory/messages/support/track-order の直書き日本語も辞書へ移し、SSOT 一元化（一貫性が最優先要件） |
| 認可ガード文言 | **キー化しない** | `"Unauthenticated." / "Only admins..."` は `tech.md` 規約で固定 |
| Zod 国際化 | **案A（ファクトリ）優先・テスト形態で最終判断** | スキーマはモジュール定数でロケール未確定。`t` 注入で解決（フェーズ2で詰める） |

---

## 規模感

- **新規**: `src/i18n/{request,config,get-locale}.ts`・`src/i18n/messages/{ja,en}.json`・`src/types/i18n.d.ts`。
- **基盤改修**: `next.config.mjs`（`withNextIntl`）・`src/app/layout.tsx`（Provider + `lang` 動的化 + `generateMetadata`）。
- **移行（パターン反復）**: `src/components/store/**`・`src/components/dashboard/**`・`src/app/(store)/**`・`src/app/dashboard/**`・`src/constants/data.ts`・`src/lib/schemas.ts`・toast 各所。
- **フェーズ**: 5（0 基盤 → 1 store → 2 forms+Zod → 3 dashboard → 4 仕上げ）。各フェーズ独立 PR。
- **品質ガード**: JSX 直書き検出 ESLint・`ja↔en` キー一致テスト・next-intl 型拡張で未定義キーを tsc 検出。

---

## 関連

- 技術選定 ADR: [`docs/architecture/decisions/00X-i18n-next-intl.md`](../../architecture/decisions/)（新規・本設計で作成）
- 規約: [`.claude/steering/tech.md`](../../../.claude/steering/tech.md)（force-dynamic / 認可ガード文言固定 / cookie パース）
- 規約: [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md)（TDD・コミット粒度・spec-sync）
- ドキュメント配置: [`.claude/steering/documentation-guide.md`](../../../.claude/steering/documentation-guide.md)（ADR 作成基準）
- 雛形: [`docs/design/track-order/`](../track-order/)（本設計書群の様式の流用元）
- 改修起点: [`src/app/layout.tsx`](../../../src/app/layout.tsx) / [`src/middleware.ts`](../../../src/middleware.ts) / [`next.config.mjs`](../../../next.config.mjs)
