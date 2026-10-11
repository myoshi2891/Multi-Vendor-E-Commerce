# 販売者実ルートの本番ビルド再検証と Cloudinary preset の env 化

- 日付: 2026-10-10。DS-SELLER-EIGHT-BROWSER「今後の課題」の残り2件。ユーザー承認済み。

## 1. 本番ビルドでの実ルート再検証

- 変更: `playwright.design.config.ts` の `seller-eight-route` だけ、`DESIGN_SELLER_ROUTE_SERVER=prod` で webServer を `bun run build && bun run start -- --port 3131` に切り替える（既定は従来の dev のまま）。build を含むため timeout を延ばす。config は増やさない（05-playwright-harness）。
- 実行場所: :3000 の Docker app と `.next` を共有しないよう、`git worktree` の別ディレクトリで実行する（リポジトリ内で `next build` しない）。
- 受け入れ: 専用DB＋`prepare-seller-route.ts` の既存手順で 57/57、axe 違反0、WebServer の Decimal 警告0。重複店舗名の保存で理由が出る（本番で Server Action のメッセージが伏せられても届く）ことを確認。
- 後片付け: worktree を削除。

## 2. Cloudinary upload preset の env 化

- 新変数 `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`。未設定・空白のみは既定値 `fefik77l`（既存の挙動を維持）。既存の `NEXT_PUBLIC_CLOUDINARY_PRESET_NAME` は `.env`／`.env.docker` で別値・`ci-stub` のため流用しない。
- `src/lib/cloudinary.ts` の `getCloudinaryUploadPreset()` に集約し、`image-upload.tsx`（3箇所）と `upload-images.tsx` から使う。`NEXT_PUBLIC_*` はビルド時に埋め込まれるため、参照は `process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` の直書き。
- 先行テスト: helper の既定値・指定値・空白、両コンポーネントが env の preset をウィジェットへ渡すこと。
- 実アップロード→保存→再表示は対象外（テスト用 preset と削除手順が揃ってから）。

## 文書同期

`.env.example`、QA_HANDOFF（SSOT）→ 07-testing／COVERAGE_REPORT／PROGRESS、coverage dashboard、design-system PROGRESS の再実行手順。

## 最終結果（2026-10-10）

- 本番ビルド（git worktree）: 初回 55/57。画像SDK 2件は、本番で SDK 読込が速く先の押下でウィジェットが開き、全画面 iframe が覆ったボタンへの `click()` が待ち続けたもの（spec の問題）。開いていれば再押下しない形に直し、重複 URL の理由表示 +1 を加えて 58/58、Decimal 警告0。dev でも変更した4件 4/4。
- preset: 先行 Red（コンポーネント4件が `fefik77l` を受信、helper 未作成）→ Green。Jest 3132/3135、323 suites。lintエラー0／既存警告8、tsc 0、check:playwright 成功。
- 実アップロードは対象外のまま。未コミット。
