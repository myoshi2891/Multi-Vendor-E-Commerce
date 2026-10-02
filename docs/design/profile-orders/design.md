# Profile Orders — 設計

[要件](requirements.md) / [保存計画](../../../plans/layout-design/profile-orders-design-system-plan.md)。

- 2ルートはforce-dynamicのServer Componentを保持し、共通OrdersPageで初回queryと汎用失敗を扱う。route filterの既存whitelistを保持。filterをkeyとしてルート遷移時に初期状態へ戻す。
- `src/queries/profile.ts` の `getUserOrdersForDisplay(filter, period, search, page)` は既存getUserOrdersを経由。所有者制約、状態/期間、検索、10件ページ、更新日降順を維持。totalをnumber、createdAtをISOに変換し、ID/2状態/明細数/画像のみ投影。ClientへPrisma Decimalや住所・店舗・商品内部フィールドを渡さない。
- OrdersPageがactionをPropsとしてOrdersTableへ渡す。Clientからqueriesへの実行時importはない。既存queryの認可条件・引数・戻り値は変更しない。
- `orders.module.css` は本文に限定。profile共通のaccount変数を使い、アクセント#75613b、本文#536356、カード#faf8f2、罫線#c9c7b8。見出しはGeorgia。注文ごとのカードでh2にID、dlで状態を示す。ステータスはCamelCaseを語分割し、色だけに依存しない。
- 5状態はnative buttonとaria-pressed、検索はlabel付きsearch form、期間はlabel付きnative select。旧3秒遅延/3文字しきい値をフォーム送信へ変更する。入力draftと適用searchを分け、状態/期間変更では適用済みsearchを保持する。
- 単一load関数が条件とpageを更新。同期refとfieldset disabledで処理中操作を抑止、ページャを隠す。初回queryの結果をそのまま表示し、mount時の再取得を廃止。
- 取得中/失敗時に旧結果を非表示、失敗は条件を維持したTry again。空は全件/絞り込みを区別。route loadingは共通見出しと静的スケルトン。
- 1000px以下で検索と期間・見出し導線を縦へ、480px以下でカードと金額を折り返す。画像・状態・ページャも折り返し、注文IDはoverflow-wrap:anywhere。focus-visibleと44px以上の操作領域。

ブラウザーは実Clerkのテスト顧客を作成/認証/後処理し、初期空を実queryで確認。商品入り・遅延・失敗・再試行はaction応答mockを使う。注文DB作成・購入・seed・DB初期化を行わない。実注文ありの照会は別途運営データで確認可能。
