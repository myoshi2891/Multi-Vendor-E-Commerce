# Storefront Static Pages — 要件（requirements.md）

> 記法: EARS 風（`When/While/The system shall`）。受け入れ基準は `AC-SP<n>`。
> 設計は [design.md](./design.md)、実装手順は [tasks.md](./tasks.md)。

---

## 1. 機能要件

| ID       | 要件（EARS 風）                                                                                                                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SP-1** | 任意の訪問者（未認証含む）が `/about` にアクセスしたとき、システムは運営会社情報・プラットフォーム紹介の静的本文を表示しなければならない。                                                                  |
| **SP-2** | 任意の訪問者が `/legal` にアクセスしたとき、システムは利用規約・プライバシーポリシー・特定商取引法に基づく表記の各セクションを 1 画面（または目次付き）で表示しなければならない。                           |
| **SP-3** | 任意の訪問者が `/faqs` にアクセスしたとき、システムはよくある質問（質問・回答の組）の一覧を表示しなければならない。                                                                                         |
| **SP-4** | 訪問者が `/faq` にアクセスしたとき、システムは `/faqs` へリダイレクトしなければならない（リンク二重化の解消）。                                                                                             |
| **SP-5** | 任意の訪問者が `/customer-service` にアクセスしたとき、システムはサポート窓口のハブとして `/contact` `/returns-exchange` `/faqs` `/track-order` `/product-support` への導線カードを表示しなければならない。 |
| **SP-6** | 任意の訪問者が `/product-support` にアクセスしたとき、システムは購入後の技術サポート・トラブルシューティングの静的情報を表示しなければならない。                                                            |
| **SP-7** | ユーザーメニューの「Help Center」リンクは `/customer-service` を指さなければならない（現状 `""`）。                                                                                                         |
| **SP-8** | ユーザーメニューの「Legal & Privacy」リンクは `/legal` を指さなければならない（現状 `""`）。                                                                                                                |

---

## 2. 受け入れ基準（AC）

| ID         | 受け入れ基準                                                                                                                         | 検証方法                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| **AC-SP1** | `/about` `/legal` `/faqs` `/customer-service` `/product-support` がそれぞれ 200 で描画され、各ページの見出し（`<h1>`）が表示される。 | RTL / E2E                     |
| **AC-SP2** | `/faq` アクセス時に `/faqs` へ **308（`permanentRedirect`）** でリダイレクトされる。                                                 | E2E / 手動                    |
| **AC-SP3** | `/customer-service` の DOM に上記 5 導線リンク（`href`）が存在する。                                                                 | RTL                           |
| **AC-SP4** | `user-menu.tsx` の `extraLinks` で「Help Center」の `link` が `/customer-service`（旧 `""` でない）。                                | RTL（回帰）                   |
| **AC-SP5** | `user-menu.tsx` の `extraLinks` で「Legal & Privacy」の `link` が `/legal`（旧 `""` でない）。                                       | RTL（回帰）                   |
| **AC-SP6** | 全ページが未認証で閲覧可能（middleware 保護対象外）。                                                                                | E2E（サインアウト状態）/ 手動 |

---

## 3. 非機能要件（NFR）

| ID                        | 内容                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **NFR-SP1**（コード規約） | `any` 禁止・`console.log` 禁止。新規ページは server component。コンテンツは型付き定数（`{ heading: string; body: string }[]` 等）。          |
| **NFR-SP2**（視覚整合）   | 未移行ページは既存テーマを維持。移行済み `/faqs` はCSS Moduleで深緑・アイボリー・ゴールド、セリフ見出し、読みやすい本文を採用し、公開ストアフロントのlight配色に整合。                                        |
| **NFR-SP3**（DRY）        | 未移行ページは共有レイアウトを利用。ブランド移行済みページは専用レイアウトを許容し、FAQ・製品サポートの本文は既存の型付き定数を再利用する。                               |
| **NFR-SP4**（SEO/メタ）   | 各ページに `export const metadata`（title/description）を付与（静的・SSG 可）。                                                              |
| **NFR-SP5**（TDD）        | [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md) 遵守（Red→Green・1論理単位=1commit・spec-sync 同梱）。 |

---

## 4. スコープ外

- コンテンツの CMS / MDX 動的編集（文面はコード内プレースホルダで提供し運営が後日差替）。
- FAQ の全文検索（MVP は静的展開。クライアント側フィルタは任意）。
- フォーム送信を伴う画面（`/contact` 等は [support-forms](../support-forms/) 設計書）。
- 多言語・多通貨（[`product.md` スコープ外](../../../.claude/steering/product.md)）。

## FAQデザイン移行（2026-09-30）

- **AC-SP7**: `/faqs` は深緑のヒーロー、アイボリー本文、ゴールド装飾、セリフ見出しを表示。1440／390／768pxで横スクロールを生じず、日本語本文を折り返す。
- **AC-SP8**: 4件の既存質問・回答を常時表示し、質問一覧から一意なアンカーへキーボードで移動可能。focusを可視化し、本文はplain textとする。
- **AC-SP9**: HomeのパンくずとContact／Track your order／Returns & Exchange／Customer serviceへのサポート導線を表示する。
- `/faq` の308転送、公開アクセス、プレースホルダ回答を維持。検索・CMS・回答ポリシーの確定は対象外。
- 検証: [FAQ移行計画](../../../plans/layout-design/faqs-design-system-plan.md)、[移行記録](../design-system/PROGRESS.md#faqs移行記録)。

## Customer service デザイン受け入れ条件（2026-10-01）

既存5窓口のタイトル・説明・URLを保持し、深緑ヒーロー／クリーム背景／ゴールド／セリフ見出しを適用。パンくずとサポートメニューを提供。1440/390/768pxで横溢れなく、キーボードfocus・Enter遷移・hover・WCAG AAを満たす。公開・静的・DB非依存を維持。

## Product support デザイン受け入れ条件（2026-10-01）

既存3セクションの見出し・本文・プレースホルダ表記を保持。深緑ヒーロー、クリーム背景、ゴールド、セリフ見出し、Homeパンくず。3項目の目次に一意で空でないアンカーを設け、focus/Enterで本文へ移動できる。Customer service・Contact・Returns & Exchange・Track your orderの4導線を表示。1440/390/768pxで横溢れなし、WCAG AA。公開Server Component、plain text・DB非依存、親store layoutのレンダリング方針は維持。
