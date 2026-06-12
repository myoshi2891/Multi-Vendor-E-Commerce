# 管理者ダッシュボード 3 機能 — 詳細設計（design.md）

> 本ドキュメントは **実装の中核**。query シグネチャ・コンポーネント・スキーマ変更・既存コードへの影響箇所を、後続セッション（Sonnet 可）が **該当行を特定して差分修正できる粒度** で記述する。
> 要件 ID は [requirements.md](./requirements.md)、実装順は [tasks.md](./tasks.md) を参照。

---

## 0. 設計の前提（実地確認済みの事実）

本設計は以下の **現行コードの実地確認** に基づく（行番号は確認時点）。

| 確認対象 | パス | 確認結果 |
| --- | --- | --- |
| 認可ガード | [src/lib/auth-guards.ts:53](../../../src/lib/auth-guards.ts#L53) | `requireAdmin(): Promise<User>`。role 不一致で `"Only admins can perform this action."` |
| クーポン query | [src/queries/coupon.ts](../../../src/queries/coupon.ts) | `isGuardError` に既に admin メッセージ含む（L16）。`applyCoupon` は L192-298、`.toNumber()` JS 演算（L254-267）、`coupon.store.name`（L289） |
| 注文 query | [src/queries/order.ts](../../../src/queries/order.ts) | `getOrder` は `where:{id,userId}` で自分限定（L23-27）。`updateOrderGroupStatus` はインライン認可（L74-94） |
| 注文確定 | [src/queries/user.ts:419](../../../src/queries/user.ts#L419) | `placeOrder`。クーポン判定 `check = storeId === cartCoupon?.storeId`（L642）、`couponId` 紐付け（L665） |
| カート再計算 | [src/queries/user.ts:101](../../../src/queries/user.ts#L101) | `saveUserCart`。`item.storeId === coupon.storeId`（L1082）、返却で `cart.coupon.store.<Decimal>.toNumber()`（L1138-1148） |
| Coupon モデル | [prisma/schema.prisma:657](../../../prisma/schema.prisma#L657) | `code @unique`、`startDate/endDate: String`、`discount: Int`、`storeId: String`（必須）、**`isActive` 無し** |
| enum 型 | [src/lib/types.ts:269](../../../src/lib/types.ts#L269) | `OrderStatus`/`PaymentStatus`/`ProductStatus` は **`@/lib/types` の enum**（@prisma/client ではない） |
| 既存型 | [src/lib/types.ts:380](../../../src/lib/types.ts#L380) | `StoreOrderType = Prisma.PromiseReturnType<typeof getStoreOrders>[0]`（OrderGroup 起点） |
| Decimal 変換 | [src/lib/utils.ts:25](../../../src/lib/utils.ts#L25) | `toNumberSafe(value: unknown): number` |
| admin layout | [src/app/dashboard/admin/layout.tsx:21](../../../src/app/dashboard/admin/layout.tsx#L21) | `role !== "ADMIN"` で `redirect("/")` |

---

## 1. 共通設計

### 1.1 ルーティング規約（force-dynamic 必須）

DB 依存の各 `page.tsx` は、import 群の直後に動的レンダリングを宣言する（[tech.md DB 依存ページ規約](../../../.claude/steering/tech.md)）。

```typescript
// 例: src/app/dashboard/admin/orders/page.tsx
import { getAllOrders } from "@/queries/order";
// ...他 import...

export const dynamic = 'force-dynamic';   // ← import 直後に宣言

export default async function AdminOrdersPage(props: { searchParams: ... }) { ... }
```

> **キャッシュとの両立（F1）**: ページは `force-dynamic` のまま、**統計取得関数だけ**をデータキャッシュ層（`unstable_cache`）で包む。「動的ページ × キャッシュ済みデータ」の分離（[判断5-1](#5-1-ダッシュボード集計のキャッシュ戦略)）。

### 1.2 ディレクトリ構成（新規作成 / 変更）

```
src/app/dashboard/admin/
├── page.tsx                    [変更] プレースホルダー → ダッシュボード本体（F1）
├── orders/
│   ├── page.tsx                [新規] 注文一覧（DataTable）（F2）
│   └── columns.tsx             [新規] seller 版 + Store 列（F2）
└── coupons/
    ├── page.tsx                [新規] クーポン一覧（DataTable）（F3）
    ├── columns.tsx             [新規] Store 列 + Active バッジ（F3）
    └── new/
        └── page.tsx            [新規] クーポン作成ページ（F3）

src/queries/
├── dashboard.ts                [新規] 統計集計（F1）
├── order.ts                    [変更] admin query 追加（F2）
└── coupon.ts                   [変更] admin query 追加（F3）

src/components/dashboard/
├── forms/
│   ├── order-status-select.tsx [変更] discriminated union props（F2・判断5-3）
│   └── admin-coupon-details.tsx [新規] store 選択 + scope 切替（F3）
└── admin/                       [新規] F1 用 KPI カード・チャート・最近リスト

src/lib/
├── types.ts                    [変更] AdminOrderType 等を追加
└── schemas.ts                  [変更] AdminCouponFormSchema を追加
```

### 1.3 再利用元マトリクス

> **判断1**: seller ダッシュボードに同等機能が実装済み。admin 版は「全店舗横断」への一般化として設計し、新規発明を最小化する。

| 再利用元 | パス | admin での扱い |
| --- | --- | --- |
| 注文一覧テーブル | [orders/columns.tsx](../../../src/app/dashboard/seller/stores/[storeUrl]/orders/columns.tsx) | **Store 名列を追加**して流用。型を `StoreOrderType` → `AdminOrderType` に変更 |
| 注文詳細モーダル | [store-order-summary.tsx](../../../src/components/dashboard/shared/store-order-summary.tsx) | **そのまま流用**（`group` props は `OrderGroupWithItemsType` 互換） |
| ステータス変更 UI | [order-status-select.tsx](../../../src/components/dashboard/forms/order-status-select.tsx) | admin 用 action を注入できるよう **discriminated union props に拡張**（[判断5-3](#5-3-認可境界特権昇格監査)） |
| クーポンフォーム | [coupon-details.tsx](../../../src/components/dashboard/forms/coupon-details.tsx) | **store 選択 + scope 切替**を追加した admin 版（`admin-coupon-details.tsx`）を派生 |
| クーポン列 | [coupons/columns.tsx](../../../src/app/dashboard/seller/stores/[storeUrl]/coupons/columns.tsx) | Store 列 + Active バッジを追加 |
| データテーブル | [data-table.tsx](../../../src/components/ui/data-table.tsx) | そのまま流用 |
| Decimal→number | [toNumberSafe()](../../../src/lib/utils.ts#L25) | 金額集計・表示で使用 |
| チャート | `@tremor/react`（[package.json](../../../package.json) に `^3.18.3` 既存）/ [chart.tsx](../../../src/components/ui/chart.tsx) | **依存追加なし**で使用 |

### 1.4 認可方針

> **判断2**: 既存負債を触らず、新規 query のみ正道で実装する。

- 既存 `order.ts` の `updateOrderGroupStatus` 等の **インライン認可展開**（`currentUser()` + role チェック）は tech.md 上は負債だが、**改変せず温存**（安全な差分・既存テスト保護）。
- admin 用に **新規追加** する query はすべて [requireAdmin()](../../../src/lib/auth-guards.ts#L53) を使う（CLAUDE.md「インライン展開を新規追加禁止」準拠）。
- `coupon.ts` の `isGuardError`（[L9-19](../../../src/queries/coupon.ts#L9-L19)）には既に `'Only admins can perform this action.'` が含まれており、admin query 追加が想定済み。
- **多層防御**: layout の `redirect("/")`（画面アクセス制御）に加え、各 server action が再度 `requireAdmin()` を呼ぶ。

---

## 2. F1: `/dashboard/admin`（Dashboard）

> 対応要件: F1-1〜F1-9。

### 2.1 新規 query — `src/queries/dashboard.ts`

```typescript
"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";

/** ダッシュボード KPI の集計結果。Decimal は number 化済み（シリアライズ安全）。 */
export type AdminDashboardStats = {
    totalRevenue: number;       // paymentStatus=Paid のみ。論理削除ストア分も算入
    totalOrders: number;
    activeStores: number;       // status=ACTIVE かつ isDeleted=false
    pendingStores: number;      // status=PENDING かつ isDeleted=false
    totalUsers: number;
    totalProducts: number;
    totalCategories: number;
    totalSubCategories: number;
};

/**
 * @function getAdminDashboardStats
 * @description 管理者ダッシュボードの KPI を並列集計する。requireAdmin() で保護。
 *              15〜30 分のデータキャッシュを介す（統計にリアルタイム性は不要・判断5-1）。
 * @access ADMIN
 */
export const getAdminDashboardStats = async (): Promise<AdminDashboardStats> => {
    await requireAdmin();   // 多層防御（NFR-1）
    return getCachedStats();
};

// requireAdmin の後にキャッシュ層を呼ぶ（認可をキャッシュに含めない）
const getCachedStats = unstable_cache(
    async (): Promise<AdminDashboardStats> => {
        try {
            const [revenueAgg, totalOrders, storeGroups, totalUsers,
                   totalProducts, totalCategories, totalSubCategories] =
                await Promise.all([
                    // F1-2/F1-3: Paid のみ。Refunded/Cancelled/Failed/Declined/ChargeBack/
                    //            PartiallyRefunded を除外（C-e）。論理削除ストア分も算入（F1-5）
                    db.order.aggregate({
                        _sum: { total: true },
                        where: { paymentStatus: "Paid" },
                    }),
                    db.order.count(),
                    // F1-4: ストア数は isDeleted=false のみ（判断6-3）
                    db.store.groupBy({
                        by: ["status"],
                        where: { isDeleted: false },
                        _count: { _all: true },
                    }),
                    db.user.count(),
                    db.product.count(),
                    db.category.count(),
                    db.subCategory.count(),
                ]);

            const findCount = (s: string) =>
                storeGroups.find((g) => g.status === s)?._count._all ?? 0;

            return {
                totalRevenue: (revenueAgg._sum.total ?? new Prisma.Decimal(0)).toNumber(),
                totalOrders,
                activeStores: findCount("ACTIVE"),
                pendingStores: findCount("PENDING"),
                totalUsers,
                totalProducts,
                totalCategories,
                totalSubCategories,
            };
        } catch (error: unknown) {
            console.error(
                "[Dashboard:getAdminDashboardStats] Error",
                { error: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined }
            );
            throw new Error("Failed to aggregate dashboard stats.");
        }
    },
    ["admin-dashboard-stats"],          // cache key
    { revalidate: 60 * 20, tags: ["admin-dashboard"] }  // 20 分（判断5-1）
);
```

> **`Store.status` の enum 値（確認済み）**: `enum StoreStatus`（[schema.prisma:73-78](../../../prisma/schema.prisma#L73)）は **`PENDING` / `ACTIVE` / `BANNED` / `DISABLED`** の 4 値。現行 KPI は `ACTIVE`（`activeStores`）/ `PENDING`（`pendingStores`）のみ使用する。`BANNED` / `DISABLED` は将来 KPI 拡張で算入する場合に `findCount()` を追加する。**`INACTIVE` という値は存在しない**（旧 `src/queries/store.test.ts` の `"INACTIVE"` 参照は実値へ是正済み）。

```typescript
/** 売上推移（チャート用）。period で粒度を切替。 */
export type SalesPoint = { label: string; revenue: number };

/**
 * @function getSalesOverTime
 * @description 期間別の Paid 売上を集計し、チャート用の配列で返す。
 * @access ADMIN
 * @param period 'daily'（直近 30 日）| 'monthly'（直近 12 ヶ月）
 */
export const getSalesOverTime = async (
    period: "daily" | "monthly" = "monthly"
): Promise<SalesPoint[]> => {
    await requireAdmin();
    // 実装メモ: createdAt の範囲で Paid 注文を取得し、JS 側で日次/月次バケットに集計。
    //   規模拡大時は SQL の date_trunc + groupBy（$queryRaw）へ移行（判断5-1 ロードマップ）。
    //   集計対象列（Order.paymentStatus・createdAt）のインデックスを確認（tasks）。
};

/**
 * @function getRecentOrders / getRecentStores
 * @description 最近の注文 / 新規ストアを直近 limit 件返す（F1-7）。
 * @access ADMIN
 */
export const getRecentOrders = async (limit = 5) => {
    await requireAdmin();
    // include: groups{store}, shippingAddress{user}。orderBy createdAt desc, take limit
};
export const getRecentStores = async (limit = 5) => {
    await requireAdmin();
    // where: { isDeleted: false }, orderBy createdAt desc, take limit
};
```

### 2.2 UI

- **KPI カード群**: shadcn の [Card](../../../src/components/ui/card.tsx) を使い、`AdminDashboardStats` の各値を表示。金額は `toNumberSafe()` 経由で number 化済み。
- **売上チャート**: `@tremor/react` の `AreaChart`（依存追加なし）または [chart.tsx](../../../src/components/ui/chart.tsx)。`SalesPoint[]` を `data` に渡す。
- **最近の注文/ストア**: 簡易リスト（Card 内）。
- `src/app/dashboard/admin/page.tsx` のプレースホルダー（`<div>Admin DashboardPage</div>`）を **置換**。`export const dynamic = 'force-dynamic';` を宣言。
- 新規コンポーネントは `src/components/dashboard/admin/` に配置。

---

## 3. F2: 注文管理（`/dashboard/admin/orders`）

> 対応要件: F2-1〜F2-12。**Phase 1（最初に着手・スキーマ変更なし）**。

### 3.1 新規 query（`src/queries/order.ts` に追加）

すべて `requireAdmin()` を冒頭で呼ぶ。既存の `updateOrderGroupStatus`（seller 版）は温存。

```typescript
import { requireAdmin } from "@/lib/auth-guards";
import { OrderStatus, ProductStatus, PaymentStatus } from "@/lib/types";
import { z } from "zod";

/** F2-4/F2-5: limit 上限キャップ（判断6-5）。 */
const AdminOrderFilterSchema = z.object({
    // z.nativeEnum で URL パラメータを入口で検証（不正値を弾き、下流の as キャストを排除）
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    orderStatus: z.nativeEnum(OrderStatus).optional(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),   // ← 上限 100
});

/**
 * @function getAllOrders
 * @description 全店舗横断の注文一覧（Order 起点）。requireAdmin() で保護。
 *              seller 版が OrderGroup 起点・自店舗限定なのに対し、Order 起点・横断。
 * @access ADMIN
 */
export const getAllOrders = async (
    filters?: Partial<z.infer<typeof AdminOrderFilterSchema>>
) => {
    await requireAdmin();
    const f = AdminOrderFilterSchema.parse(filters ?? {});
    try {
        const where: Prisma.OrderWhereInput = {
            ...(f.paymentStatus ? { paymentStatus: f.paymentStatus } : {}),   // nativeEnum 検証済み・キャスト不要
            ...(f.orderStatus ? { orderStatus: f.orderStatus } : {}),         // 同上
            ...(f.search ? { id: { contains: f.search } } : {}),
        };
        const [orders, total] = await Promise.all([
            db.order.findMany({
                where,
                include: {
                    groups: { include: { items: true, store: true, coupon: true } },
                    shippingAddress: { include: { country: true, user: true } },
                    paymentDetails: true,
                },
                orderBy: { createdAt: "desc" },
                skip: (f.page - 1) * f.limit,
                take: f.limit,          // ← キャップ済み
            }),
            db.order.count({ where }),
        ]);
        return { orders, total, page: f.page, limit: f.limit };
    } catch (error: unknown) {
        console.error("[Order:getAllOrders] Error",
            { error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined });
        throw new Error("Failed to fetch orders.");
    }
};

/** AdminOrderType を src/lib/types.ts に追加（F2 一覧の行型）。 */
// export type AdminOrderType =
//     Prisma.PromiseReturnType<typeof getAllOrders>["orders"][number];

/**
 * @function getOrderForAdmin
 * @description 注文詳細（userId フィルタ無し）。既存 getOrder は自分限定のため別途必要（F2-6）。
 * @access ADMIN
 */
export const getOrderForAdmin = async (orderId: string) => {
    await requireAdmin();
    // include は getOrder（order.ts L28-51）と同形だが where から userId を外す
};

/**
 * @function updateOrderGroupStatusAsAdmin
 * @description 店舗所有権チェック無しで OrderGroup.status を更新（F2-7）。親子連動（判断6-2）。
 * @access ADMIN
 */
export const updateOrderGroupStatusAsAdmin = async (
    groupId: string,
    status: OrderStatus
): Promise<OrderStatus> => {
    const admin = await requireAdmin();
    try {
        return await db.$transaction(async (tx) => {       // NFR-6
            const group = await tx.orderGroup.update({
                where: { id: groupId },
                data: { status },
                select: { id: true, orderId: true, status: true },
            });
            // 判断6-2: 子 OrderGroup 群の状態から親 Order を集約更新
            await reconcileParentOrderStatus(tx, group.orderId);
            // 監査ログ（NFR-5・判断5-3）
            console.error(`[Admin:updateOrderGroupStatus] actor=${admin.id} target=${groupId} to=${status}`);
            // TODO(在庫連動・スコープ外): status が Canceled/Returned のとき在庫復元フックをここに（判断5-2）
            return group.status as OrderStatus;
        });
    } catch (error: unknown) {
        console.error("[Order:updateOrderGroupStatusAsAdmin] Error",
            { error: error instanceof Error ? error.message : String(error) });
        throw error instanceof Error ? error : new Error("Failed to update order group status.");
    }
};

/**
 * @function updateOrderItemStatusAsAdmin
 * @description OrderItem.status（ProductStatus）を更新（F2-8）。requireAdmin()。
 * @access ADMIN
 */
export const updateOrderItemStatusAsAdmin = async (
    orderItemId: string,
    status: ProductStatus
): Promise<ProductStatus> => { /* requireAdmin → update。監査ログ。在庫 TODO */ };

/**
 * @function updateOrderPaymentStatus
 * @description Order.paymentStatus を DB のみ更新（F2-9・C-a）。決済 API は呼ばない。
 * @access ADMIN
 */
export const updateOrderPaymentStatus = async (
    orderId: string,
    status: PaymentStatus
): Promise<PaymentStatus> => {
    const admin = await requireAdmin();
    return await db.$transaction(async (tx) => {
        await tx.order.update({ where: { id: orderId }, data: { paymentStatus: status } });
        // 判断6-2: Cancelled/Refunded のとき子 OrderGroup/OrderItem を連動（F2-10）
        // ※ enum スペル注意: 子の OrderStatus は "Canceled"（L 1 つ）、
        //    親の PaymentStatus は "Cancelled"（L 2 つ）。PaymentStatus → OrderStatus へ正しく写像する。
        if (status === "Refunded" || status === "Cancelled") {
            const childStatus: OrderStatus =
                status === "Refunded" ? OrderStatus.Refunded : OrderStatus.Canceled;
            await tx.orderGroup.updateMany({ where: { orderId }, data: { status: childStatus } });
            // OrderItem も同じ childStatus 相当（ProductStatus）へ連動
        }
        console.error(`[Admin:updatePaymentStatus] actor=${admin.id} target=${orderId} to=${status}`);
        // TODO(在庫連動・スコープ外): Refunded で在庫復元フック（判断5-2）
        return status;
    });
};
```

### 3.2 親子ステータス連動（判断6-2 のステートマシン）

`reconcileParentOrderStatus(tx, orderId)` のロジック（F2-10/F2-11）:

```
全 OrderGroup の status を取得し、親 Order.orderStatus を導出:
  ├─ すべて Delivered            → Order = Delivered
  ├─ すべて Shipped              → Order = Shipped
  ├─ 一部のみ Shipped/Delivered  → Order = PartiallyShipped
  ├─ すべて Canceled             → Order = Canceled
  ├─ すべて Refunded             → Order = Refunded
  └─ それ以外（混在/Pending）    → Order = Processing（または現状維持）
```

逆方向（親 → 子）の連動:
```
親 Order を Canceled/Refunded に変更（updateOrderPaymentStatus 経由含む）:
  → 同一 db.$transaction で全 OrderGroup.status と全 OrderItem.status を一括更新
```

> **在庫連動はスコープ外**: 上記の状態遷移に伴う在庫の減算/復元は実装しない。各 admin action に TODO コメントでフック位置のみ残す（判断5-2）。

### 3.3 UI

- **`page.tsx`**（新規）: `getAllOrders()` を呼び、[DataTable](../../../src/components/ui/data-table.tsx) に渡す。`export const dynamic = 'force-dynamic';`。`searchParams` から `page`/`limit`/フィルタを読む。**`searchParams` の値は文字列**のため、まず `Number()` で数値化してから tech.md の URL 正規化を適用する（既存の正準パターン: [`profile/following/[page]/page.tsx`](../../../src/app/(store)/profile/following/[page]/page.tsx#L18-L19) の `const raw = Number(pageParam)` → `Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1`）。`page`/`limit` 双方で `const rawNum = Number(raw); Number.isFinite(rawNum) && rawNum >= 1 ? Math.floor(rawNum) : 1` とし、`limit` には上限キャップも適用する（直接 `Number.isFinite(raw)` を文字列に当てると常に false となり 1 に張り付くため）。
- **`columns.tsx`**（新規）: seller 版（[orders/columns.tsx](../../../src/app/dashboard/seller/stores/[storeUrl]/orders/columns.tsx)）をベースに、型を `AdminOrderType` に変更し **Store 列を追加**。Order 起点のため、行は Order（その中に groups[]）。各 group の store を表示。
- **詳細モーダル**: [StoreOrderSummary](../../../src/components/dashboard/shared/store-order-summary.tsx) をそのまま流用（`group` props）。
- **ステータス変更**: `OrderStatusSelect` を discriminated union props で admin 対応（次節 3.4）。
- **`paymentStatus` 変更 UI（運用上の警告）**: `updateOrderPaymentStatus` を呼ぶ操作 UI に**のみ**「**DB ステータスのみ変更・決済 API 非連携（[C-a](./requirements.md#6-制限事項仕様境界)）**」の警告を明示する。`Paid`/`Refunded` 等への変更後は、運営者が Stripe / PayPal の各ダッシュボードで返金・キャプチャを **手動で照合する運用前提** を UI 上で示す（手順は次節 [§3.5](#35-決済ステータス手動変更運用手順runbook)）。
  - **`updateOrderItemStatusAsAdmin` には決済 API 警告を付与しない**: これは `OrderItem.status`（`ProductStatus` = 配送/履行ステータス）の更新であり決済とは無関係。代わりに「**配送キャリア未連携・手動ステータス変更**」である旨を示す（サードパーティ配送キャリア連携は [product.md](../../../.claude/steering/product.md) スコープ外）。
  - **スコープ外（明示）**: 外部ゲートウェイとの自動照合ジョブ・不一致検知レポート・`AuditLog` への gateway transaction ID / gateway 名の格納（監査スキーマ拡張）は本 3 機能のスコープ外（C-a「決済 API 自動連携はスコープ外」/ [product.md](../../../.claude/steering/product.md)）。永続監査が要件化したら [判断5-3](#5-3-認可境界特権昇格監査) の `AuditLog` ロードマップで扱う。

### 3.4 `OrderStatusSelect` の discriminated union 化（判断5-3）

現状（[order-status-select.tsx:8-14](../../../src/components/dashboard/forms/order-status-select.tsx#L8-L14)）は seller 専用 props `{ storeId, groupId, status }` で `updateOrderGroupStatus` を直接呼ぶ。これを **mode で静的に分岐** する。

```typescript
// Before（seller 専用）
interface Props { storeId: string; groupId: string; status: OrderStatus; }

// After（discriminated union）
type Props =
    | { mode: "seller"; storeId: string; groupId: string; status: OrderStatus }
    | { mode: "admin";  groupId: string; status: OrderStatus };

const OrderStatusSelect: FC<Props> = (props) => {
    const handleClick = async (selected: OrderStatus) => {
        const response =
            props.mode === "admin"
                ? await updateOrderGroupStatusAsAdmin(props.groupId, selected)
                : await updateOrderGroupStatus(props.storeId, props.groupId, selected);
        // ...既存の setNewStatus/toast はそのまま
    };
    // ...
};
```

**効果（なぜ union か）**: `mode: "admin"` の分岐に `storeId` が型として存在しないため、seller 文脈に admin action が混入することを **コンパイル時に排除**。既存の seller 呼び出し側（columns.tsx）は `mode: "seller"` を明示的に付与する変更が必要（既存テストの確認対象）。

### 3.5 決済ステータス手動変更 運用手順（Runbook）

> `updateOrderPaymentStatus` は DB の `Order.paymentStatus` のみを変更し、Stripe / PayPal の決済 API は呼ばない（[C-a](./requirements.md#6-制限事項仕様境界)）。そのため外部ゲートウェイとの整合は**運営者の手動運用**で担保する。本節はその運用手順を定義する。

**1. UI 操作フロー（変更前後の順序）**

| 局面 | 操作順序 |
| --- | --- |
| 通常の paymentStatus 変更（例: `Pending → Paid`） | ① 対象 Order の詳細モーダルで現在の `paymentStatus` と各 OrderGroup 状態を確認 → ② `updateOrderPaymentStatus` を実行 → ③ 直後に下記「2. 不一致検知」で外部ダッシュボードと照合 |
| `Refunded` / `Cancelled`（親→子連動あり） | ① 外部側（Stripe/PayPal）で返金・キャンセルを**先に**実施し成立を確認 → ② `updateOrderPaymentStatus(orderId, "Refunded"/"Cancelled")` を実行（同一 `db.$transaction` で子 OrderGroup/OrderItem が連動・[§3.2](#32-親子ステータス連動判断6-2-のステートマシン)）→ ③ 子連動結果を詳細モーダルで確認 |
| 個別 OrderGroup の配送ステータス変更 | `updateOrderGroupStatusAsAdmin` を使用（**`updateOrderPaymentStatus` とは別系統**・決済とは無関係） |

> **原則**: 返金/キャンセルは「**外部ゲートウェイ先行 → DB 反映**」。`Paid` への昇格は「**DB 反映 → 外部照合**」。DB を先に `Refunded` にしてから外部返金を忘れると、実返金なしの返金扱いが残る。

**2. 不一致検知方法**

- **照合対象**: DB `Order.paymentStatus` ↔ Stripe Dashboard（PaymentIntent / Refund 状態）/ PayPal Dashboard（Capture / Refund 状態）。
- **確認頻度**: ① `Refunded`/`Paid`/`Cancelled` への変更**直後**（必須）、② 日次バッチ確認（推奨・手動）。
- **チェックリスト**:
  - [ ] DB が `Paid` の注文に、対応する成功した Capture が外部に存在するか
  - [ ] DB が `Refunded` の注文に、対応する Refund が外部に存在し金額が一致するか
  - [ ] 外部で返金済みなのに DB が `Paid` のままの注文が無いか（取りこぼし検知）

**3. 復旧アクション（不一致発見時）**

| 不一致パターン | 戻すべき DB ステータス | 外部側の調整 |
| --- | --- | --- |
| DB=`Refunded` だが外部に Refund 無し | `updateOrderPaymentStatus` で `Paid` に戻す | 必要なら改めて外部で返金を実行し、成立後に再度 `Refunded` へ |
| DB=`Paid` だが外部は返金済み | `updateOrderPaymentStatus` で `Refunded` に変更（子連動を確認） | 追加調整不要（外部が正） |
| DB=`Pending` だが外部は Capture 済み | `updateOrderPaymentStatus` で `Paid` に変更 | 追加調整不要 |

**4. スコープ外（明示）**: 外部ゲートウェイとの**自動**照合ジョブ・不一致検知レポート・`AuditLog` への gateway transaction ID 格納は本 3 機能のスコープ外（line 407 の scope-out と同一・[C-a](./requirements.md#6-制限事項仕様境界)）。本 runbook は**手動運用手順のみ**を定義し、自動化は要件化時に [判断5-3](#5-3-認可境界特権昇格監査) の `AuditLog` ロードマップで扱う。

---

## 4. F3: クーポン管理（`/dashboard/admin/coupons`）

> 対応要件: F3-1〜F3-11。**第1段（Phase 3）= 横断管理 + isActive、第2段（Phase 5）= platform-wide**。

### 4.1 新規 query（`src/queries/coupon.ts` に追加）

```typescript
import { requireAdmin } from "@/lib/auth-guards";
import { Prisma } from "@prisma/client";

/**
 * @function getAllCoupons
 * @description 全店舗のクーポン一覧 + store（F3-1）。limit 上限キャップ（判断6-5）。
 * @access ADMIN
 */
export const getAllCoupons = async (filters?: {
    search?: string; page?: number; limit?: number;
}) => {
    await requireAdmin();
    const limit = Math.min(Math.max(Math.floor(filters?.limit ?? 20), 1), 100); // ≤100
    // findMany({ include: { store: true }, orderBy: createdAt desc, skip, take: limit })
};

/**
 * @function upsertCouponAsAdmin
 * @description admin によるクーポン upsert（F3-2）。code グローバル一意の衝突を P2002 で捕捉（F3-5）。
 *              第1段は storeId 指定編集、第2段で scope/nullable storeId 対応。
 * @access ADMIN
 */
export const upsertCouponAsAdmin = async (coupon: /* AdminCouponInput */ unknown) => {
    await requireAdmin();
    try {
        // 第1段: storeId 必須。第2段: scope===PLATFORM なら storeId=null
        return await db.coupon.upsert({ where: { id: /*...*/ }, update: {/*...*/}, create: {/*...*/} });
    } catch (error: unknown) {
        // F3-5: code @unique 違反（P2002）を捕捉
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new Error("このクーポンコードは既に使用されています");
        }
        if (isGuardError(error)) throw error;
        throw new Error(`Error occurred while trying to upsert coupon: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * @function deleteCouponAsAdmin
 * @description 店舗所有権チェック無しでクーポン削除（F3-3）。requireAdmin()。
 * @access ADMIN
 */
export const deleteCouponAsAdmin = async (couponId: string) => {
    await requireAdmin();
    // db.coupon.delete({ where: { id: couponId } })
};

/**
 * @function toggleCouponActive
 * @description クーポンの有効/無効を切替（F3-4）。第1段で isActive 列追加後に有効。
 * @access ADMIN
 */
export const toggleCouponActive = async (couponId: string, isActive: boolean) => {
    await requireAdmin();
    // db.coupon.update({ where: { id: couponId }, data: { isActive } })
};
```

> **既存 seller 版との一意性チェックの違い（判断4）**: seller の `upsertCoupon` は `code + storeId` の複合で重複検知する（[coupon.ts:43-51](../../../src/queries/coupon.ts#L43-L51)）が、これは DB の **単一列 `@unique`** と不整合になりうる。admin 版は **code 単独** + **P2002 捕捉** で行う。seller 版も他店舗/platform コードと衝突しうるため、第2段で seller `upsertCoupon` にも P2002 ハンドリングを追加する（tasks Phase 5・[5-B-6](./tasks.md)）。
>
> **一意性の SSOT と P2002 メッセージの統一（判断4 補足）**: 一意性の **最終的な SSOT は DB の `code @unique`（P2002）** とする。seller の `findFirst` 事前チェックは UX 高速フィードバック用の**楽観的チェックとして残す**が、`findFirst`→`upsert` 間の TOCTOU レース（同一 code の並行挿入）に対する**最終防御は P2002 捕捉**である。P2002 のユーザー向けメッセージは **admin / seller で完全一致**させ、canonical は日本語「このクーポンコードは既に使用されています」（[F3-5](./requirements.md) / AC-F3-2）。seller の既存英語メッセージ（`Coupon with the same code "..." already exists for this store.`）は Phase 5-B-6 でこの日本語文言へ統一する。**NFR-8（「文言は既存に倣う」）との関係**: 本メッセージは admin 仕様で日本語が canonical のため、seller 側を日本語へ寄せて「既存（=本機能で確立した）文言」に倣う形で統一する。

### 4.2 Zod スキーマ（`src/lib/schemas.ts` に追加）

現状 `CouponFormSchema`（[schemas.ts:522-548](../../../src/lib/schemas.ts#L522-L548)）は `code`/`startDate`/`endDate`/`discount` のみ。admin 拡張版を派生する。

```typescript
import { z } from "zod";

export const CouponScopeEnum = z.enum(["STORE", "PLATFORM"]);

// 第1段: isActive を追加。第2段: scope + 条件付き storeId
export const AdminCouponFormSchema = z.object({
    code: z.string().min(2).max(50).regex(/^[A-Za-z0-9]+$/, {
        message: "Coupon code can only contain letters and numbers.",
    }),
    startDate: z.string(),
    endDate: z.string(),
    discount: z.number().min(1).max(99),       // 既存維持（1-99）
    isActive: z.boolean().default(true),        // 第1段
    scope: CouponScopeEnum.default("STORE"),    // 第2段
    storeId: z.string().nullable().optional(),  // 第2段
}).superRefine((val, ctx) => {
    // F3-10: STORE なら storeId 必須、PLATFORM なら null/空
    if (val.scope === "STORE" && !val.storeId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["storeId"],
            message: "店舗クーポンには店舗の指定が必要です" });
    }
    if (val.scope === "PLATFORM" && val.storeId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["storeId"],
            message: "プラットフォームクーポンに店舗は指定できません" });
    }
});
```

> **第1段では `scope`/`storeId` のフィールドは追加するが UI 上は非表示（既定 STORE）** とし、第2段でスキーマ migrate 後に活性化してもよい。段階導入の粒度は tasks.md を参照。

### 4.3 UI

- **`page.tsx`**（新規）: `getAllCoupons()` を DataTable に渡す。`force-dynamic`。
- **`columns.tsx`**（新規）: seller 版（[coupons/columns.tsx](../../../src/app/dashboard/seller/stores/[storeUrl]/coupons/columns.tsx)）に **Store 列 + Active バッジ** を追加。`toggleCouponActive` を呼ぶトグルを配置。
- **`new/page.tsx`**（新規）: seller 同様の専用作成ページ。`AdminCouponDetails` フォームを描画。
- **`admin-coupon-details.tsx`**（新規・[coupon-details.tsx](../../../src/components/dashboard/forms/coupon-details.tsx) から派生）: 既存フォームに **store 選択ドロップダウン + scope 切替 + active トグル** を追加。`AdminCouponFormSchema` を resolver に使用。`upsertCouponAsAdmin` を呼ぶ。scope ドロップダウン連動で storeId セレクトの活性/必須を切り替える（F3-10）。
  - 既存 `coupon-details.tsx` は `storeId: ''` をサーバーへ渡す（[L100](../../../src/components/dashboard/forms/coupon-details.tsx#L100)）が、admin 版は **store 選択値 or null（PLATFORM 時）** を渡す。

---

## 5. スキーマ変更

> **判断3**: クーポン機能を **後方互換の第1段** と **破壊的な第2段** に分割。破壊性の境界を明示する。
> ER 図の再生成（`bun run erd:generate`）を各段で必須（[03-data-model-diagram-sync.md](../../../.claude/rules/03-data-model-diagram-sync.md)）。

### 5.1 スキーマ変更（第1段・後方互換）

`Coupon` に **`isActive` を追加**するのみ。既存行は default で有効。`migrate dev` で履歴化。

```prisma
model Coupon {
  // ...既存フィールド（code @unique / startDate / endDate / discount / storeId 必須）...
  isActive  Boolean @default(true)   // ← 追加（第1段）
  // ...
}
```

- マイグレーション: `bunx prisma migrate dev`（ローカル）。後方互換のため破壊性なし。
- **`safe-migration` skill は不要**（列追加・default 付き・非破壊）。ただし ER 図再生成は必須。

### 5.2 スキーマ変更（第2段・platform-wide）

> **破壊的変更。[safe-migration skill](../../../.claude/skills/safe-migration/) 必須。** `storeId: String → String?` への変更が既存の決済フローを壊す（[§判断4](#判断4の影響箇所マトリクス3箇所)）。

```prisma
enum CouponScope {
  STORE
  PLATFORM
}

model Coupon {
  // ...
  scope    CouponScope @default(STORE)   // ← 追加
  storeId  String?                        // ← 必須 → nullable（破壊的）
  store    Store? @relation("CouponToStore", fields: [storeId], references: [id], onDelete: Cascade)
  // ...
}
```

- **前提（NFR-9・判断5-5）**: この migrate の **前に** コードの null セーフ化を先行させる（[§5-5](#5-5-下位互換性確保--storeid-nullable-化の退行防止)）。
- **代替案（design に明記）**: 有効/無効を第2段にまとめる案（第1段スキーマ変更ゼロ）もある。第1段で `isActive` を入れる利点は「platform-wide を待たずに有効/無効切替を提供できる」こと。レビュー判断に委ねる。

### 判断4の影響箇所マトリクス（3箇所）

> **最重要**。`storeId: String → String?` は、storeId の **等価比較** と `coupon.store` への **非null前提アクセス** を含む既存 3 箇所を実行時に壊す。第2段タスクに「改修 + 回帰テスト」を必須で含める。

| # | 箇所 | 現状（行） | `storeId=null` での破綻 | 改修方針 |
| --- | --- | --- | --- | --- |
| 1 | `applyCoupon`<br>[coupon.ts:240-289](../../../src/queries/coupon.ts#L240-L289) | `cart.cartItems.filter(i => i.storeId === storeId)`（L242）/ メッセージ `${coupon.store.name}`（L289） | 全 item 対象外→「No items」誤エラー / `store=null` で **TypeError** | `scope===PLATFORM` は全 cartItems を対象。成功メッセージを store 非依存の汎用文言へ条件分岐 |
| 2 | `placeOrder`<br>[user.ts:642-665](../../../src/queries/user.ts#L642-L665) | `check = storeId === cartCoupon?.storeId`（L642）/ `couponId: check ? id : null`（L665） | 全 OrderGroup で `check=false` → **割引消失（満額で注文作成）**・couponId 未紐付け | `check = scope==='PLATFORM' \|\| storeId === cartCoupon?.storeId`。PLATFORM は各 OrderGroup の `groupedTotalPrice` に `discount%` を適用し、全該当グループに couponId を紐付け |
| 3 | カート再計算（`saveUserCart`）<br>[user.ts:1082-1148](../../../src/queries/user.ts#L1082-L1148) | `i.storeId === coupon.storeId`（L1082）/ 返却時 `cart.coupon.store.<Decimal4種>.toNumber()`（L1138-1148） | 割引未適用 / `store=null` で **TypeError** | PLATFORM は全 item 対象。返却整形で `cart.coupon.store` を null ガード（`store ? {...toNumber} : null`） |

#### Before / After 擬似コード

**#1 `applyCoupon`（coupon.ts）**

```typescript
// Before（L240-289 抜粋）
const storeId = coupon.storeId;
const storeItems = cart.cartItems.filter((item) => item.storeId === storeId);
if (storeItems.length === 0) throw new Error("No items in the cart belong to the store...");
// ...
return { message: `Coupon applied... applied to items from ${coupon.store.name}`, cart: updatedCart };

// After（scope 対応 + null セーフ + Decimal 化は判断5-4）
const isPlatform = coupon.scope === "PLATFORM";
const targetItems = isPlatform
    ? cart.cartItems
    : cart.cartItems.filter((item) => item.storeId === coupon.storeId);
if (targetItems.length === 0) throw new Error("No applicable items in the cart for this coupon.");
// ...（金額演算は Prisma.Decimal で・判断5-4）...
const scopeLabel = isPlatform ? "全店舗" : (coupon.store?.name ?? "対象店舗");
return { message: `Coupon applied successfully. Discount: -$${discountedAmount.toFixed(2)} applied to items from ${scopeLabel}`, cart: updatedCart };
```

**#2 `placeOrder`（user.ts のループ内 L642-665）**

```typescript
// Before
const check = storeId === cartCoupon?.storeId;
let discountedAmount = new Prisma.Decimal("0");
if (check && cartCoupon) {
    discountedAmount = groupedTotalPrice.mul(cartCoupon.discount).div(100);
}
// ...
couponId: check && cartCoupon ? cartCoupon?.id : null,

// After（PLATFORM は全グループ適用 + couponId 紐付け）
const isPlatform = cartCoupon?.scope === "PLATFORM";
const check = isPlatform || storeId === cartCoupon?.storeId;
let discountedAmount = new Prisma.Decimal("0");
if (check && cartCoupon) {
    discountedAmount = groupedTotalPrice.mul(cartCoupon.discount).div(100);
    // 判断5-4: 端数は最終グループで吸収（総割引 − Σ確定済グループ割引）
}
// ...
couponId: check && cartCoupon ? cartCoupon.id : null,
```

> **F3-9 の整合性**: PLATFORM は各 OrderGroup に同率 % を適用するため、理論合計はカート割引と一致する。`Decimal(12,2)` 丸めで生じる最大数セントの差は、**最終 OrderGroup** で `総割引 − Σ(確定済グループ割引)` を割り当てて吸収する（判断5-4）。

**#3 `saveUserCart`（user.ts 返却整形 L1135-1150）**

```typescript
// Before（L1135-1150）
coupon: cart.coupon
    ? { ...cart.coupon, store: { ...cart.coupon.store,
          defaultShippingFeePerItem: cart.coupon.store.defaultShippingFeePerItem.toNumber(), /* ...他3種... */ } }
    : null,

// After（store を null ガード）
coupon: cart.coupon
    ? { ...cart.coupon,
        store: cart.coupon.store
            ? { ...cart.coupon.store,
                defaultShippingFeePerItem: cart.coupon.store.defaultShippingFeePerItem.toNumber(), /* ...他3種... */ }
            : null }
    : null,
```

> **決済プロバイダ境界（C-a）**: F2 の `paymentStatus` 手動変更（Paid/Refunded 等）は **DB ステータス更新のみ**。Stripe/PayPal の Refund/Capture API 自動呼び出しはスコープ外。

---

## 判断5: アーキテクチャ品質要件

> 既存実装の実地確認に基づくエンタープライズ品質要件。各機能の設計に反映する。

### 5-1. ダッシュボード集計のキャッシュ戦略

- **既存事実**: `src/` にキャッシュ戦略は皆無（`unstable_cache`/`revalidate*` 使用ゼロ）、全 DB 依存ページが `force-dynamic`。
- **設計**: `getAdminDashboardStats()` は `_sum`/`count`/`groupBy` を `Promise.all` で並列化しつつ、**`unstable_cache` で 20 分キャッシュ**（§2.1 実装）。`requireAdmin()` は **キャッシュの外**で呼ぶ（認可結果をキャッシュに含めない）。
- **tech.md 整合**: ページは `force-dynamic` を維持し、**統計取得関数だけ**をデータキャッシュ層で包む（動的ページ × キャッシュ済みデータの分離）。
- **ロードマップ**: 数十万件規模では集計サマリーテーブル（`DashboardSnapshot`: 日次バッチ）/ マテビュー導入を将来拡張に。集計対象列（`Order.paymentStatus`・`createdAt`、`Store.status`）のインデックス確認を tasks に含める。

### 5-2. ステータス変更時の売上整合性（在庫連動は今回スコープ外）

- **在庫管理は別タスク**: 在庫の減算・復元・カート永続化・在庫予約は仕様確定後に別途実装（スコープ外）。現状 `placeOrder` は `Size.quantity` を減算しない（既知ギャップ）。admin ステータス変更 action には **将来の在庫連動フック位置（TODO コメント）のみ**残す。
- **売上集計の返金考慮**: 総売上は `paymentStatus = Paid` のみ集計し `Refunded`/`Cancelled`/`Failed` を除外。**`PartiallyRefunded` は Order に返金額フィールドが無い**ため正確な減算不可 → 「現状は総売上から全額除外」とし、正確な部分返金には将来 `Order.refundedAmount Decimal(12,2)` 追加が必要（C-e）。
- **副作用マトリクス**（在庫欄は「在庫管理仕様で別途」）:

| 変更先ステータス | 売上への影響 | 在庫への影響 |
| --- | --- | --- |
| `Paid` | 総売上に算入 | 在庫管理仕様で別途 |
| `Refunded` / `Cancelled` | 総売上から除外 | 在庫管理仕様で別途（復元想定） |
| `PartiallyRefunded` | 総売上から **全額除外**（C-e） | 在庫管理仕様で別途 |
| `Pending` / `Failed` / `Declined` | 総売上に算入しない | 影響なし |

### 5-3. 認可境界・特権昇格・監査

- **UI 共通化の型安全**: `OrderStatusSelect` 等を admin/seller 共用する際、**discriminated union props**（`{ mode:'seller'; storeId } | { mode:'admin' }`）でアクションを静的に切替え、seller 文脈に admin action が混入しないことを **型レベルで保証**（§3.4）。
- **多層防御**: admin Server Action（`AsAdmin`）は冒頭 `requireAdmin()` 必須。layout の redirect と二重化。
- **監査ログ**: 状態変更系 admin action に `[Admin:Action] actor=<userId> target=<id> from=<x> to=<y>` 形式の構造化ログを残す（`console.log` 禁止規約に抵触しない手段。`console.error` を構造化ログとして使用）。永続監査が要件化したら `AuditLog` テーブルをロードマップへ。
- **IDOR**: admin は `requireAdmin` で全件許可（正当）。seller 既存 query の `requireStoreOwner` は不変。認可テストは 3 階層パターン（[SECURITY_GAP_REPORT.md §5.2](../../testing/SECURITY_GAP_REPORT.md)）。

### 5-4. 金額計算の Decimal 一貫性と按分

- **既存事実**: `placeOrder` は `Prisma.Decimal` チェーンで一貫（良）。一方 **`applyCoupon`（[coupon.ts:253-267](../../../src/queries/coupon.ts#L253-L267)）は `.toNumber()` 経由の JS 浮動小数点演算**（精度リスク）。
- **設計**: 金額演算は全工程 `Prisma.Decimal`（`.add/.sub/.mul/.div`）で行い、`.toNumber()` は **シリアライズ/表示直前のみ**。`applyCoupon` の Number 演算の Decimal 化を第2段の改修に含める（既存精度バグの修正も兼ねる）。
- **按分アルゴリズム**: 現状 `discount` は **Int の % のみ**。PLATFORM は各 OrderGroup に **同率 %** を適用 → ％演算のため理論合計はカート割引と一致。`Decimal(12,2)` 丸めで生じる **最大数セントの差は最終 OrderGroup で吸収**（`総割引 − Σ(確定済グループ割引)` を最終グループに割当）。
- **将来拡張**: 定額割引（`discountType: PERCENT|FIXED`）導入時は「各ストア小計の比率で按分 + 最終グループで端数吸収」を採用。

### 5-5. 下位互換性確保 — storeId nullable 化の退行防止

- **設計**: `storeId` の nullable 化は、`getStoreCoupons`/`applyCoupon`/`saveUserCart`/`placeOrder`/クーポン UI（`coupon-details`・columns）で `coupon.storeId`・`coupon.store` を非null前提で扱う箇所をランタイムで壊しうる。
- **順序（tasks.md で第2段の直前に「下位互換性確保ステップ」を新設）**:
  1. 既存コードを **null セーフ化**（`coupon.store?.name ?? '全店舗'` 等、スキーマは非nullのまま **先行防御**）
  2. `bunx tsc --noEmit` + 既存テスト緑を確認
  3. `safe-migration` で nullable 化
  4. platform-wide 機能追加
- **原則**: **コード防御を先・スキーマ変更を後** にして退行を吸収する。

---

## 判断6: 状態整合性・認可 SSOT・入力上限

### 6-1. クーポン無効化のすり抜け再検証

- **既存事実**: `placeOrder`（[user.ts:646](../../../src/queries/user.ts#L646)）と `applyCoupon` は期限（startDate/endDate）のみ検証し `isActive` を見ない。
- **設計**: 第1段の `isActive` 追加と **同時に**、`placeOrder` のクーポン適用判定と `applyCoupon` に **`coupon.isActive === true` の再検証**を追加（F3-6）。カート適用後に管理者が無効化しても、注文確定時に「このクーポンは現在無効です」で弾き、トランザクションをロールバック。

### 6-2. Order と OrderGroup のステータス伝播

- **設計**: 親 Order ↔ 子 OrderGroup/OrderItem の状態遷移ルールをステートマシンとして定義（§3.2）。連動規則:
  - (a) 親 Order を Canceled/Refunded → 全 OrderGroup/OrderItem を一括連動（同一 `db.$transaction`）。
  - (b) 全 OrderGroup が Shipped → 親 Order を Shipped、一部のみ → PartiallyShipped に集約更新。
  - `updateOrderGroupStatusAsAdmin`/`updateOrderPaymentStatus` は単独実行でも親子整合を保つトリガーロジック（`reconcileParentOrderStatus`）を持つ。（在庫連動はスコープ外）

### 6-3. 論理削除ストアの統計スコープ

- **既存事実**: `getAllStores` は `isDeleted` 未フィルタ。`deleteStore` は `isDeleted:true` のソフト削除。
- **設計**: 統計の境界条件を明文化 —
  - **ストア数カウントは `isDeleted:false` のみ**（F1-4）。
  - **売上集計は論理削除ストアの Paid 注文も維持**（F1-5・過去の会計実績を保全）。
  - `getAdminDashboardStats` で両スコープを分離実装（§2.1: store.groupBy に `where:{isDeleted:false}`、order.aggregate には isDeleted フィルタを付けない）。

### 6-4. 認可ロールの SSOT

- **既存事実**: Clerk Webhook（`/api/webhooks/clerk/route.ts`）が `db.user.upsert({ id: data.id, role: data.private_metadata?.role || "USER" })` で **Clerk user.id を DB User.id の主キーに直結**し、**Clerk `privateMetadata.role` を DB `User.role` へ一方向同期**している。
- **設計**: **認可の SSOT = Clerk `privateMetadata.role`**（middleware/layout が参照）。DB `User.role` はミラー（Webhook 経由で同期）。ロール変更 Server Action（将来のユーザー管理含む）では **Clerk `updateUserMetadata` 更新 → Webhook（user.updated）が DB へ伝播**を正道とし、DB 直書きで Webhook 同期と競合させない。**本 3 機能はロール変更を含まない**ため、認可 SSOT 原則として記載するに留める。

### 6-5. ページネーション上限キャップ

- **設計**: `getAllOrders`/`getAllCoupons` の `limit` を **Zod で `z.number().int().min(1).max(100)`・デフォルト 20**（§3.1/§4.1）。URL パラメータは tech.md の `Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1` 正規化に **上限キャップ**を併用し、`limit=500000` 等の極端値による OOM/DoS を防止（F2-5）。Prisma は `take`/`skip` で実装。

---

## 6. 新規 / 変更ファイル一覧（実装チェックリスト）

| 種別 | パス | 機能 | フェーズ |
| --- | --- | --- | --- |
| 新規 | `src/queries/dashboard.ts` | F1 統計集計 | Phase 2 |
| 変更 | `src/queries/order.ts` | F2 admin query 4 種追加 | Phase 1 |
| 変更 | `src/queries/coupon.ts` | F3 admin query 4 種 + 影響箇所改修 | Phase 3/5 |
| 変更 | `src/queries/user.ts` | placeOrder/saveUserCart の影響箇所改修（第2段） | Phase 4/5 |
| 変更 | `src/lib/types.ts` | `AdminOrderType` 等追加 | Phase 1 |
| 変更 | `src/lib/schemas.ts` | `AdminCouponFormSchema` 追加 | Phase 3 |
| 変更 | `prisma/schema.prisma` | `isActive`（第1段）/ `scope`+nullable storeId（第2段） | Phase 3/5 |
| 変更 | `src/app/dashboard/admin/page.tsx` | F1 本体（プレースホルダー置換） | Phase 2 |
| 新規 | `src/app/dashboard/admin/orders/{page,columns}.tsx` | F2 UI | Phase 1 |
| 新規 | `src/app/dashboard/admin/coupons/{page,columns}.tsx` + `new/page.tsx` | F3 UI | Phase 3 |
| 変更 | `src/components/dashboard/forms/order-status-select.tsx` | discriminated union 化 | Phase 1 |
| 新規 | `src/components/dashboard/forms/admin-coupon-details.tsx` | F3 フォーム | Phase 3 |
| 新規 | `src/components/dashboard/admin/*` | F1 KPI/チャート/リスト | Phase 2 |

> 実装順・TDD ステップ・コミット粒度・並列可否は [tasks.md](./tasks.md) を参照。
