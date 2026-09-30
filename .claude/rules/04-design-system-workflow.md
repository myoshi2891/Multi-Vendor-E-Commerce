# 計画先行とデザイン移行の完了管理

## Scope

このリポジトリのコード実装、および画面・レイアウト・デザインシステムの変更。

## Rules

- コード実装前に `plans/` へ対象・受け入れ条件・検証方法を保存する。既存の承認済み計画は再利用する。
- UI変更では [design-system-workflow](../../.agent/skills/design-system-workflow/SKILL.md) を読み、TDD・実装後検証・仕様書更新・進捗更新まで実施する。
- [進捗ノート](../../docs/design/design-system/PROGRESS.md) をレイアウト移行の状態の正本とする。検証と文書同期前に完了扱いしない。
- 文書のみの変更は文書検証を行う。既存の承認範囲に再承認を要求しない。コミットは明示的な依頼時のみ行う。

## Rationale

ソース上のデザイン適用と検証完了を区別し、仕様書・進捗の更新漏れを防ぐ。

## Examples

- 許可: 承認済み計画でTDDを進め、検証後に関連仕様と進捗を同期する。
- 禁止: CSSを変更しただけで台帳を検証済みにする。

## Owner / Last updated

- Owner: project team
- Last updated: 2026-09-30
