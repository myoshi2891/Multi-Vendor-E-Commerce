# .claude/ ディレクトリ — 概要

このディレクトリは **Claude Code** の設定ファイル・ステアリングファイルを管理します。

## ファイル構成

```
.claude/
├── README.md              # このファイル（構成説明）
├── settings.local.json    # 権限設定（git管理対象外推奨）
├── steering/              # チーム横断コンテキスト（全セッション共有）
│   ├── product.md         # プロダクトビジョン・ペルソナ・KPI
│   ├── tech.md            # 技術スタック・禁止事項・テスト要件
│   └── structure.md       # ディレクトリ構成・設計判断・データモデル
└── agents/                # サブエージェント定義（将来拡張用）
    └── README.md          # サブエージェント管理ドキュメント
```

## Steering Files の役割

`steering/` 配下のファイルは Claude Code の **長期的コンテキスト** として機能します。
CLAUDE.md がセッション間の「脳」であるのに対し、steering は **チーム全体で共有する不変のルール** です。

- `CLAUDE.md` — プロジェクト永続メモリ（コマンド・構造の要点、@import参照）
- `steering/product.md` — プロダクト方針（触るな、変えるな）
- `steering/tech.md` — 技術制約（禁止事項・テスト要件）
- `steering/structure.md` — ディレクトリ責務・設計判断

## 更新ルール

- `steering/*.md` は **破壊的変更があった場合のみ** 更新する
- 修正履歴はここには書かず、`git log` で追跡する
- 個人設定は `CLAUDE.local.md`（`.gitignore` に自動追加）を使用する
