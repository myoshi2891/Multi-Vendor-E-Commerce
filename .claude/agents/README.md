# .claude/agents/ — サブエージェント管理

## 概要

このディレクトリは Claude Code の **サブエージェント定義ファイル** を管理します。
サブエージェントは YAML フロントマター + システムプロンプト本文で構成されます。

---

## サブエージェントの定義形式

````markdown
---
name: agent-name
description: >
  Describe specifically what this agent does and when to use or not use it.
  Triggered by: "日本語トリガーワード", "english trigger", "another trigger".
tools: Read, Glob, Grep
model: sonnet
---

# Agent Name

## Role
このエージェントの責務を記述。

## Instructions
1. ステップバイステップの指示
2. ...

## Constraints
- 禁止事項を記述
````

---

## 設計ルール

### ❌ 禁止

- `description` を日本語のみで記述すること（ルーティング精度が低下する）
- `tools` に不要な権限を付与すること（最小権限の原則）
- 複数エージェントが同じファイル範囲に書き込む設計（書き込み競合の原因）

### ✅ 必須

- `description` は **英語ベース・三人称** で記述し、日本語・英語両方のトリガーワードを `Triggered by:` で明記する
- `tools` は必要最小限の権限のみ付与する
- 各エージェントが担当するファイル範囲を本文に明示する

### 💡 推奨

- `model` は用途に合わせて選択する（レビュー系は `haiku`、実装系は `sonnet`）
- `description` に「いつ使わないか（NOT triggered by）」も記載するとルーティング精度が向上する

---

## フィールド早見表

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `name` | ✅ | スラッシュコマンド名になる（例: `code-reviewer` → `/code-reviewer`） |
| `description` | ✅ | Claude がエージェントを選ぶ判断基準。**英語ベース・三人称**で記述 |
| `tools` | ✅ | 使用を許可するツールのカンマ区切りリスト |
| `model` | 任意 | `haiku` / `sonnet` / `opus`（省略時はデフォルトモデル） |

---

## 現在定義されているエージェント

（現時点では未定義。エージェント追加時にこの表を更新すること）

| ファイル名 | name | 役割 | 担当ファイル範囲 |
|-----------|------|------|----------------|
| — | — | — | — |

---

## 参考

- [Claude Code Sub-agents 公式ドキュメント](https://docs.anthropic.com/en/docs/claude-code/sub-agents)
- [Agent Teams 公式ドキュメント](https://docs.anthropic.com/en/docs/claude-code/agent-teams)
