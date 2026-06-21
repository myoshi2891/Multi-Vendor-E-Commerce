# Track Order — 設計書

> 注文追跡画面（`/track-order`）。注文番号 + メールアドレスで配送状況を照会する公開フォーム。
> 出典: [`docs/unimplemented-screens-plan.md`](../../unimplemented-screens-plan.md) 「D. 静的ページ・補助画面・カスタマーサービス」優先度=中。

---

## 読み順

1. [requirements.md](./requirements.md) — 何を満たすか（要件・受け入れ基準 AC・非機能）
2. [design.md](./design.md) — どう実装するか（中核。照合方式・IDOR・server action・UI・影響箇所）
3. [tasks.md](./tasks.md) — どの順で作るか（TDD フェーズ・**SKILL 呼び出し**・コミット粒度）
4. [PROGRESS.md](./PROGRESS.md) — 進捗 SSOT（Phase 単位の現在地）

---

## 対象画面（1 画面）

| 画面                    | ルート         | 現状リンク                       | 優先度 |
| ----------------------- | -------------- | -------------------------------- | ------ |
| Track Order（注文追跡） | `/track-order` | footer「Track your Order」配線済 | 中     |

---

## スコープ境界

|          | 含む                                            | 含まない（後続・別 PR）                         |
| -------- | ----------------------------------------------- | ----------------------------------------------- |
| **照会** | 注文番号 + メールで自分の注文の配送状況を照会   | 配送業者 API 連携（リアルタイム追跡番号）       |
| **表示** | order/group/item の各ステータス + 配送予定日数  | 地図・配送業者トラッキング画面の埋め込み        |
| **認証** | 公開（ログイン不要・番号 + メールで本人性確認） | ログイン必須化（既存 `/profile/orders` が担当） |
| **保護** | IDOR ハードニング（汎用 not found）             | レート制限・reCAPTCHA → follow-up               |

---

## 核心判断（詳細は design.md の判断章）

| 判断            | 結論                                           | 理由                                                                                                                         |
| --------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 照合キー        | **`orderId` + `email`（`User.email` と照合）** | `Order.userId` は非 null（ゲスト注文なし）。`ShippingAddress` に email は無く（`phone` のみ）、email は `User.email` のみ    |
| 情報漏洩防止    | **不一致・不存在を区別せず汎用「not found」**  | 注文 id の存在有無を漏らさない（IDOR/列挙防止）                                                                              |
| email 照合      | **大文字小文字無視（lowercase 比較）**         | ユーザーが入力する email の表記揺れを吸収                                                                                    |
| 認可            | **公開（`requireUser` を付けない）**           | 番号 + メールでの本人性確認に委ねる。ゲスト購入は無いがログインせず追跡したい需要に対応                                      |
| `force-dynamic` | **不要**                                       | page は client フォーム。DB 読取は submit 時の server action 内（[tech.md 規約](../../../.claude/steering/tech.md)の対象外） |

---

## 規模感

- **server action**: 既存 `src/queries/order.ts` に `trackOrder({ orderId, email })` を 1 本追加（`getOrder` の include を流用・**migration なし**）。
- **Zod**: `src/lib/schemas.ts` に `TrackOrderSchema`。
- **UI**: `/track-order/page.tsx` + 照会フォーム client 部品 + 結果表示部品（既存注文詳細部品の流用可否を調査）。
- **テスト**: ユニット（一致時返却 / email 不一致で not found / 不存在 id で not found・IDOR 3 階層）+ コンポーネント（フォーム）。
- **フェーズ**: 2（server action + Zod → UI）。

---

## 関連

- 規約: [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md)（TDD・コミット粒度・spec-sync）
- セキュリティ: [`docs/testing/SECURITY_GAP_REPORT.md`](../../testing/SECURITY_GAP_REPORT.md)（IDOR 3 階層テストパターン §5.2）
- 雛形: [`docs/design/profile-messages/`](../profile-messages/)（IDOR テスト 3 階層の流用元）
- 流用元: [`src/queries/order.ts`](../../../src/queries/order.ts)（`getOrder` の include 形）
- 姉妹設計書: [`docs/design/storefront-static-pages/`](../storefront-static-pages/)（customer-service ポータルからの遷移元）
