# Support Forms — 設計書

> サポート系フォーム画面群（`/contact` / `/returns-exchange` / `/dispute` / `/report-problem`）。
> 単一の `SupportTicket` Prisma モデルに統合し、1 本の server action `createSupportTicket(input)`（`input.category` で 4 種を識別）で受ける。
> 出典: [`docs/unimplemented-screens-plan.md`](../../unimplemented-screens-plan.md) 「D. 静的ページ・補助画面・カスタマーサービス」優先度=高（contact）〜低。

---

## 読み順

1. [requirements.md](./requirements.md) — 何を満たすか（要件・受け入れ基準 AC・非機能）
2. [design.md](./design.md) — どう実装するか（中核。schema・Zod・server action・各フォーム・影響箇所）
3. [tasks.md](./tasks.md) — どの順で作るか（TDD フェーズ・**SKILL 呼び出し**・コミット粒度）
4. [PROGRESS.md](./PROGRESS.md) — 進捗 SSOT（Phase 単位の現在地）

---

## 対象画面（4 フォーム）

| 画面                                     | ルート                    | 現状リンク                                              | category         | 優先度 |
| ---------------------------------------- | ------------------------- | ------------------------------------------------------- | ---------------- | ------ |
| Contact（お問い合わせ）                  | `/contact`                | footer 配線済                                           | `CONTACT`        | **高** |
| Returns & Exchange（返品交換リクエスト） | `/returns-exchange`       | footer 配線済 / user-menu「Return & Refund Policy」=`/` | `RETURN_REQUEST` | 中     |
| Order Dispute Resolution（注文紛争申請） | `/dispute`（確定）        | user-menu `""`                                          | `DISPUTE`        | 低     |
| Report a Problem（問題報告）             | `/report-problem`（確定） | user-menu `""`                                          | `PROBLEM_REPORT` | 低     |

> `/returns-exchange` はフォーム部のみ本設計の対象。返品ポリシー**本文**は静的扱いで [storefront-static-pages](../storefront-static-pages/) と相互参照（ページ上部にポリシー要約、下部にリクエストフォーム）。

---

## スコープ境界

|            | 含む                                                                   | 含まない（後続・別 PR）                              |
| ---------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| **送信**   | ゲスト/ログイン双方からの送信を `SupportTicket` に永続化               | 外部メール通知（Resend 等）・添付ファイル            |
| **データ** | 新規 `SupportTicket` モデル + `SupportTicketCategory` enum（additive） | 既存テーブルの破壊的変更                             |
| **認可**   | 送信は公開。ログイン時は `userId` 付与                                 | 管理者の閲覧/対応 UI（`status` 更新画面）→ follow-up |
| **検証**   | Zod（category 別 refinement） + リエントランシーガード                 | reCAPTCHA / レート制限 → follow-up                   |

---

## 核心判断（詳細は design.md の判断章）

| 判断                  | 結論                                          | 理由                                                                                                                                                    |
| --------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| データモデル          | **単一 `SupportTicket` + `category` enum**    | 4 フォームはフィールドがほぼ共通（name/email/subject/message + 任意 orderId）。1 テーブルで migration・server action・テストを集約（DRY・ユーザー選択） |
| `senderRole` 的カラム | **持たない**。`userId String?` のみ           | ゲスト送信を許容。ログイン時のみ Clerk から `userId` を付与                                                                                             |
| server action         | **1 本 `createSupportTicket(input)`**         | `category` は `input` のフィールド。Zod の `superRefine` で分岐し、4 本に増やさない                                                                     |
| `orderId` の必須性    | **RETURN_REQUEST / DISPUTE で必須、他は任意** | 返品・紛争は対象注文が前提。Zod の `superRefine` で表現                                                                                                 |
| 認可                  | **送信は公開（認可ガード無し）**              | 問い合わせはゲストも行う。`requireUser` を**付けない**（[design §判断3](./design.md)）                                                                  |

---

## 規模感

- **schema**: 新規 1 モデル + 1 enum + `User`/`Order` への任意逆リレーション（**additive・非破壊** / `safe-migration` 必須 / ERD 再生成）。
- **Zod**: `src/lib/schemas.ts` に `SupportTicketSchema`（+ category enum）。
- **server action**: `src/queries/support.ts` に `createSupportTicket` 1 本（`server-action-scaffold` 起動）。
- **UI**: フォーム 4 ページ + 共有フォーム部品 1（`SupportForm`）。
- **テスト**: ユニット（正常作成 / 不正却下 / category 別 orderId 必須）+ コンポーネント（描画 + 二重送信防止）。
- **フェーズ**: 3（schema → server action + Zod → UI 4 ページ）。

---

## 関連

- 規約: [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md)（TDD・コミット粒度・spec-sync）
- 規約: [`.claude/rules/03-data-model-diagram-sync.md`](../../../.claude/rules/03-data-model-diagram-sync.md)（schema 変更時の ERD 再生成）
- 雛形: [`docs/design/profile-messages/`](../profile-messages/)（additive migration + server action + Zod + IDOR テストの流用元）
- 認可: [`src/lib/auth-guards.ts`](../../../src/lib/auth-guards.ts)
- 姉妹設計書: [`docs/design/storefront-static-pages/`](../storefront-static-pages/)（returns ポリシー本文・customer-service ポータルからの遷移元）
- 姉妹設計書: [`docs/design/track-order/`](../track-order/)（`orderId` の検証・IDOR 防止・enumeration（注文番号総当たり）対策はそちらで扱う。本設計は所有権を**検証しない**前提（[design §1.3](./design.md)）なので、本人性を伴う注文照会は track-order を参照）
