# Support Forms — 要件（requirements.md）

> 記法: EARS 風（`When/While/The system shall`）。受け入れ基準は `AC-SF<n>`。
> 設計は [design.md](./design.md)、実装手順は [tasks.md](./tasks.md)。

---

## 1. 機能要件

| ID       | 要件（EARS 風）                                                                                                                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SF-1** | 任意の訪問者（ゲスト含む）が `/contact` でフォームに氏名・メール・件名・本文を入力し送信したとき、システムは `category=CONTACT` の `SupportTicket` を作成しなければならない。                               |
| **SF-2** | 訪問者が `/returns-exchange` で対象注文番号・氏名・メール・理由を入力し送信したとき、システムは `category=RETURN_REQUEST`・`orderId` 付きの `SupportTicket` を作成しなければならない。                      |
| **SF-3** | 訪問者が `/dispute` で対象注文番号・申立内容を入力し送信したとき、システムは `category=DISPUTE`・`orderId` 付きの `SupportTicket` を作成しなければならない。                                                |
| **SF-4** | 訪問者が `/report-problem` で問題内容を入力し送信したとき、システムは `category=PROBLEM_REPORT` の `SupportTicket` を作成しなければならない。                                                               |
| **SF-5** | While ユーザーがログイン中、送信時にシステムは `SupportTicket.userId` に現在のユーザー ID を設定しなければならない。                                                                                        |
| **SF-6** | When 必須項目が欠落・不正なとき、システムは Zod 検証で送信を拒否し、フォーム上にフィールド別エラーを表示しなければならない。                                                                                |
| **SF-7** | When `category` が `RETURN_REQUEST` または `DISPUTE` のとき、システムは `orderId` を必須として検証しなければならない。                                                                                      |
| **SF-8** | 送信が成功したとき、システムは成功メッセージ（受付確認）を表示しなければならない。                                                                                                                          |
| **SF-9** | ユーザーメニューの「Order Dispute Resolution」「Report a Problem」「Return & Refund Policy」リンクは、それぞれ `/dispute` `/report-problem` `/returns-exchange` を指さなければならない（現状 `""` / `/`）。 |

---

## 2. 受け入れ基準（AC）

| ID         | 受け入れ基準                                                                                                                                | 検証方法                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **AC-SF1** | 有効な入力（`category: "CONTACT"`）で `createSupportTicket(input)` を呼ぶと `db.supportTicket.create` が `category=CONTACT` で1件作成する。 | ユニット（Prisma モック） |
| **AC-SF2** | `RETURN_REQUEST`/`DISPUTE` で `orderId` 未指定だと Zod が reject し、`create` が呼ばれない。                                                | ユニット                  |
| **AC-SF3** | ログイン時、作成データの `userId` が現在ユーザー ID になる（`currentUser()` モック）。                                                      | ユニット                  |
| **AC-SF4** | 未ログイン時、`userId` は `null`／未設定で作成される（ゲスト送信可）。                                                                      | ユニット                  |
| **AC-SF5** | 各フォームページが描画され、必須フィールド未入力で submit するとエラー表示され `action` が呼ばれない。                                      | コンポーネント（RTL）     |
| **AC-SF6** | 二重 submit してもリエントランシーガードにより `action` は1回だけ呼ばれる。                                                                 | コンポーネント            |
| **AC-SF7** | user-menu の該当3リンクが正しいルートを指す（回帰）。                                                                                       | RTL（回帰）               |

---

## 3. 非機能要件（NFR）

| ID                              | 内容                                                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NFR-SF1**（セキュリティ）     | 外部入力は Zod で必ず検証（global CLAUDE.md）。`email` 形式検証・本文長上限。PII（メール本文）はログ出力しない。                                                       |
| **NFR-SF2**（コード規約）       | `any` 禁止・`console.log` 禁止。server action は `src/queries/support.ts` に集約（`src/queries/` 以外で定義しない）。外部呼び出し（Prisma）は try/catch + 構造化ログ。 |
| **NFR-SF3**（アトミック）       | 単一テーブル作成のため `$transaction` 不要（複数テーブル更新が無い）。                                                                                                 |
| **NFR-SF4**（リエントランシー） | クライアントは `useRef` フラグで二重送信防止（[tech.md / newsletter.tsx](../../../src/components/store/layout/footer/newsletter.tsx)）。                               |
| **NFR-SF5**（DB 規約）          | 金額フィールドは扱わない。`message` は `@db.Text`。`safe-migration` で `migrate dev`（`db push` 禁止）。ERD 再生成（rule 03）。                                        |
| **NFR-SF6**（TDD）              | [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md) 遵守。                                                                           |

---

## 4. スコープ外

- 外部メール通知（運営への即時メール）→ DB に保存し、管理者は後続の閲覧 UI で確認（本 MVP は保存まで）。
- 管理者向けチケット閲覧・ステータス更新画面（`status` 列は用意するが操作 UI は follow-up）。
- 添付ファイル・画像アップロード。
- reCAPTCHA / レート制限（総当たり・スパム対策は follow-up）。
- 返品の在庫戻し・返金処理（Stripe/PayPal 連携）は本フォームのスコープ外（運営手続き）。
