# Profile Reviews — 設計

[要件](requirements.md)、[保存計画](../../../plans/layout-design/profile-reviews-design-system-plan.md)。

- force-dynamic Server Componentで初期getUserReviewsForDisplayをtry/catchし、result/initialError/actionをReviewsContainerへPropsで渡す。Clientからactionsを直接importしない。
- 表示facadeは既存getUserReviewsへ委譲し、id/rating/review/variant/color/size/quantity/updatedAt ISO、user name+picture、images id+url+altのみ投影。email/userId/productId/likes/createdAtや内部画像項目は送らない。既存Clerk認証/所有者query/DBスキーマを維持。
- 専用ReviewHistoryCardでol/li/h2/time、文字によるrating（4.5等の小数保持）、マスク名と任意avatar、ラベル付き色/size/数量、本文/写真。未設定色/sizeと画像altは読めるfallback。色は文字で示し色だけに依存しない。共有ReviewCard/商品ページは変更しない。
- ReviewsHeaderのnative評価button、label付き期間select、検索formと全解除。旧3秒/3文字の遅延検索をSearch/Enterへ統一。検索対象案内は実queryの本文に合わせる。draftと適用済みsearchを分ける。
- 初期resultをそのまま表示しmount fetchを廃止。単一loadと同期ref/fieldset disabledで要求を直列化。取得中/失敗は旧結果とpagerを隠し、条件を維持して再試行する。
- 通常/loadingのReviewsHeadingを共用。専用module CSSは先行paymentと同じaccount配色/余白/focus、44px操作、static skeleton。1000px以下でheading/検索を縦に、480px以下でカードmetadataを1列。長いvariant/本文はoverflow-wrap:anywhere、本文改行を保持。写真はwrap。

実Clerkテスト顧客の認証/後処理と初期空の実queryを確認。通常/遅延/失敗はaction応答mock。レビューDB作成・投稿・購入・seed・外部送信を行わない。本文/axeのscopeはレビュー領域に限定し、Next.js route announcerをアプリの失敗通知と混同しない。
