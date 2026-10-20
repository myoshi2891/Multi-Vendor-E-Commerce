# レビュー ガバナンスの UI（plan 092 Step 7・2026-10-18）

対象: DS-COMP-072 レビューカード（購入者バッジと通報の追加）、DS-PAGE-069 `/dashboard/admin/reviews`（新規）、DS-COMP-250 admin 審査キュー（新規）、DS-COMP-251 プロフィールのレビュー状態表示（新規）。
承認: ユーザーの今回依頼（plans/README のネクストアクション → plan 092）。design-system-workflow を適用。設計の正本は [review-governance/design.md](../../docs/design/review-governance/design.md) §1〜§4、親プランは [092](../092-implement-review-governance.md)。

変更:
- レビューカード: `isVerifiedPurchase` のときに「Verified purchase」バッジ。`onReport` が渡されたときだけ通報ボタンを出し、理由（5 種）と任意のメモで送る。送信中はボタンをロックし、`useRef` で二重送信を防ぐ。成功・失敗はトースト。未認証（`Unauthenticated.`）はサインインを促す文言にする。
- 商品ページ: Server Component（`page.tsx`）から `reportReview` を `onReport` として `ProductReviews` → `ReviewCard` に渡す（Client は `src/queries` を新たに import しない）。
- admin 審査キュー: `SellerPage` + `DataTable`（`admin-orders.tsx` と同じ型）。状態の絞り込み（審査待ち+FLAGGED / 各状態）、行ごとに本文・評価・商品・投稿者・購入者・未解決の通報数・操作。操作は状態に応じて、遷移表にあるものだけ出す（承認 / 却下 / 削除 / 復帰）。却下・削除は理由を必須にする。列定義と actions は初回参照で固定する（refresh で行が remount しないように）。サイドバーに Reviews を追加する。
- プロフィールのレビュー履歴: `PUBLISHED` 以外のときに状態バッジ（審査待ち / 審査中 / 却下 / 削除）。却下・削除の理由は本人にだけ表示する。

基本ルール対応: Client から `src/queries` を新規に import しない。actions は Server Component から props で渡す。表示用の状態ラベルは `src/lib/review-moderation.ts` の遷移表から導く（UI に遷移表を複製しない）。

対象外: 通報の閾値やモードを変える管理 UI（SQL で運用・design §3.3）、却下・削除の通知（design §8）、`likes`。

依存: `src/queries/review.ts`（`reportReview` / `moderateReview` / `getReviewModerationQueue`・実装済み）、`SellerPage` / `seller.module.css`、`DataTable`、`Dialog`。

受け入れ条件:
- バッジは購入者のレビューだけに出る。通報は理由を選ばないと送れない。送信中は二重に送れない。失敗は再送できる。
- 審査キューは、状態ごとに遷移表にある操作だけを出す。理由が空だと却下・削除できない。成功後に refresh して行が更新される。
- 1440 / 768 / 390px で横溢れなし。キーボード操作と focus、axe AA 違反 0。admin はライト・ダーク。

先行テスト（Red を確認してから実装する）: RTL — レビューカード（バッジ・通報の送信・ロック・失敗）、admin 審査キュー（状態ごとの操作・理由必須・refresh）、プロフィールの状態バッジ。`review-moderation` に UI 用の「その状態で出せる操作」の関数を足すならユニットテストも。

検証: 関連 Jest、`DESIGN_SUITE=review-governance`（新設の fixture suite・port 3138・共通 `startFixtureServer`）、`check:playwright`、lint、tsc、全体 Jest。

保留（予定）: 認証後の実ルート（ADMIN の Clerk アカウントと専用 DB が要る。QA_HANDOFF の DS-PURCHASE-TEN-ROUTES と同じ環境制約）。解除条件: 専用 DB とテスト用 ADMIN を用意し、`/dashboard/admin/reviews` を実ルートで 3 幅・axe・操作確認する。

文書: 台帳（DS-COMP-072 の状態、DS-PAGE-069 / DS-COMP-250 / DS-COMP-251 を追加）と実施記録、04-interfaces / 05-workflows、design §9、plan 092・plans/README、spec-sync-after-test。

完了（2026-10-18、未コミット）: RTL の Red を実測（レビューカード 7 件・審査キュー/ページ 20 件・履歴カード 5 件・ProductReviews 1 件。いずれも未実装による失敗）。最終: 全体 Jest 3462/3465、`DESIGN_SUITE=review-governance` 12/12（1440 / 768 / 390px、admin は light / dark、axe AA 違反 0、focus・44px、送信中・失敗→再試行・空）、回帰 `purchase` 82/82・`postpurchase` 35/35、`check:playwright`・lint・tsc 成功。PC / モバイルの画像を目視。認証後の実ルートは保留（解除条件は上記）。台帳・仕様（03 / 04 / 05）・design §8.5 を同期。

