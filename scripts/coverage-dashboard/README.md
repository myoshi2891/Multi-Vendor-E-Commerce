# Coverage Dashboard Generator

このプロジェクトのテストファイル構成を**単一 HTML ダッシュボード**として可視化するためのビルドスクリプト群。

## 実行

```bash
bun run coverage:dashboard
# → docs/coverage-dashboard.html を生成
```

## モジュール責務

| ファイル | 責務 |
|---|---|
| `scan-tests.ts` | リポジトリを走査し、テストファイルパスを列挙する |
| `categorize.ts` | テストファイルパスを `(category, domain)` に分類する |
| `parse-lcov.ts` | `coverage/lcov.info` をパースして `{file → line%}` を返す |
| `build-matrix.ts` | スキャン結果と lcov を統合し、マトリクス JSON を生成する |
| `render-html.ts` | マトリクス JSON を「Editorial Laboratory」HTML に整形する |
| `build.ts` | CLI エントリ。上記を順次呼び出し `docs/coverage-dashboard.html` に書き出す |

## テスト

各モジュールには Jest テストが付属する（`*.test.ts`）。

```bash
bun run test -- --testPathPatterns=scripts/coverage-dashboard
```

## 設計判断

- **外部依存追加なし** — glob は Node 内蔵 API で実装、lcov パースも軽量自作
- **`@/` エイリアス未使用** — スクリプトはアプリコードに依存しない独立ユーティリティ
- **`console.log` 許容** — CLI 用途のため（`prisma/seed/` と同等の扱い）
- **未採用カテゴリも表示** — Visual / a11y / Performance / Security は ❌ 行として残し、テスト戦略立案を促す
