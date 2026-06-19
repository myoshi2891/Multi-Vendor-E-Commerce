# Profile Messages（`/profile/messages`）— 設計書

> 購入者↔販売者のメッセージ（チャット）画面。新規 Prisma モデル（Conversation/Message）+ ポーリング更新で構成する。
> 出典: [`docs/unimplemented-screens-plan.md`](../../unimplemented-screens-plan.md) 「C. 顧客アカウント・メニュー」優先度=中。

---

## 読み順

1. [requirements.md](./requirements.md) — 何を満たすか（要件・受け入れ基準 AC・非機能）
2. [design.md](./design.md) — どう実装するか（中核。schema・server actions・IDOR・UI・ポーリング・影響箇所）
3. [tasks.md](./tasks.md) — どの順で作るか（TDD フェーズ・**SKILL 呼び出し**・コミット粒度）
4. [PROGRESS.md](./PROGRESS.md) — 進捗 SSOT（Phase 単位の現在地）

---

## スコープ境界

| | 含む | 含まない（後続フェーズ） |
|---|---|---|
| **対話相手** | 購入者（USER）↔ 販売者（Store オーナー） | 運営サポート（ADMIN）窓口 |
| **更新方式** | ポーリング（5s 間隔・`cancelled` フラグ） | リアルタイム（WebSocket/Pusher） |
| **画面** | 顧客側 `/profile/messages`（主）+ 販売者側 seller dashboard（返信用・最小） | 添付ファイル・画像・既読インジケータの高度化 |
| **起点** | 任意の店舗、または注文（`orderId` 任意） | 商品ページからの問い合わせボタン（別 PR） |

---

## 核心判断（詳細は design.md の判断章）

| 判断 | 結論 | 理由 |
|------|------|------|
| データモデル | **新規 `Conversation` / `Message`** | 既存 User/Store/Order に直接持たせるのは保守性・IDOR 上不可。`@@unique([userId, storeId])` で購入者×店舗1スレッド |
| `senderRole` カラム | **持たない** | `senderId === conversation.userId` で購入者/販売者を導出（モデル簡素化） |
| 認可 | **カスタム参加者チェック**（private helper） | `requireUser`/`requireStoreOwner` 単独では表現できない「会話の参加者か」検証が IDOR の核心 |
| 更新方式 | **ポーリング** | 外部依存ゼロ・CI 安定・tech.md の `useEffect` cancelled パターンを流用 |
| 販売者返信 | **seller dashboard に最小ページ** | ループを閉じて E2E 検証可能にする（同じ server actions を共有） |

---

## 規模感

- **schema**: 新規 2 モデル + 逆リレーション（`safe-migration` 必須・**非破壊 additive**）
- **server action**: `src/queries/message.ts` に 6 関数（`server-action-scaffold` 起動）
- **UI**: 顧客 1 ページ + 2 コンポーネント、販売者 1 ページ（+container）
- **テスト**: ユニット（IDOR 3階層含む）+ E2E（往復）
- **フェーズ**: 5（schema → server actions → 顧客 UI → 販売者 UI → E2E+同期）

---

## 関連

- 規約: [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md)（TDD・コミット粒度・spec-sync）
- 規約: [`.claude/rules/03-data-model-diagram-sync.md`](../../../.claude/rules/03-data-model-diagram-sync.md)（schema 変更時の ERD 再生成）
- 認可: [`src/lib/auth-guards.ts`](../../../src/lib/auth-guards.ts)
- 姉妹設計書: [`docs/design/profile-settings/`](../profile-settings/)（同じ顧客メニュー C の Settings 画面）
- 雛形: [`docs/design/admin-dashboard/`](../admin-dashboard/)（特に Phase 5 の破壊的変更隔離パターン）
