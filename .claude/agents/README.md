# .claude/agents/ — サブエージェント管理

## 概要

このディレクトリはClaude Codeの **サブエージェント定義ファイル** を管理します。
サブエージェントはYAMLフロントマター + システムプロンプト本文で構成されます。

## サブエージェントの定義形式

```markdown
---
name: agent-name
description: >
  このエージェントが何をするかを具体的に記述。
  「いつ使うか・いつ使わないか」を明記。
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
```

## 設計ルール

- `description` フィールドは「いつ使うか」を具体的に記載する（ルーティング精度に直結）
- `tools` フィールドは必要最小限の権限のみ付与する
- `model` は用途に合わせて選択（reviewはhaiku、実装はsonnet等）
- 1エージェントが担当するファイル範囲を明示する（書き込み競合の防止）

## 現在定義されているエージェント

（現時点では未定義。機能追加時にこのREADMEを更新する）

## 参考

- [Claude Code Sub-agents 公式ドキュメント](https://code.claude.com/docs/en/sub-agents)
- [Agent Teams 公式ドキュメント](https://code.claude.com/docs/en/agent-teams)
