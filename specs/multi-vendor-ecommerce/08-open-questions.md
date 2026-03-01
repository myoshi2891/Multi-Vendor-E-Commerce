# Open Questions and Gaps

- Where is the canonical shipping fee calculation implemented for ITEM/WEIGHT/FIXED?
- How is inventory reserved or locked during checkout to avoid oversell?
- Are taxes, duties, or multi-currency pricing planned?
- What is the intended refund and return workflow beyond status enums?
- What analytics or reporting requirements are expected for sellers/admins?
- Are there data retention or privacy requirements beyond auth defaults?

## Known Issues

（現在未解決の既知問題はありません）

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
