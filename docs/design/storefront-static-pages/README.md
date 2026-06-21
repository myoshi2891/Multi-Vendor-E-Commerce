# Storefront Static Pages — 設計書

> 静的コンテンツ画面群（`/about` / `/legal` / `/faq`+`/faqs` / `/customer-service` / `/product-support`）。
> DB・フォームを持たない server component で、コンテンツは TSX 定数 + 共有レイアウト部品で構成する。
> 出典: [`docs/unimplemented-screens-plan.md`](../../unimplemented-screens-plan.md) 「D. 静的ページ・補助画面・カスタマーサービス」優先度=低〜中。

---

## 読み順

1. [requirements.md](./requirements.md) — 何を満たすか（要件・受け入れ基準 AC・非機能）
2. [design.md](./design.md) — どう実装するか（中核。共有レイアウト・各ページ・リンク配線・影響箇所）
3. [tasks.md](./tasks.md) — どの順で作るか（TDD フェーズ・**SKILL 呼び出し**・コミット粒度）
4. [PROGRESS.md](./PROGRESS.md) — 進捗 SSOT（Phase 単位の現在地）

---

## 対象画面（5 画面）

| 画面                                              | ルート                                            | 現状リンク                     | 優先度 | 種別                       |
| ------------------------------------------------- | ------------------------------------------------- | ------------------------------ | ------ | -------------------------- |
| About（運営会社情報）                             | `/about`                                          | footer 配線済                  | 低     | 静的本文                   |
| Legal & Privacy（利用規約・プライバシー・特商法） | `/legal`                                          | user-menu `""`                 | 中     | 静的本文（複数規約）       |
| FAQ / FAQs（よくある質問）                        | `/faqs`（正規）・`/faq`→redirect                  | footer に両方あり              | 低     | 静的 Q&A                   |
| Customer Service（サポート総合ポータル）          | `/customer-service`（= user-menu「Help Center」） | footer 配線済 / user-menu `""` | 低     | ハブ（他画面へのリンク集） |
| Product Support（購入後サポート情報）             | `/product-support`                                | footer 配線済                  | 低     | 静的本文                   |

---

## スコープ境界

|                      | 含む                                                                | 含まない（後続・別設計書）                           |
| -------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| **コンテンツ**       | 静的本文・Q&A・規約（プレースホルダ文面で可、文章は運営が後日差替） | CMS / MDX 動的編集                                   |
| **データ**           | なし（Prisma 非依存）                                               | DB 保存・検索インデックス                            |
| **インタラクション** | FAQ のクライアント側フィルタ（任意・MVP は静的展開）                | フォーム送信（→ [support-forms](../support-forms/)） |
| **導線**             | footer 配線済の確認 + user-menu 空文字リンクの配線修正              | フッター/ヘッダーの再設計                            |

---

## 核心判断（詳細は design.md の判断章）

| 判断                        | 結論                                              | 理由                                                                                                                                                |
| --------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| コンテンツ源                | **TSX 定数配列 + 共有レイアウト部品**             | MDX ツール導入不要で Sonnet 実装が容易。`any` 不要・型安全。文面は後日差替前提のプレースホルダ                                                      |
| `/faq` と `/faqs` の重複    | **`/faqs` を正規・`/faq` は `redirect("/faqs")`** | footer に両リンクが存在（[links.tsx:66-68, 90-93](../../../src/components/store/layout/footer/links.tsx#L66)）。二重メンテを避け 1 実体に集約       |
| Customer Service の位置付け | **ハブ（ポータル）画面**                          | 他のサポート画面（contact/returns/faqs/track-order/product-support）への入口。user-menu「Help Center」をここへ配線                                  |
| `force-dynamic`             | **不要（付与しない）**                            | `src/queries/*` 経由の Prisma 呼び出しが無い（[tech.md「DB 依存ページの動的レンダリング規約」](../../../.claude/steering/tech.md)の対象外）。SSG 可 |
| 認可                        | **不要（全て公開）**                              | middleware の保護対象は `/dashboard*` `/checkout` `/profile*` のみ（[middleware.ts:6-12](../../../src/middleware.ts#L6)）                           |

---

## 規模感

- **新規ファイル**: ページ 5（+ `/faq` redirect 1）+ 共有レイアウト部品 1 + コンテンツ定数 5。
- **変更ファイル**: 1（`user-menu.tsx` の Help Center / Legal & Privacy 配線修正）。
- **server action / migration**: なし。
- **テスト**: RTL コンポーネントテスト（各ページ描画 + user-menu リンク回帰 + `/faq` redirect）。
- **フェーズ**: 単一フェーズ（破壊的変更なし・独立追加）。

---

## 関連

- 規約: [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md)（TDD・コミット粒度・spec-sync）
- 姉妹設計書: [`docs/design/support-forms/`](../support-forms/)（contact/returns/dispute/report — 本ポータルからの遷移先）
- 姉妹設計書: [`docs/design/track-order/`](../track-order/)（customer-service ポータルからの遷移先）
- 雛形: [`docs/design/profile-settings/`](../profile-settings/)（リンク回帰テスト・単一フェーズ構成の流用元）
