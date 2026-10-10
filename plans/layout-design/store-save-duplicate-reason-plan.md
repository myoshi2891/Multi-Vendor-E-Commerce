# 店舗保存の重複理由を画面に出す計画

- 日付: 2026-10-10。DS-SELLER-EIGHT-BROWSER「今後の課題」の「店舗保存失敗時の理由が画面に出ない」。ユーザー承認済みの既存 API 変更。
- 背景: Next.js 本番は Server Action が throw したメッセージを client で伏せるため、`upsertStore` の重複エラー文言は画面に届かない。
- 変更: `upsertStore` の戻り値を `{ ok: true; id; url } | { ok: false; reason }` へ。重複（name/url/email/phone）のみ `{ ok: false, reason }` で返す。認可・入力欠落・所有者不一致・DB 障害は従来どおり throw（汎用表示）。理由文言は既存の固定英文で、DB 由来の値は含めない。
- 呼び出し側: `StoreDetails` は `ok: false` の reason を alert に出し、それ以外の失敗は従来の「Could not save the store. Please try again.」。入力は保持し、再送信で理由を消す。

## 受け入れ条件・先行テスト

- `store.test.ts`: 重複時に `{ ok: false, reason }` を返し create/update を呼ばない（作成・更新の両経路）。成功は `{ ok: true, id, url }`。
- `seller-store-pages-design.test.tsx`: 重複応答で alert に理由、入力保持、再送信成功で理由が消える。DB エラー文言を出さない既存ケースは維持。
- 先行 Red を確認してから Green。tsc/lint/全体 Jest。本番ビルドの実ルートで重複理由の表示を確認。

## 文書同期

04-interfaces の Return values、QA_HANDOFF（SSOT）→ 07-testing／COVERAGE_REPORT／PROGRESS、coverage dashboard。
