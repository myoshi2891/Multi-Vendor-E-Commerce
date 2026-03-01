# Open Questions and Gaps

- Where is the canonical shipping fee calculation implemented for ITEM/WEIGHT/FIXED?
- How is inventory reserved or locked during checkout to avoid oversell?
- Are taxes, duties, or multi-currency pricing planned?
- What is the intended refund and return workflow beyond status enums?
- What analytics or reporting requirements are expected for sellers/admins?
- Are there data retention or privacy requirements beyond auth defaults?

## Known Issues

- `getUserWishlist` (`src/queries/profile.ts`): `variants[0]` への直接アクセスが
  空のバリアント配列で TypeError を発生させる。ガード節またはフィルタリングが未実装。
- `getProductShippingFee` (`src/queries/product.ts`): 無料配送対象国の比較で
  `country.name` を使用していたバグは `country.id` に修正済み。
