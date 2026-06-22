# Track Order — 設計（design.md）

> 中核設計。実装者（Sonnet）が**該当行を特定して差分実装できる**粒度で記述する。
> 要件 ID は [requirements.md](./requirements.md)、手順は [tasks.md](./tasks.md)。

---

## 0. 設計の前提（実コードで確認済みの事実）

| #   | 事実                                                                                                               | 出典（行番号）                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 0-1 | `Order.userId` は**非 null**（ゲスト注文は存在しない）。`Order` は `user`（`UserOrders`）に紐づく                  | [`schema.prisma:498-525`](../../../prisma/schema.prisma#L498-L525)                        |
| 0-2 | `ShippingAddress` に **email カラムは無い**（`firstName`/`lastName`/`phone`/住所のみ）                             | [`schema.prisma:440-465`](../../../prisma/schema.prisma#L440-L465)                        |
| 0-3 | email は `User.email`（`@unique`）のみ                                                                             | [`schema.prisma:18-39`](../../../prisma/schema.prisma#L18-L39)                            |
| 0-4 | `Order` は `groups`（OrderGroup）→ `items`（OrderItem）/ `store`、`shippingAddress`、`paymentDetails` を含められる | [`order.ts:50-79`](../../../src/queries/order.ts#L42-L82)（`getOrder` の include 形）     |
| 0-5 | `OrderGroup` は `shippingService` / `shippingDeliveryMin` / `shippingDeliveryMax` を持つ                           | [`schema.prisma:527-556`](../../../prisma/schema.prisma#L527-L556)                        |
| 0-6 | `OrderItem` は `status`（`ProductStatus`）/ `name` / `image` / `quantity` を持つ                                   | [`schema.prisma:610-637`](../../../prisma/schema.prisma#L610-L637)                        |
| 0-7 | footer の「Track your Order」が `/track-order` に配線済（ページが無い）                                            | [`footer/links.tsx:78-81`](../../../src/components/store/layout/footer/links.tsx#L78-L81) |
| 0-8 | `/track-order` は middleware の保護対象外（公開）                                                                  | [`middleware.ts:6-13`](../../../src/middleware.ts#L6-L13)                                 |

> **設計上の最重要事実**: ゲスト注文が無く email が `User.email` のみであるため、本人性の確認は「`orderId` が示す注文の所有者 `User.email`」と「入力 email」の一致で行う。これが照合方式と IDOR 設計を規定する。

---

## 1. 共通設計

### 1.1 ディレクトリ構成（新規/変更）

```
src/lib/schemas.ts                            ← 変更（TrackOrderSchema 追加）
src/queries/order.ts                          ← 変更（trackOrder 追加・既存ファイル）
src/queries/order.test.ts                     ← 変更/新規（trackOrder のユニット追加）

src/app/(store)/track-order/page.tsx          ← 新規（client フォーム + 結果表示）
src/components/store/track-order/
  ├─ track-order-form.tsx                      ← 新規（client・照会フォーム）
  ├─ track-order-result.tsx                    ← 新規（結果表示）
  └─ *.test.tsx                                ← 新規（コンポーネント）
```

### 1.2 再利用元マトリクス

| 流用するもの                                           | 出典                                                                                            | 用途                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------- |
| order include 形（groups/items/store/shippingAddress） | `order.ts:50-79`（`getOrder`）                                                                  | `trackOrder` の `findUnique` include   |
| IDOR 3 階層テスト                                      | `profile-messages` 設計 / [`SECURITY_GAP_REPORT.md §5.2`](../../testing/SECURITY_GAP_REPORT.md) | AC-TO2〜TO4                            |
| リエントランシーガード                                 | `newsletter.tsx`                                                                                | 照会フォームの二重送信防止             |
| 既存注文詳細表示部品                                   | `src/app/(store)/order/[orderId]/`（要調査）                                                    | 結果表示の部分流用（**実装時に調査**） |
| `Decimal.toNumber()` の境界処理                        | `tech.md` 金額規約                                                                              | 金額表示時                             |

> **実装時の調査タスク**: `src/app/(store)/order/[orderId]/` 配下に order/group/item ステータスを描画する既存部品があれば `track-order-result.tsx` で再利用する。無ければ最小の表示を新規作成。再利用可否を design の本節に追記すること。

### 1.3 認可方針

- `trackOrder` は**公開アクション**。`requireUser` / `currentUser()` ガードを**付けない**（[判断3](#判断3-なぜ公開アクションにするか)）。
- 本人性は `orderId` + `email` の一致で担保。所有権チェックは「email 一致」がその役割を果たす。

---

## 2. 機能詳細

### 2.1 Zod スキーマ（`src/lib/schemas.ts` 末尾に追加）

```ts
// 注文追跡: 注文番号 + メール。両者一致で配送状況を照会する。
export const TrackOrderSchema = z.object({
    orderId: z.string().trim().min(1, "注文番号を入力してください。"),
    email: z.string().trim().email("有効なメールアドレスを入力してください。"),
});

export type TrackOrderInput = z.infer<typeof TrackOrderSchema>;
```

### 2.2 server action（`src/queries/order.ts` に追加）

```ts
import { TrackOrderSchema, type TrackOrderInput } from "@/lib/schemas";

/**
 * 注文番号 + メールで配送状況を照会する公開アクション。
 *
 * 本人性は orderId が示す注文の所有者 User.email と入力 email の一致で確認する
 * （ゲスト注文は無く email は User.email のみ・schema.prisma:18-39, 498-525）。
 *
 * IDOR/列挙防止: 注文の不存在と email 不一致を区別せず、どちらも null を返す。
 *
 * @param input - { orderId, email }。Zod で検証する。
 * @returns 追跡データ（order/group/item ステータス）または null（不一致/不存在/不正入力）
 */
export const trackOrder = async (input: TrackOrderInput) => {
    // 入力検証（不正入力も「見つからない」と同等に null）。
    const parsed = TrackOrderSchema.safeParse(input);
    if (!parsed.success) return null;
    const { orderId, email } = parsed.data;

    try {
        const order = await db.order.findUnique({
            where: { id: orderId },
            include: {
                user: { select: { email: true } },
                groups: {
                    include: {
                        items: {
                            select: {
                                id: true,
                                name: true,
                                image: true,
                                quantity: true,
                                status: true,
                            },
                        },
                        store: { select: { name: true, url: true } },
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        // 不存在・email 不一致を同一応答（null）にする（列挙防止）。
        if (!order) return null;
        if (order.user.email.toLowerCase() !== email.toLowerCase()) return null;

        // email を結果から除去して返す（PII を結果に残さない）。
        const { user: _user, ...rest } = order;
        return rest;
    } catch (error: unknown) {
        if (error instanceof Error) {
            // email/orderId 等の PII はログしない。
            console.error("[Order:trackOrder] lookup failed", {
                error: error.message,
                stack: error.stack,
            });
        } else {
            console.error("[Order:trackOrder] lookup failed (unknown)", {
                error,
            });
        }
        return null;
    }
};
```

> **IDOR の核心**: `where` を `{ id: orderId }` のみにし、email 照合は**取得後**にアプリ層で `toLowerCase()` 比較する。これにより「(a) 不一致でデータを返さない」「(b) where は orderId 単独」「(c) 副作用なし（読取のみ）」の 3 階層を満たす（AC-TO2〜TO4）。

### 2.3 ページ `track-order/page.tsx`

```tsx
// src/app/(store)/track-order/page.tsx
import type { Metadata } from "next";
import TrackOrderForm from "@/components/store/track-order/track-order-form";

export const metadata: Metadata = { title: "Track your order | Marketplace" };

/** 注文追跡ページ。公開。照会は client フォーム → server action（force-dynamic 不要）。 */
export default function TrackOrderPage() {
    return (
        <main className="mx-auto max-w-2xl px-4 py-10">
            <h1 className="mb-2 text-2xl font-bold">Track your order</h1>
            <p className="mb-6 text-sm text-muted-foreground">
                注文番号とご注文時のメールアドレスを入力してください。
            </p>
            <TrackOrderForm />
        </main>
    );
}
```

### 2.4 照会フォーム `track-order-form.tsx`（client）

```tsx
"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TrackOrderSchema, type TrackOrderInput } from "@/lib/schemas";
import { trackOrder } from "@/queries/order";
import TrackOrderResult from "./track-order-result";

export default function TrackOrderForm() {
    const isSubmittingRef = useRef(false);
    const [result, setResult] =
        useState<Awaited<ReturnType<typeof trackOrder>>>(null);
    const [notFound, setNotFound] = useState(false);
    const form = useForm<TrackOrderInput>({
        resolver: zodResolver(TrackOrderSchema),
        defaultValues: { orderId: "", email: "" },
    });

    const onSubmit = async (values: TrackOrderInput) => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setNotFound(false);
        try {
            const data = await trackOrder(values);
            if (!data) setNotFound(true);
            setResult(data);
        } finally {
            isSubmittingRef.current = false;
        }
    };

    return (
        <div>
            {/* RHF: orderId / email の Input + submit ボタン（shadcn Form） */}
            {/* form.handleSubmit(onSubmit) を submit に接続 */}
            {notFound ? (
                <p role="status">注文が見つかりませんでした。</p>
            ) : null}
            {result ? <TrackOrderResult order={result} /> : null}
        </div>
    );
}
```

> **重要**: not found は「不一致」「不存在」を区別しない単一メッセージ（要件 TO-5）。`result` の型は `trackOrder` の戻り値型から推論（`Awaited<ReturnType<typeof trackOrder>>`）し、`any` を使わない。

### 2.5 結果表示 `track-order-result.tsx`

- props: `order`（`trackOrder` の非 null 戻り値）。
- 表示: `orderStatus` / `paymentStatus`（バッジ）、`groups` をループし `store.name` + `shippingService` + `shippingDeliveryMin〜Max`、各 `items` の `name`/`image`/`quantity`/`status`。
- 金額に触れる場合は `Decimal` を境界で `toNumber()`（NFR-TO3）。
- **既存部品調査**: `src/app/(store)/order/[orderId]/` のステータス表示部品が流用可能なら import して使う。

---

## 3. テスト設計

> ユニット: `src/queries/order.test.ts` に追加（Prisma モック）。コンポーネント: `track-order-form.test.tsx`（RTL・`trackOrder` を mock）。

| テスト | 対象                               | アサート（AAA）                                                                               | 対応 AC |
| ------ | ---------------------------------- | --------------------------------------------------------------------------------------------- | ------- |
| T-TO1  | `trackOrder`                       | email 一致（大小無視）→ order/group/item を含むデータを返し、`user`（email）は除去            | AC-TO1  |
| T-TO2  | `trackOrder`（IDOR a: スロー検証） | email 不一致 → `null`（注文データを返さない）                                                 | AC-TO2  |
| T-TO3  | `trackOrder`（IDOR b: where 構造） | `findUnique` の `where` が `{ id: orderId }`（email を where に混ぜていれば副作用なしを確認） | AC-TO4  |
| T-TO4  | `trackOrder`（IDOR c: 副作用なし） | 不一致時に `update`/`delete` 等が呼ばれない（読取のみ）                                       | AC-TO2  |
| T-TO5  | `trackOrder`                       | 不存在 `orderId`（`findUnique` が null）→ `null`（T-TO2 と同一応答）                          | AC-TO3  |
| T-TO6  | `trackOrder`                       | 不正入力（空 orderId 等）→ Zod で `null`、`findUnique` 未呼び出し                             | AC-TO6  |
| T-TO7  | `track-order-form.tsx`             | 未入力 submit → エラー表示・`trackOrder` 未呼び出し                                           | AC-TO5  |
| T-TO8  | `track-order-form.tsx`             | 一致 mock → 結果が描画される                                                                  | AC-TO6  |

> テスト数変動のため [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) を**必ず**起動。

---

## 判断1. なぜ `orderId` + `email`（User.email）で照合するか

- ゲスト注文が無く（事実 0-1）、`ShippingAddress` に email が無い（事実 0-2）。email は `User.email` のみ（事実 0-3）。
- よって本人性の確認材料は「注文の所有者 `User.email`」しかない。`orderId` 単独では IDOR になるため、`email` 一致を必須にする。

## 判断2. なぜ不一致と不存在を同一応答にするか

- `orderId` が uuid とはいえ、応答を区別すると「この id は存在するが email が違う」という情報が漏れ、列挙・総当たりの足がかりになる。
- 両ケースを `null`（"注文が見つかりませんでした。"）に統一し、存在有無を秘匿する（NFR-TO1）。

## 判断3. なぜ公開アクションにするか

- ログインせずに番号 + メールで追跡したい需要に応える（注文確認メールのリンクから遷移する典型 UX）。
- 本人性は email 一致で担保するため、`requireUser` は不要。既存 `getOrder`（`order.ts:42-47`）は認証必須だが、本アクションは別目的（公開追跡）であり**併存**する。

---

## 影響箇所マトリクス

| パス                                     | 変更種別 | 理由                                | リスク         |
| ---------------------------------------- | -------- | ----------------------------------- | -------------- |
| `src/lib/schemas.ts`                     | 変更     | `TrackOrderSchema` 追加             | 低             |
| `src/queries/order.ts`                   | 変更     | `trackOrder` 追加（既存関数は不変） | 低（追加のみ） |
| `src/queries/order.test.ts`              | 変更     | trackOrder のユニット追加           | 低             |
| `src/app/(store)/track-order/page.tsx`   | 新規     | ページ本体                          | 低             |
| `src/components/store/track-order/*.tsx` | 新規     | フォーム + 結果表示                 | 低             |

---

## リスク分析

| リスク                       | 区分         | 緩和策                                                                          |
| ---------------------------- | ------------ | ------------------------------------------------------------------------------- |
| 注文 id + email の総当たり   | セキュリティ | 不一致/不存在を同一応答に。follow-up でレート制限。email は uuid と違い推測困難 |
| email を結果/ログに残す      | プライバシー | 戻り値から `user` を除去。ログに email/orderId を含めない（PII）                |
| 既存注文表示部品との重複実装 | 保守性       | 実装時に `order/[orderId]/` 部品の流用を調査し DRY 化                           |
| 金額表示の丸め誤差           | データ整合   | `Decimal` を境界で `toNumber()`（NFR-TO3）                                      |

---

## Verification（実装後の検証手順）

1. `bun run lint` / `bunx tsc --noEmit` / `bun run test`（T-TO1〜T-TO8）/ `bun run build`。
2. `bun run dev` → 既存注文（`bunx prisma studio` で id と所有者 email を確認）で `/track-order` 照会 → ステータスが出ること。
3. 同じ id + **誤った email** → "注文が見つかりませんでした。"（データが出ないこと）。
4. **存在しない id** → 同一メッセージ（区別されないこと・列挙防止）。
5. footer「Track your Order」から到達できること。
