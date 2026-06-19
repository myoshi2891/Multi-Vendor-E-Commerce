# Profile Settings — 進捗トラッカ

> このファイルは [tasks.md](./tasks.md) の **Phase 進捗の SSOT**（どこまで完了し、次にどこから着手するか）。
> 全体の履歴・テスト統計は [docs/PROGRESS.md](../../PROGRESS.md)、統計の SSOT は [docs/testing/QA_HANDOFF.md](../../testing/QA_HANDOFF.md)。
> 要件は [requirements.md](./requirements.md)、設計は [design.md](./design.md)。

---

## 🧭 現在地（設計完了時点）

- ✅ **設計完了** — README / requirements / design / tasks / PROGRESS を作成。
- ⬜ **Phase 1（Settings 画面 + 導線修正）未着手**。
- 👉 **次の着手**: [feature-plan](../../../.claude/skills/feature-plan/) で本設計書を最終計画化・承認取得 → tasks.md 1-A から。

---

## Phase 1: Settings 画面 + 導線修正 ⬜ 未着手

| Task | 内容 | 状態 | SKILL | コミット / 備考 |
|------|------|------|-------|----------------|
| 1-A | user-menu リンク修正 + sidebar エントリ（回帰テスト先行） | ⬜ | test-gen | AC-S3 / AC-S4 |
| 1-B | `/profile/settings` ページ追加（Clerk `<UserProfile />`） | ⬜ | test-gen | AC-S2 |
| 1-C | 品質チェック（lint/tsc/test + build） | ⬜ | test-complete | rule 02 必須 |
| 1-D | ドキュメント同期（統計 + dashboard 再生成） | ⬜ | spec-sync-after-test | QA_HANDOFF SSOT |
| 1-E | 最終ドリフト確認 | ⬜ | spec-sync-check | 任意 |

---

## SKILL 起動チェック（漏れ防止）

> 各フェーズ完了時に、対応 SKILL を起動したかをチェックする（rule 02 / 本設計書 tasks.md の SKILL シーケンス）。

- [ ] feature-plan（着手前・必須）
- [ ] test-gen（1-A / 1-B）
- [ ] test-complete（各コミット前）
- [ ] spec-sync-after-test（テスト数変動時・必須）
- [ ] spec-sync-check（最終・任意）
- [x] server-action-scaffold は **不要**（新規 action 無し）
- [x] safe-migration は **不要**（schema 変更無し）

---

## レビュー必須ポイント（着手前に確認）

- [ ] `routing="hash"` で MVP 要件を満たすか。
- [ ] `appearance` 調整がサイドバー 296px と干渉しないか。
- [ ] webhook 既存同期に回帰が無いか（変更しない前提）。
