# Visual Regression Tests

## 概要

Cart / Checkout の主要画面の UI 崩れをマージ前に検出する。
`playwright.config.ts` で `reducedMotion: 'reduce'` / `locale: 'en-US'` / `timezoneId: 'UTC'` を固定し、レンダリング差を抑えている。

## スコープ

- **対象ブラウザ**: Chromium 限定。Firefox / WebKit はフォントレンダリング差が大きいため Phase 2 で対応。
- **対象画面**: 空カート、商品追加後のカート、未認証時の `/checkout` リダイレクト先。
- **認証済み `/checkout` の Visual Regression**: Phase 2（Clerk テストセッションヘルパーの整備後）。

## Baseline 生成手順

1. 開発サーバーを起動し、E2E シードを投入する

   ```bash
   bun run seed:e2e
   ```

2. 初回はベースラインスナップショットを生成する

   ```bash
   bunx playwright test tests/e2e/visual --update-snapshots --project=chromium
   ```

3. 生成された PNG（`tests/e2e/visual/*.spec.ts-snapshots/`）をリポジトリにコミット

## 通常実行

```bash
bunx playwright test tests/e2e/visual --project=chromium
```

差分が `toHaveScreenshot.maxDiffPixelRatio`（0.01）を超えるとテストが fail する。

## 既知の制約

- CI（GitHub Actions）が未整備のため、`--update-snapshots` の自動運用は今後対応。
- 商品画像など外部 CDN リソースは `mask` で除外して差分を防いでいる（cart.spec.ts 参照）。

## 関連

- 上位計画: `~/.claude/plans/melodic-plotting-bubble.md` の A2
- テスト設計: `docs/testing/TESTING_DESIGN.md`
