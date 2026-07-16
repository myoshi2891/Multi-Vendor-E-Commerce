# Findings 10 — Direction 拡張 recon 第2弾: 運用・信頼・成長（Round 3）

> **Round 3**（improve スキル `next` バリアント / 2026-07-10 / HEAD `86c04a1`）の recon エビデンス集。
> 目的: Round 2（カタログ基盤と発見性 — [`findings-09`](findings-09-direction-expansion.md)）が
> 扱わなかった **運用（Operations）・信頼（Trust）・成長（Growth）** 領域のブループリント
> （[`../direction/OPERATIONS_TRUST_GROWTH_BLUEPRINT.md`](../direction/OPERATIONS_TRUST_GROWTH_BLUEPRINT.md)）
> と spike プラン 018〜022 が引用する**現行コードの事実**を1箇所に集約する。
> 引用はすべて本体ファイルの再読から転記（HEAD `86c04a1` 時点。Round 2 の `a17e2cc` 以降
> ソースコードは無変更 — 差分は `docs(plans):` コミットのみ）。
> Round 1 の DIRECTION-01〜05（返金実行 / restock / サポートコンソール / i18n / 監視）は
> [`findings-08-direction.md`](findings-08-direction.md) 参照 — 本ファイルはそれらと重複しない。

---

## O-1: 返品・交換 — 自由記述チケット受付のみ（構造化 RMA ワークフローなし）

**受付の現状** — 返品・交換申請は静的ページ + 汎用サポートフォームで受け付ける:

- `src/app/(store)/returns-exchange/page.tsx:1-33` — 静的ポリシー要約
  （`RETURNS_POLICY_SUMMARY` 定数）+ `<SupportForm category="RETURN_REQUEST" ...>`。
- 受け皿は `SupportTicket`（`prisma/schema.prisma:755-781`）:

```prisma
model SupportTicket {           // schema.prisma:755
  category SupportTicketCategory   // CONTACT / RETURN_REQUEST / DISPUTE / PROBLEM_REPORT
  name / email / subject / message // 自由記述
  orderId String?                  // RETURN_REQUEST / DISPUTE のみ必須（Zod で強制）。注文への任意参照
  status String @default("OPEN")   // 「運営対応ステータス。閲覧 UI は後続（本 MVP は保存のみ）」
}
```

- `createSupportTicket`（`src/queries/support.ts:16`）は**保存のみ**。スキーマコメント通り
  閲覧・対応 UI は未実装（= DIRECTION-03 サポートコンソールの領域）。

**構造化されていないもの**:

1. **アイテム単位の返品対象指定がない** — `orderId` 参照のみで、どの `OrderItem` を何個
   返すのかをデータで持てない（message 自由記述に埋まる）。
2. **理由コード・承認フロー・返送手順・解決種別（返金/交換/店舗クレジット）がない** —
   `status String`（自由文字列）だけで、RMA のライフサイクル
   （申請 → 承認/却下 → 返送待ち → 受領検品 → 解決）を表現する状態機械がない。
3. **既存の状態遷移との接続がない** — `ProductStatus` enum（`schema.prisma:560-610`）には
   `Returned` / `Refunded` / `ExchangeRequested` が定義済みだが、遷移させる手段は
   販売者/管理者による手動ステータス変更のみ:
   - `updateOrderItemStatus`（`src/queries/order.ts:229`）/ `updateOrderGroupStatus`
     （`order.ts:164-214`）— SELLER の店舗所有権検証つき手動更新。任意ステータスへ
     遷移可能（遷移可否の状態機械ガードなし）。
   - admin 版 `updateOrderItemStatusAsAdmin`（`order.ts:521`）の実装中に
     「`// TODO(在庫連動・スコープ外): status が Canceled/Returned のとき在庫復元フックをここに（判断5-2）`」
     （`order.ts:538`）— restock は plan 012 の spike 対象として既知。
4. **顧客側の進捗可視化がない** — 顧客が使えるのは `trackOrder`（`order.ts:98`、
   orderId + email 照合の pull 型照会）のみ。返品申請後の状態は見えない。

**含意（spike 018 の出発点）**: チケット（受付）は在る・状態 enum も在る・restock spike も在る。
欠けているのは三者を繋ぐ **RMA エンティティ（対象 OrderItem・数量・理由・解決種別・状態機械）**
と顧客/販売者/運営それぞれの操作面。DIRECTION-01（返金実行）はこの下流に位置する。
配送キャリア連携はスコープ外のため、返送追跡は追跡番号の手入力を前提に設計する。

## O-2: レビュー・UGC — 購入検証・モデレーション・通報の不在

**スキーマ** — `prisma/schema.prisma:353-391`:

```prisma
model Review {                 // schema.prisma:353
  variant / review / rating Float / color / size / quantity
  likes Int @default(0)        // ← 参照・更新する query が存在しない（死にフィールド）
  images ReviewImage[]
  @@unique([userId, productId]) // 1ユーザー1商品1レビュー
}
```

- **モデレーション状態がない**: 公開/非公開・審査中・通報済みの区別が存在せず、
  作成即公開。通報（report abuse）の受け皿もない
  （`SupportTicketCategory.PROBLEM_REPORT` は汎用自由記述で、レビュー ID 参照を持たない）。
- **購入者確認（verified purchase）がない**: `upsertReview`（`src/queries/review.ts:15-144`）は
  認証チェックのみで、**対象商品の購入履歴を検証しない**（任意の認証ユーザーが任意の商品に
  レビュー可能）。Round 1 SECURITY-09 で「purchase verification」は LOW confidence として
  rejected 済み — 脆弱性ではなく**信頼機能の骨組み欠如**として再定義する。
- **評価集計が非アトミック**: `upsertReview` は upsert 後に全レビューを `findMany` →
  JS の `reduce` で float 加算 → `product.update`（`review.ts:106-131`）。`$transaction` なし・
  並行レビューでロストアップデート可能・`rating Float`（Decimal 規律の対象外だった歴史的経緯）。
- **`Store.averageRating` / `numReviews`（`schema.prisma:93-94`）を更新する query を
  確認できず、実質的に更新されない見込み**（`@default(0)` のまま据え置かれる）:
  - 確認範囲: `grep -rn "averageRating" src/ prisma/` の結果、ヒットは
    **read（`select` / 型定義 / 表示）のみ**で **write は 0 件**。
    読むのは `getStorePageDetails`（`store.ts:719`）/ `index-products/route.ts:210,329` /
    `store-details.tsx:12,49`。
  - `src/queries/store.ts:15` のコメントは `averageRating` / `numReviews` を
    **特権フィールドとして upsert から除外**する旨を明記しており（plan 002 の allowlist）、
    「クライアントからは書けない」ことは意図的。ただし**サーバー側にも書き手がいない**。
  - `upsertReview`（`review.ts:106-131`）が更新するのは **`Product.rating` / `numReviews`** で、
    **Store 側の集計は供給していない**。
  > **「常に 0」と断定はしない**: 上記はアプリケーションコード内に更新経路が
  > 見当たらないことを示すに留まり、DB 上の実値がすべて 0 であることの証明ではない
  > （seed / 手動 SQL / 過去のマイグレーションで値が入っている可能性は
  > コードからは排除できない）。**実値の確認が必要なら本番/開発 DB で
  > `SELECT DISTINCT "averageRating" FROM "Store"` を実行すること**。
  > いずれにせよ **spike 019 / 022 の論点（Store 評価の集計を誰が供給するか）は
  > 実値に関わらず成立する**（供給元が無いこと自体が設計ギャップ）。
- **`likes Int` に対応する操作・per-user 記録（ReviewLike モデル等）がない** — 二重 like 防止不能。
- **Q&A は販売者の静的 FAQ**: `Question`（`schema.prisma:274-286`）は `question`/`answer` を
  商品フォームで販売者が同時入力する構造で、**顧客が質問を投稿するフローではない**
  （userId カラム自体がない）。

**含意（spike 019 の出発点）**: Amazon 級の「レビューが信頼を作る」構造には
(a) 購入検証バッジ、(b) モデレーション状態機械 + 通報、(c) アトミックな評価集計
（Product と Store の両方）、(d) helpful 投票の per-user 化 — の4点セットが骨組み。
審査ポリシー（事前/事後/無審査）は spike 016 と同じ「ポリシーをデータで差し替え」原則に従う。

## O-3: プロモーション — 店舗/プラットフォームのクーポンのみ（キャンペーン構造なし）

**在るもの**:

- `Coupon`（`schema.prisma:670-691`）: `scope CouponScope @default(STORE)` —
  `STORE` / `PLATFORM` の2スコープ（`schema.prisma:665-668`）。
- PLATFORM クーポンは admin 専用 CRUD（`getAllCoupons` / `upsertCouponAsAdmin` /
  `deleteCouponAsAdmin` / `toggleCouponActive` — `src/queries/coupon.ts:349-486`）+
  admin UI（`src/app/dashboard/admin/coupons/`）が存在。
- SELLER の scope 偽装は防御済み（「scope はクライアント入力を信用せず STORE に固定する」
  `coupon.ts:79`、cross-store/PLATFORM hijack 防御 `coupon.ts:44-57`）。
- `applyCoupon`（`coupon.ts:212`）は PLATFORM = 全店舗 / STORE = 対象店舗のみに適用
  （`coupon.ts:266-267`）。CAS による並行適用対策は修正済み資産 —
  **ただし保護範囲は限定的**（spike 020 が上に積む設計をする前に、何が守られていて
  何が守られていないかを取り違えないこと）:
  | 対象 | CAS が守るか | 補足 |
  |---|---|---|
  | **同一 `couponId` の重複適用** | **守る** | CAS（compare-and-set）が `cart.couponId` の遷移を条件付きにするため、並行リクエストで同じクーポンが二重適用されない。`SECURITY_GAP_REPORT.md` の既修正資産 |
  | **`cart.total` のロストアップデート** | **守らない（範囲外）** | 別途 recon で**既知の追跡課題**として挙げられている（[`findings-01-correctness.md`](findings-01-correctness.md) 冒頭の除外リストにも「applyCoupon total ロストアップデート」と明記）。CAS は couponId の適用可否を制御するだけで、total の read-modify-write を原子化しない |
  > つまり「CAS があるからクーポン適用は並行安全」ではない。**couponId の重複適用は
  > 防げるが、金額（`cart.total`）の更新は依然としてロストアップデートしうる**。
  > promotion engine（spike 020）が複数プロモーションの合成や再計算を導入すると、
  > この未保護の read-modify-write に**新しい書き手が増える**ため、
  > spike の設計時に total の原子性を明示的に扱うこと。
- バリアントセール: `ProductVariant.isSale Boolean @default(false)` + `saleEndDate String?`
  （`schema.prisma:178-179`）、サイズ別値引き `Size.discount Float @default(0)`
  （`schema.prisma:205`）。ストアフロントは `isSale` のとき `saleEndDate` を表示に渡す
  （`src/queries/product.ts:256-257,407-409,1052`）。
- `OfferTag`（`schema.prisma:245-254`）: 手動マーチャンダイジングタグ（name/url のみ）。

**欠けているもの**:

1. **クーポンの表現力**: `discount Int`（パーセントのみ — 固定額引きなし）、
   `startDate String` / `endDate String`（**文字列日付** — DB レベルの型・TZ 保証なし）、
   利用回数上限（全体/ユーザー毎）・最低購入額・対象カテゴリ/商品絞り込み・併用可否が**すべてない**。
2. **プラットフォーム主導キャンペーンの構造がない**: 「タイムセール」「季節イベント」を
   束ねるエンティティ（期間・対象商品・割引率・在庫枠）が存在しない。現状の「セール」は
   販売者が variant 単位で `isSale` を立てる自己申告のみで、**プラットフォームが企画・編成する
   販促（Amazon のセールイベント型）が組めない**。
3. **価格履歴がない**: 参考価格（取り消し線）の根拠となる価格変動記録テーブルがなく、
   二重価格表示の適正性（景表法型の規制対応）をデータで担保できない。
4. **セール終了の強制がない**: `saleEndDate` は文字列でクエリ側の期限切れ判定・自動終了処理が
   見当たらない（表示に渡すのみ）。

**含意（spike 020 の出発点）**: クーポン基盤（scope 2層 + admin UI + CAS 適用）は再利用できる。
骨組みとして足すのは **(a) Coupon の表現力拡張（型付き日付・額/率・利用制限・対象絞り込み）、
(b) キャンペーン（販促イベント）エンティティ、(c) 価格履歴** の3点。多通貨・税計算は
スコープ外のため単一通貨前提。「どのくらい販促を打つか」はブランド次第 — 構造だけ用意し
中身（イベント種別・割引ポリシー）はデータで差し替える。

## O-4: 通知・トランザクショナルメッセージ — 基盤ゼロ（pull 型のみ）

**現状**:

- **通知モデルなし**: `prisma/schema.prisma` に Notification 系モデルは存在しない（grep 全走査で 0 件）。
- **メール送信基盤なし**: `package.json` に nodemailer / resend / sendgrid / postmark 等の
  依存が一切ない（grep 0 件）。Clerk の認証系メールは Clerk 管轄で、**取引メール
  （注文確認・発送通知・審査結果）を送る手段がアプリに存在しない**。
- 既存の「未読」概念はチャットの `Message.isRead` / `readAt`（`schema.prisma:743-744`）のみ
  （購入者⇔店舗の 1:1 会話専用 — `Conversation` `schema.prisma:714-733`）。
- 顧客が注文状態を知る手段は pull 型のみ:
  - `trackOrder`（`src/queries/order.ts:98`）— orderId + email 照合の公開照会
  - プロフィールの注文履歴ページ（`src/app/(store)/profile/`）
- **通知を必要とする既存・計画中のイベント源**（いずれも現状は通知を発火しない）:
  - 注文状態遷移: `updateOrderGroupStatus` / `updateOrderItemStatus`（`order.ts:164,229`）、
    `updateOrderPaymentStatus`（`order.ts:562`）
  - 店舗承認: store approve フロー（`src/queries/store.ts:531-602` — PENDING→ACTIVE +
    ロール昇格の `$transaction`。Round 2 findings-09 E-4 で審査テンプレートとして引用済み）
  - 計画中: spike 016 出品審査の合否通知 / O-1 の RMA 状態遷移 / DIRECTION-03 チケット返信

**含意（spike 021 の出発点）**: RMA（018）・出品審査（016）・サポートコンソール
（DIRECTION-03）はすべて「状態が変わったら相手に知らせる」を必要とし、それぞれが
個別にメール送信を実装すると発火点が散乱する。先に **(a) Notification テーブル
（アプリ内通知の SSOT）+ (b) 送信チャネル抽象（in-app は必須、email はプロバイダ差し替え可能な
seam）+ (c) イベント→通知のマッピング定義（ポリシーをデータで差し替え）** を骨組みとして
置くのが Amazon 級への土台。外部プロバイダ選定（Resend 等）は spike 内の ADR 判断とする。

## O-5: セラーパフォーマンス — 措置は在るが判断シグナルがない

**現状**:

- 措置側は存在: `StoreStatus` enum に `BANNED` / `DISABLED`（`schema.prisma:76-81`）、
  admin の店舗ステータス変更 UI（`src/app/dashboard/admin/stores/`）。
- **判断材料側が存在しない**:
  1. `Store.averageRating` / `numReviews`（`schema.prisma:93-94`）は**更新する query が無い**
     死にフィールド（O-2 と同根）。
  2. `OrderGroup` / `OrderItem` は `createdAt` / `updatedAt` のみで
     **`shippedAt` / `deliveredAt` 等の事実タイムスタンプがない**（`schema.prisma:529-558,612-639`）。
     状態は enum で分かるが「いつ遷移したか」が残らないため、**出荷遅延率が計算不能**。
  3. 約束側は存在する: `OrderGroup.shippingDeliveryMin/Max`（`schema.prisma:536-537`）に
     注文時点の配送約束日数をスナップショット済み — 「約束 vs 実績」の実績側だけがない。
  4. キャンセル率・返品率・チケット率（`SupportTicket.orderId` から店舗を辿る集計）を
     集約する仕組みがない。
- product.md スコープ外の「高度な分析ダッシュボード」との線引き: ここで扱うのは
  **措置判断のためのシグナル収集**であり、販売者向け分析 UI ではない。

**含意（spike 022 の出発点）**: Amazon の Account Health 相当の骨組みは
**(a) 事実タイムスタンプ（状態遷移の記録）、(b) 店舗単位のメトリクス集約
（遅延率・キャンセル率・返品率・評価）、(c) 閾値ポリシー（データ化）→ 措置（警告 →
DISABLED → BANNED）の接続** の3層。閾値・措置の厳しさはブランド未定のため
ポリシーテーブルで差し替え可能にする。spike 016（出品審査 = 入口の品質）と対になる
「継続運用の品質」であり、016 の StoreStatus 検証（BANNED 店舗の商品露出チェック）とも接続する。

---

## 領域横断の観察

- **O-1 / O-4 は依存関係にある**: RMA の状態遷移通知は通知基盤（O-4）を前提にするのが自然。
  逆に O-4 は O-1 が最初の実需要者になる（016 審査通知と並ぶ）。
- **O-2 / O-5 は同根の欠陥を共有**: `Store.averageRating` 未更新・評価集計の非アトミック性。
  spike 019 の集計修正が spike 022 のシグナルの1系統をそのまま供給する。
- **O-3 は独立**: 既存クーポン基盤の拡張が主で、他領域と in-scope が重ならない。
- **すべての領域で「ポリシーのデータ化」が共通原則**（Round 2 §1.2 の継承）:
  返品ポリシー（期限・可否）、モデレーションモード、販促イベント種別、通知マッピング、
  措置閾値 — いずれも構造はブランド非依存、中身はシード/設定で差し替える。
