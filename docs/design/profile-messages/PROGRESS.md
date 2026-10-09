# Profile Messages — 進捗トラッカ

> このファイルは [tasks.md](./tasks.md) の **Phase 進捗の SSOT**（どこまで完了し、次にどこから着手するか）。
> 全体の履歴・テスト統計は [docs/PROGRESS.md](../../PROGRESS.md)、統計の SSOT は [docs/testing/QA_HANDOFF.md](../../testing/QA_HANDOFF.md)。
> 要件は [requirements.md](./requirements.md)、設計は [design.md](./design.md)。

---

## 購入者画面のデザイン移行（2026-10-03、未コミット）

- 実装・検証・文書同期完了。[保存計画](../../../plans/layout-design/profile-messages-design-system-plan.md)、[移行証跡](../design-system/PROGRESS.md#profile-messages移行記録)。DS-PAGE-026/DS-COMP-090/202を検証済みへ。
- 関連Jest94/94（7 suites）、Chromium5/5（41.4s）、lint 0 errors/既存11 warnings、tsc成功。3幅/全状態/keyboard/axe AAとPC/モバイル画像目視。
- 新購入者action Props境界と専用hook/threadを導入。販売者/旧共有部品の移行は別対象。今回送信・既読はmockで、実店舗への送信なし。全体Jest/coverageは前回実測保持。
- 以下のPhase完了/AC-M8往復は初回機能実装の履歴として維持し、今回の実行結果と区別する。

## 🧭 現在地（2026-06-20・Phase 5 完了＝全フェーズ完了）

- ✅ **設計完了** — README / requirements / design / tasks / PROGRESS を作成。
- ✅ **Phase 1〜4 完了**（schema/migration → server actions + IDOR ユニット → 購入者 UI → 販売者 UI でループ閉鎖）。
- ✅ **Phase 5 完了**（E2E 往復 + ドキュメント同期）。`tests/e2e/messages.spec.ts`（AC-M8）で購入者送信 → 販売者返信 → 購入者ポーリング受信の往復を **2 browser context** で検証（`ea89706`）。3 ブラウザ対象・Chromium で往復通過確認・`CLERK_SECRET_KEY` 未設定時 `test.skip`。Playwright E2E（main）7 → 8 スペック。
- 🎉 **全フェーズ完了**。残課題は下記「残課題・将来拡張（スコープ外）」を参照。

---

## Phase 進捗

| Phase | 内容 | 状態 | 主 SKILL | 備考 |
|-------|------|------|----------|------|
| 1 | schema + migration（Conversation/Message）+ ERD 再生成 | ✅ | safe-migration / erd:generate | 非破壊 additive（`83eef3e` 系） |
| 2 | server actions 6種 + ユニットテスト（IDOR 3階層） | ✅ | server-action-scaffold / test-gen | AC-M1〜M7・`message.test.ts` +31（`fcbcb3d`〜`4d76eea`） |
| 3 | 購入者 UI（`/profile/messages`・ポーリング） | ✅ | test-gen | NFR-M4/M5・component +14（`e4e752d`〜`a20a313`） |
| 4 | 販売者 UI（seller dashboard・ループ閉鎖） | ✅ | test-gen | M-5・購入者 include + `StoreConversationWithLatest` 型 / seller page + container + 導線 / component +7（`8ab715e`〜`95d0005`） |
| 5 | E2E（往復）+ ドキュメント同期 | ✅ | test-complete / spec-sync-after-test / spec-sync-check | AC-M8・`messages.spec.ts`（2 context 往復・3 ブラウザ）`ea89706` |

---

## SKILL 起動チェック（漏れ防止）

> 各フェーズ完了時に、対応 SKILL を起動したかをチェックする（rule 02 / tasks.md の SKILL シーケンス）。

- [x] feature-plan（着手前・必須）
- [x] safe-migration（Phase 1・必須）
- [x] erd:generate（Phase 1・schema 変更と同一コミット・rule 03）
- [x] server-action-scaffold（Phase 2・各 action）
- [x] test-gen（Phase 2 ユニット / Phase 3・4 コンポーネント）
- [x] test-complete（各コミット前）
- [x] spec-sync-after-test（テスト数変動時・必須／Phase 5 で E2E スペック数 7→8 を同期）
- [x] spec-sync-check（最終・任意）

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

## 販売者メッセージのデザイン移行（2026-10-05）

DS-PAGE-056: 購入者名/画像での識別、最新メッセージが購入者発かつ未読の場合の表示、選択時の既読更新、取得/既読errorとretry、送信draft保持・成功後クリア/再取得、5秒poll/hidden/unmount/staleを維持。PC2ペイン、1000px以下で一覧/スレッド切替と戻りfocus復帰。共通thread/CSSをopt-in拡張し購入者の既定表示を維持、左右の購入者発判定を維持し販売者のsenderラベルをBuyer/Youにする。関連RTL40/40、補助Chromium6/6。認証後の実送受信/SDK実描画は保留。[販売者要件](../seller-ui-migration/requirements.md)／[証跡](../design-system/PROGRESS.md#優先7画面移行記録)。


## 購入後6画面の共通表示（2026-10-10）

[保存計画](../../../plans/layout-design/priority-six-p2-postpurchase-design-system-plan.md)。Red: 購入者supportのmessage固定色が注入linkへ追従せず失敗。Green/Refactor: postpurchase --grep messages 4/4（3幅、axe AA、thread failure/retry、長文、send pending/failure/draft保持/success、empty/list retry）；購入者と販売者RTL4 suites 31/31；tsc成功。今回の表示変更は補助検証済み。認証後実ルートは保存ログイン状態がなく保留。既存の検証履歴を上書きしない。
