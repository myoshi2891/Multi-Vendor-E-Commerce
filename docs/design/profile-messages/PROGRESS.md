# Profile Messages — 進捗トラッカ

> このファイルは [tasks.md](./tasks.md) の **Phase 進捗の SSOT**（どこまで完了し、次にどこから着手するか）。
> 全体の履歴・テスト統計は [docs/PROGRESS.md](../../PROGRESS.md)、統計の SSOT は [docs/testing/QA_HANDOFF.md](../../testing/QA_HANDOFF.md)。
> 要件は [requirements.md](./requirements.md)、設計は [design.md](./design.md)。

---

## 🧭 現在地（2026-06-19・Phase 3 完了）

- ✅ **設計完了** — README / requirements / design / tasks / PROGRESS を作成。
- ✅ **Phase 1〜3 完了**（schema/migration → server actions + IDOR ユニット → 購入者 UI + ポーリング）。
- ⬜ **Phase 4〜5 未着手**（販売者 UI → E2E + ドキュメント同期）。
- 👉 **次の着手**: Phase 4（販売者 UI）。`dashboard/seller/stores/[storeUrl]/messages/` を新規実装し、`conversation-thread.tsx` を流用して双方向ループを閉じる（返信は共有 `sendMessage`）。

---

## Phase 進捗

| Phase | 内容 | 状態 | 主 SKILL | 備考 |
|-------|------|------|----------|------|
| 1 | schema + migration（Conversation/Message）+ ERD 再生成 | ✅ | safe-migration / erd:generate | 非破壊 additive（`83eef3e` 系） |
| 2 | server actions 6種 + ユニットテスト（IDOR 3階層） | ✅ | server-action-scaffold / test-gen | AC-M1〜M7・`message.test.ts` +31（`fcbcb3d`〜`4d76eea`） |
| 3 | 購入者 UI（`/profile/messages`・ポーリング） | ✅ | test-gen | NFR-M4/M5・component +14（`e4e752d`〜`a20a313`） |
| 4 | 販売者 UI（seller dashboard・ループ閉鎖） | ⬜ | test-gen | M-5 |
| 5 | E2E（往復）+ ドキュメント同期 | ⬜ | test-complete / spec-sync-after-test / spec-sync-check | AC-M8 |

---

## SKILL 起動チェック（漏れ防止）

> 各フェーズ完了時に、対応 SKILL を起動したかをチェックする（rule 02 / tasks.md の SKILL シーケンス）。

- [ ] feature-plan（着手前・必須）
- [ ] safe-migration（Phase 1・必須）
- [ ] erd:generate（Phase 1・schema 変更と同一コミット・rule 03）
- [ ] server-action-scaffold（Phase 2・各 action）
- [ ] test-gen（Phase 2 ユニット / Phase 3・4 コンポーネント）
- [ ] test-complete（各コミット前）
- [ ] spec-sync-after-test（テスト数変動時・必須）
- [ ] spec-sync-check（最終・任意）

---

## レビュー必須ポイント（着手前に確認）

- [ ] 会話一意キー `(userId, storeId)` で MVP 要件を満たすか。
- [ ] ポーリング 5s 間隔が運用上妥当か。
- [ ] 販売者返信を seller dashboard に置く構成で E2E が成立するか。
- [ ] `assertParticipant` が取得/送信/既読の全関数で漏れなく呼ばれているか（IDOR）。

---

## 残課題・将来拡張（スコープ外）

- 運営サポート（ADMIN）チャネル（`ConversationType` enum 追加）。
- リアルタイム配信（WebSocket/Pusher）。
- 添付・画像・タイピングインジケータ・プッシュ通知。
- 商品/注文画面からの問い合わせ起点ボタン（`getOrCreateConversation` を利用）。
