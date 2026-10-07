# Plan 084: a11y color-contrast 負債の是正と抑制解除（OI-10）

## Status

- **Priority**: P3
- **Effort**: S〜M（違反ノードの数で変わる）
- **Risk**: LOW（テキスト色クラスの差し替えのみ。グローバルトークンは変えない）
- **Depends on**: —
- **Category**: a11y
- **Planned at**: commit `7edcb20b`, 2026-10-07

## Why this matters

QA_HANDOFF の OI-10: axe `color-contrast`（WCAG 2.1 AA 4.5:1）違反を E2E で
`disabledRules: ["color-contrast"]` により抑制している。抑制は QA_HANDOFF 記載の 3 ページ
（`/checkout`・`/profile`・`/seller/apply`）に加え、`/product`・`/cart`・`/browse` の計 **6 spec** にある。
OI-10 をクローズするには 6 件すべての抑制解除が必要。

spec コメントの「`#eef4fc` 背景」は `src/` に存在しない（デザインシステム移行で配色が変わった）。
現在の違反ノードは未計測のため、推測で色を変えず **実測 → 該当箇所のみ修正** で進める。

## Scope

- `tests/e2e/a11y/_helpers.ts`: 違反ログに各ノードの `target` と contrast データ（fg/bg/ratio）を出す
- `tests/e2e/a11y/{checkout,profile,seller-apply,product,cart,browse}.spec.ts`: `disabledRules` 削除
- 実測で特定した違反コンポーネントのテキスト色クラス

## Out of scope

- `src/app/globals.css` のグローバルトークン変更（全画面へ波及。必要なら STOP してユーザー確認）
- 第三者 SDK（Clerk / PayPal / Stripe）の内部描画

## STOP conditions

- グローバルトークンの変更が必要
- 違反が第三者 SDK 由来でアプリ側から直せない（ルール無効化ではなく要素単位の除外案を提示）

## Steps / Verify

1. **Red**: 抑制を外し `bunx playwright test tests/e2e/a11y --project=chromium` が color-contrast で失敗することを確認・記録（環境エラーは Red に数えない）
2. **Green**: 違反コンポーネントの色クラスを 4.5:1 以上の既存色へ置換し、同コマンドでグリーン
3. 影響 Jest スイート・`bunx tsc --noEmit`・`bun run lint` 0 errors
4. 変更部品のスクリーンショット確認

## Done criteria

- a11y 6 spec が `disabledRules` なしでグリーン（color-contrast 違反 0）
- QA_HANDOFF の OI-10 を取り消し線でクローズ、依頼プロンプト削除
- `render-html.ts` の `NEXT_ACTIONS` から OI-10 を削除し `bun run coverage:dashboard` で再生成
- `docs/design/design-system/PROGRESS.md` に証跡を追記

## 実施結果（2026-10-07・未コミット）

- 実測: 違反は `/browse` 6 ノード・`/product` 22 ノードのみ（デザイン移行 CSS Module の淡色背景上の文字色）。他 4 ページは抑制解除の時点で違反 0
- 修正: `browse.module.css`（6 箇所 + `.catalogIntro .eyebrow` 追加）・`product.module.css`（17 箇所）の文字色を、色相を保ったまま明度だけ下げる。グローバルトークンは変更なし
- 付随修正: `tests/e2e/a11y/sign-in.spec.ts` の準備完了待ちが、ヘッダーの非表示検索 form を `.first()` で掴んでいた不具合を `main` 限定で解消（ユーザー承認済み）
- 診断: `runA11yScan` の違反ログにノードの `target` と判定データを追加
- 環境メモ: `:3000` で再利用される Docker dev コンテナは Docker DB、テスト実行側の `.env` は Neon を向くため、認証後 spec（checkout）は外部キー違反で失敗する。`DATABASE_URL`/`DIRECT_URL` を `localhost:5432` の Docker DB に向けて実行した（ユーザー承認済み）
- 検証: Chromium a11y 7/7 pass、関連 Jest 23/23、tsc 0、lint 0 errors／8 warnings、1440／390px のスクリーンショット確認
