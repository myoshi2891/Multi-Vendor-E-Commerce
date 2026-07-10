# 02. 現状分析 — 強み資産とボトルネック B-1〜B-10

> 位置づけ: [拡張計画ドキュメント群](README.md)の第2章。
> 統合元: Round 2 ブループリント §2 / Round 3 ブループリント §2。引用 file:line は
> 昇格時 HEAD `d6a8ede`（2026-07-10, branch `dev`）で再検証済み。
> 詳細な監査エビデンスは `plans/audit/findings-09/-10`（未追跡の advisor 作業領域）にある。

---

## 1. 強み — 再利用できる既存資産

拡張は白紙からではない。次の資産は Amazon 型マーケットプレイスの構造と既に整合しており、
**作り直さず土台として使う**:

| 資産 | 根拠 | 拡張時の意味 |
|---|---|---|
| **バリアントレベルの価格・在庫・画像**（Product → ProductVariant → Size） | `prisma/schema.prisma:130` 以降のカタログ階層 | Amazon の「親 ASIN / 子 ASIN」構造と同型。カタログの核は作り直し不要 |
| **店舗承認ワークフロー**（PENDING→ACTIVE + ロール昇格 + Clerk 同期の `$transaction`） | `src/queries/store.ts:531`（`updateStoreStatus`） | 状態遷移 + 副作用の原子化テンプレート。商品審査（柱④）・RMA（柱⑥）・自動措置（柱⑩）の設計雛形になる |
| **金額 Decimal(12,2) 規律・配送料 SSOT・auth-guards** | [`tech.md`](../../../.claude/steering/tech.md) | 拡張しても品質規約が既に効く |
| **レコメンドシグナルの収集**（views / sales / rating / Wishlist / 注文履歴） | スキーマ上に蓄積済み | データは貯まっている。活用層（柱⑤）を足すだけ |
| **`relatedProducts: []` の予約スロット** | `src/queries/product.ts:1080` | 商品ページの UI 契約が既にレコメンドを想定している |
| **`SupportTicket` + `RETURN_REQUEST` カテゴリ + 受付フォーム** | `prisma/schema.prisma:755` / `returns-exchange` ページ | RMA の受付面は在る。構造化（対象アイテム・状態機械）だけが欠落 |
| **`ProductStatus` に `Returned`/`Refunded`/`ExchangeRequested` 定義済み** | `prisma/schema.prisma:560` 以降の enum | RMA の解決が接続すべき状態は既に enum に在る |
| **PLATFORM スコープのクーポン + admin CRUD/UI + CAS 適用** | `src/queries/coupon.ts:349` 以降 / `dashboard/admin/coupons/` | 販促エンジン（柱⑧）の土台。キャンペーン層を上に足すだけ |
| **`Message.isRead`/`readAt` の既読管理パターン** | `prisma/schema.prisma:743-744` | アプリ内通知（柱⑨）の未読管理の実装先例 |
| **`OrderGroup.shippingDeliveryMin/Max`（配送約束のスナップショット）** | `prisma/schema.prisma:536-537` | 遅延率計測（柱⑩）の「約束」側は在る。「実績」側だけがない |

---

## 2. ボトルネック — 拡張を阻む構造的制約 B-1〜B-10

B-1〜B-5 はカタログ基盤・発見性（Round 2 監査 E-1〜E-5）、B-6〜B-10 は運用・信頼・成長
（Round 3 監査 O-1〜O-5）に対応する。**解消時は行を削除せず、解消済みマークと参照を付す**
（[README の更新規約](README.md#更新規約)）。

| # | 制約 | 根拠 | 影響 | 解消する柱 |
|---|---|---|---|---|
| B-1 | **カテゴリが固定2階層**（Category→SubCategory、self-relation なし） | `prisma/schema.prisma` の Category/SubCategory | 「家電 > カメラ > レンズ > 単焦点」が表現不能。総合モールの部門構造が組めない | ① |
| B-2 | **商品属性が自由記述 Spec**（型なし・カテゴリ非依存・検索非参照） | Spec モデル | ファセット検索・商品比較・構造化データが成立しない。表記揺れが蓄積 | ② |
| B-3 | **検索が2系統併存で貧弱**（tsvector は name+description のみ / ブラウズは ILIKE、ファセット集計なし、価格ソートなし） | `src/queries/product.ts:602`（`filters: any`）ほか | SKU 増加とともに「探せない」が顕在化。tsvector が式評価でインデックスも無い | ③ |
| B-4 | **商品レベルの審査・公開制御がない**（保存即公開。BANNED 店舗の商品露出も未検証） | 公開クエリに店舗状態の共通 where なし | 販売者数が増えるとカタログ品質と信頼性が守れない | ④ |
| B-5 | **シグナル未活用**（relatedProducts 常に空） | `src/queries/product.ts:1080` | 回遊・クロスセルの機会損失。単品ページが行き止まり | ⑤ |
| B-6 | **返品が自由記述チケット止まり**（RMA エンティティ・状態機械なし） | `SupportTicket` のみ | 返品体験が運営の手作業に比例。返金実行が接続する上流が存在しない | ⑥ |
| B-7 | **レビューの信頼装置がない**（購入検証・モデレーション・通報・集計の原子性） | Review モデル / `Store.averageRating` は死にフィールド | UGC が増えるほど信頼が毀損するリスク | ⑦ |
| B-8 | **販促がクーポンのみ**（キャンペーン構造・価格履歴・利用制限なし） | Coupon モデル / 販売者自己申告の `isSale` | プラットフォーム主導のセールイベントが企画できない。二重価格の根拠データもない | ⑧ |
| B-9 | **通知基盤ゼロ**（Notification モデルなし・メール送信手段なし・pull 型のみ） | スキーマに Notification 不在 | 審査・RMA・サポートがそれぞれ個別実装に向かい発火点が散乱する | ⑨ |
| B-10 | **セラー品質シグナルの不在**（事実タイムスタンプなし・メトリクス未集約） | OrderItem/OrderGroup に `shippedAt`/`deliveredAt` 相当なし | BANNED/DISABLED という措置だけあり判断根拠がない。品質の自己調整が働かない | ⑩ |

---

## 3. 依存の骨格 — フェーズ順序を規定する鎖

- **B-1 → B-2 → B-3 は依存の鎖**である: 属性はカテゴリに紐づき、ファセットは属性に紐づく。
  逆順で作ると手戻りが確定する。これが [05. ロードマップ](05-phased-roadmap.md)の
  Phase A → B の順序を規定する
- **B-9（通知）は B-6（RMA）と B-4（審査）の共通前提**: 先に通知の seam を確定させないと、
  各ワークフローが独自の発火実装を持ち始める
- **B-7 と B-10 は評価集計の欠陥を共有**する: レビュー集計の修正（柱⑦）がセラー指標（柱⑩）の
  シグナル1系統を供給する。順序は ⑦ → ⑩
- **B-8 は独立**: 既存 PLATFORM クーポン基盤の上に立ち、他のボトルネックに依存しない
