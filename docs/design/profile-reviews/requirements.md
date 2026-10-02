# Profile Reviews — 要件

対象: `/profile/reviews`（DS-PAGE-031）、ReviewsContainer/Header（DS-COMP-087/088）。[保存計画](../../../plans/layout-design/profile-reviews-design-system-plan.md)、[設計](design.md)、[タスク](tasks.md)、[進捗](PROGRESS.md)。

| ID | 受け入れ条件 | 検証 |
|---|---|---|
| PR-1 | account共通の深緑/アイボリー/ゴールド、GeorgiaのMy reviews h1、日本語リード、サポート。 | RTL / Chromium |
| PR-2 | マスクした投稿者名/画像、評価（小数保持）、variant/色/size/数量/本文/添付写真を保持。長い値と改行を折り返す。updatedAtをUTCの日付で表示。 | RTL / Chromium |
| PR-3 | View allと1〜5starsのnative button/aria-pressed、4期間のlabel付きselect。 | RTL / Chromium |
| PR-4 | 本文検索はSearch/Enterで適用し、空検索で解除。未送信draftを評価/期間変更に適用しない。条件変更page=1、ページ変更は条件を保持。全解除で評価/期間/検索を戻す。 | RTL / Chromium |
| PR-5 | 前/次ページと境界disabled、1ページ以下はページャ非表示。表示件数と現在ページのみ表示し総件数を推測しない。 | RTL / Chromium |
| PR-6 | 空/条件付き空と/browse導線、初回/再取得失敗に汎用alertと条件を保持Try again。例外詳細/古い結果を表示しない。 | RTL / Chromium |
| PR-7 | 取得中status/aria-busy/静的skeleton、操作ロック/ページャ非表示/二重要求防止。mountで再取得しない。route loadingも同じ見出し。 | RTL / Chromium |
| PR-8 | 1440/390/768pxで横溢れなし、focus/Tab/Enter、axe AA違反0（contrast除外なし）。 | Chromium |
| PR-9 | getUserReviewsForDisplayをServer Componentからaction Propsで渡す。最小投影/ISO日付、所有者条件と認証失敗時DB未実行、Client直接action importなし。 | query / RTL |

既存queryの評価・createdAt期間・本文case-insensitive検索・10件ページ・updatedAt降順を維持。ページ内条件はClient stateで再読込時初期化。投稿/編集/削除、商品・店舗・注文検索、商品ページ共有ReviewCardの移行は対象外。
