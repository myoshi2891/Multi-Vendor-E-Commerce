# Open Questions and Gaps

- Are taxes, duties, or multi-currency pricing planned?
- What is the intended refund and return workflow beyond status enums?
- What analytics or reporting requirements are expected for sellers/admins?
- Are there data retention or privacy requirements beyond auth defaults?

## Known Issues

### E2E テスト: Firefox でカートページナビゲーションがタイムアウト

**影響範囲**: Firefox ブラウザでの E2E テスト実行時、`/cart` へのナビゲーションが 30 秒でタイムアウトする（開発環境のみ）

**症状**:
- `page.goto("/cart")` が `waitUntil: "commit"` / `"domcontentloaded"` / `"load"` すべてでタイムアウト
- サーバーは正常に `GET /cart 200` を返却しているが、Playwright のナビゲーション完了イベントが発火しない
- Chromium・WebKit では同じコードが正常動作

**根本原因**:
開発環境の Next.js HMR (Hot Module Replacement) WebSocket と Firefox の相互作用により、ページの "load" / "domcontentloaded" イベントが完了しない。商品ページや他のページでは問題が発生せず、カートページに限定される理由は不明。

**回避策**:
- `tests/e2e/purchase-flow.spec.ts`: Firefox のカートテストを `test.skip()` で無効化
- `tests/e2e/mobile-responsive.spec.ts`: Firefox のモバイルチェックアウトテストを無効化
- Chromium・WebKit で品質保証を継続（本番環境では Firefox も正常動作する想定）

**長期対応案**:
1. **本番ビルドでのテスト**: `bun run build && bun run start` で HMR なしの環境でテストを実行
2. **ページ調査**: CartContainer の useEffect やクライアントコンポーネントの処理を調査
3. **Playwright バージョン更新**: 最新版で Firefox の挙動が改善されている可能性

**関連ファイル**:
- `tests/e2e/purchase-flow.spec.ts` (スキップロジック)
- `tests/e2e/mobile-responsive.spec.ts` (スキップロジック)
- `src/components/store/cart-page/container.tsx` (カートページロジック)

**記録日**: 2026-03-24
**ステータス**: 回避策実装済み（Firefox テストはスキップ、Chromium/WebKit で品質保証）

### modal-provider テスト: CI環境での実行時のランダムな失敗 (OI-8)

**影響範囲**: `src/providers/modal-provider.test.tsx` の一部テストが、CI (GitHub Actions) 環境でまれに失敗する。

**症状**:
- `[P1] モーダルを開くと...` テストにおいて、assertion error などの明確なエラーメッセージを出力せず、完全に空の状態でテストが失敗する。
- 開発者ローカル環境（M4 Mac等）では再現しない。

**根本原因**:
詳細な原因は未検証（ResizeObserver の挙動、Radix UI のアクティブな要素へのフォーカス処理、jsdom での非同期イベントタイミングなどが疑われる複数の仮説がある）。
これまでの対策として、`ModalProvider.setOpen` を非同期から同期処理に変更する設計改善を行ったが、CIでの偶発的な失敗（flake）は根治されなかった。詳細は [ADR-003: ModalProvider setOpen 同期化](../../docs/architecture/decisions/003-modal-setopen-sync-for-react19.md) を参照。

**回避策**:
- `src/providers/modal-provider.test.tsx` 内の該当テストに `it.skip` を適用し、CI の安定稼働を最優先として一時的に退避。
- 同等のカバレッジは `[P1] fetchData なしでモーダルを開ける` などの他テストで一部担保。

**長期対応案**:
- `.claude/skills/ci-flake-diagnosis/SKILL.md` の診断プロセスに基づき、CI 実行時の環境変数・jsdom バージョン・非同期モックなどを精査し、根本原因を特定してテストのスキップを解除する。
- 目標解決期限: 2026-06-07。

**関連ファイル**:
- `src/providers/modal-provider.test.tsx` (テスト定義、`it.skip`)
- `src/providers/modal-provider.tsx` (SUT)
- `docs/architecture/decisions/003-modal-setopen-sync-for-react19.md` (ADR-003)
- `docs/testing/QA_HANDOFF.md` (OI-8 追跡用 SSOT)

**記録日**: 2026-05-24
**ステータス**: 回避策実装済み（CI flake回避のため該当テストを一時スキップ中、解決期限: 2026-06-07）

## Resolved Issues

- `getUserWishlist` (`src/queries/profile.ts`): `variants[0]` への直接アクセスが
  空のバリアント配列で TypeError を発生させていた。`.filter()` で空バリアント商品を
  除外するガードを実装。
- `getProductShippingFee` (`src/queries/product.ts`): 無料配送対象国の比較で
  `country.name` を使用していたバグを `country.id` に修正。
- `webhooks/route.ts`: `email_addresses[0]?.email_address` が undefined でも
  DB操作に渡される問題。`primaryEmail` 抽出 + 早期リターン（400）で防止。
  到達不能コード `if (!user) return;` も削除。
- `review.ts`: IDOR脆弱性修正。`upsert` → 所有権検証付き `update`/`create`。
- `webhooks/route.ts`: Svix検証済み `evt.data` を使用（`JSON.parse(body).data` の
  再パースを排除）。
- `webhooks/route.ts`: upsert の lookup key を `email` → `id` に変更。
  Clerk user ID はイミュータブルなため、メール変更後もレコードが確実にマッチ。
- `webhooks/route.ts`: `db.user.delete` → `db.user.deleteMany` で冪等化。
  レコード不在時も `{ count: 0 }` を返し、Svix リトライループを防止。
- `webhooks/route.ts`: `db.user.upsert` + `clerkClient.users.updateUserMetadata`
  を try/catch でラップし、失敗時に 500 を返却（未ハンドル例外を防止）。
- `store.ts` (`updateStoreStatus`): `store.update` + `user.update` を
  `db.$transaction` でアトミック化。PENDING→ACTIVE 遷移時の不整合を防止。
- `store.ts` (`updateStoreStatus`): try/catch 追加。DB 操作失敗時にエラーを
  ログ出力して再スロー（`deleteStore` パターンに統一）。
- `store.test.ts`: `any` → `Record<string, unknown>` + `MockPrismaClient`
  インターフェースで型安全なモック定義を導入。
- `getShippingDetails` / `getProductShippingFee` (`src/queries/product.ts`):
  ITEM/WEIGHT/FIXED の各配送料計算を実装。店舗の ShippingRate と
  freeShipping 設定に基づいてユーザーの国に応じた配送料を算出。
- `placeOrder` (`src/queries/user.ts`): `db.$transaction` でアトミックに
  注文作成・在庫減算を実行。トランザクション内で在庫チェックと更新を行い
  オーバーセルを防止。
- `ProductWatch` (`src/components/store/product-page/product-info/product-watch.tsx`): 閲覧者数取得のWebSocket接続失敗時のコンソールエラーを抑制し、安全に非表示にフォールバックするように修正。
- `ThemeProvider` & `cookies()` (`src/providers/theme-provider.tsx`, `src/queries/product.ts`): ハイドレーションエラー警告および `cookies()` 非同期化に伴うSSRの不整合を解消。
- `ReviewDetails` (`src/components/store/forms/review-details.tsx`): React 19 と互換性のない `react-rating-stars-component` を廃止し、自前のカスタム評価UI (`CustomRatingStars`) に置き換え、星が描画されない問題を解決。また、バリアント色が `[object Object]` になって保存されるバグを `.map((c) => c.name)` の適用で修正。
- `upsertReview` (`src/queries/review.ts`): Clerk Webhook 未受信によるローカルDBへの `User` 登録漏れ（外部キー制約エラー）を防ぐため、存在しない場合に Clerk 情報を基に User を自動同期（フォールバック）する処理を追加。また、エラー伝播を詳細化。
