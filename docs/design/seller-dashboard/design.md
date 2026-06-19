# 販売者ダッシュボード 2 機能 — 詳細設計（design.md）

> 本ドキュメントは **実装の中核**。query シグネチャ・コンポーネント・スキーマ変更・既存コードへの影響箇所を、後続セッション（Sonnet 可）が **該当行を特定して差分修正できる粒度** で記述する。
> 要件 ID は [requirements.md](./requirements.md)、実装順は [tasks.md](./tasks.md) を参照。

---

## 0. 設計の前提（実地確認済みの事実）

本設計は以下の **現行コードの実地確認** に基づく（行番号は確認時点）。

| 確認対象 | パス | 確認結果 |
| --- | --- | --- |
| 認可ガード（店舗所有） | [src/lib/auth-guards.ts:87](../../../src/lib/auth-guards.ts#L87) | `requireStoreOwner(storeUrl): Promise<{ user; store }>`。SELLER + `db.store.findUnique({ where:{ url, userId } })`。非所有で `"Forbidden: store not owned by current user."` |
| 認可ガード（SELLER） | [src/lib/auth-guards.ts:69](../../../src/lib/auth-guards.ts#L69) | `requireSeller()`。role 不一致で `"Only sellers can perform this action."` |
| 統計 query 雛形 | [src/queries/dashboard.ts](../../../src/queries/dashboard.ts) | admin 版 `getAdminDashboardStats`/`getSalesOverTime`/`getRecentOrders`。`unstable_cache`（20 分）+ `Promise.all` + 構造化ログ。**`requireAdmin()` はキャッシュ外**で呼ぶ |
| 店舗注文 query | [src/queries/store.ts](../../../src/queries/store.ts) | `getStoreOrders(storeUrl)` は `requireStoreOwner` → `db.orderGroup.findMany({ where:{ storeId } })` |
| Store モデル | [prisma/schema.prisma:80](../../../prisma/schema.prisma#L80) | `Int` default フィールド多数（`numReviews`・`defaultDeliveryTimeMin:99`・`defaultDeliveryTimeMax:100`）。**`lowStockThreshold` 無し** |
| Product モデル | [prisma/schema.prisma:125](../../../prisma/schema.prisma#L125) | `views Int @default(0)`（L135）・`sales Int @default(0)`（L132）・`storeId`（L143） |
| ProductVariant モデル | [prisma/schema.prisma:167](../../../prisma/schema.prisma#L167) | `sales Int @default(0)`（L177）・`sizes Size[]`（L183） |
| Size モデル | [prisma/schema.prisma:195](../../../prisma/schema.prisma#L195) | `quantity Int`（L198）= **在庫数**・`price Decimal(12,2)`（L199）・`productVariantId`（L204） |
| OrderGroup モデル | [prisma/schema.prisma:521](../../../prisma/schema.prisma#L521) | `total Decimal(12,2)`（L533）・`storeId`（L538）・`status OrderStatus`（L523）・`@@index([storeId])`（L548）。**`paymentStatus` 無し** |
| Order モデル | [prisma/schema.prisma:494](../../../prisma/schema.prisma#L494) | `paymentStatus PaymentStatus`（L503）・`total Decimal(12,2)`（L498）・`groups OrderGroup[]`（L500） |
| OrderItem モデル | [prisma/schema.prisma:604](../../../prisma/schema.prisma#L604) | `sizeId`（L609）・`quantity Int`（L617）・`status ProductStatus`（L625） |
| 注文確定 | [src/queries/user.ts:609](../../../src/queries/user.ts#L609) | `placeOrder` の `$transaction`。OrderItem 作成ループ（L696-715）。数量クランプ `validQuantity = Math.min(quantity, size.quantity)`（L494）だが **`Size.quantity` は減算しない**（既知ギャップ） |
| Decimal 変換 | [src/lib/utils.ts:25](../../../src/lib/utils.ts#L25) | `toNumberSafe(value: unknown): number` |
| seller layout | [src/app/dashboard/seller/stores/[storeUrl]/layout.tsx](../../../src/app/dashboard/seller/stores/[storeUrl]/layout.tsx) | `role !== "SELLER"` で `redirect("/")`（インライン認可。画面アクセス制御層） |
| プレースホルダー | [src/app/dashboard/seller/stores/[storeUrl]/page.tsx](../../../src/app/dashboard/seller/stores/[storeUrl]/page.tsx) | `<div>SellerStorePage</div>`（置換対象・F1） |
| sidebar | [src/constants/data.ts:41](../../../src/constants/data.ts#L41) | `SellerDashboardSidebarOptions`。`inventory` リンク（L57-61）は **既に存在**（ページが未作成） |
| 既存型 | [src/lib/types.ts](../../../src/lib/types.ts) | `StoreOrderType = Prisma.PromiseReturnType<typeof getStoreOrders>[0]`（OrderGroup 起点） |
| KPI カード | [src/components/dashboard/admin/stats-cards.tsx](../../../src/components/dashboard/admin/stats-cards.tsx) | `StatsCards`（shadcn Card のグリッド） |
| 売上チャート | [src/components/dashboard/admin/sales-chart.tsx](../../../src/components/dashboard/admin/sales-chart.tsx) | `SalesChart`（`@tremor/react` AreaChart・`SalesPoint[]` を受け取る） |

---

## 1. 共通設計

### 1.1 ルーティング規約（force-dynamic 必須）

DB 依存の各 `page.tsx` は、import 群の直後に動的レンダリングを宣言する（[tech.md DB 依存ページ規約](../../../.claude/steering/tech.md)）。

```typescript
// 例: src/app/dashboard/seller/stores/[storeUrl]/inventory/page.tsx
import { getStoreInventory } from "@/queries/inventory";
// ...他 import...

export const dynamic = 'force-dynamic';   // ← import 直後に宣言

export default async function SellerInventoryPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;   // Next.js 16: params は Promise
    // ...
}
```

> **キャッシュとの両立（F1）**: ページは `force-dynamic` のまま、**統計取得関数だけ**をデータキャッシュ層（`unstable_cache`）で包む。キャッシュキーには `storeId` を含める（NFR-8・店舗間混線防止）。

### 1.2 ディレクトリ構成（新規作成 / 変更）

```
src/app/dashboard/seller/stores/[storeUrl]/
├── page.tsx                       [変更] プレースホルダー → ダッシュボード本体（F1）
└── inventory/
    ├── page.tsx                   [新規] 在庫一覧（DataTable + アラートサマリー + しきい値設定）（F2）
    └── columns.tsx                [新規] バリアント×サイズ列 + 在庫数編集セル + ステータスバッジ（F2）

src/queries/
├── inventory.ts                   [新規] getStoreInventory / updateSizeStock / updateStoreLowStockThreshold（F2）
├── store-dashboard.ts             [新規] getStoreDashboardStats / getStoreSalesOverTime / getStoreRecentOrders / getStoreTopProducts（F1）
└── user.ts                        [変更] placeOrder に在庫減算を追加（F3）

src/components/dashboard/seller/    [新規ディレクトリ]
├── inventory-quantity-cell.tsx    [新規] 在庫数のインライン編集（client・リエントランシーガード）（F2）
├── stock-status-badge.tsx         [新規] 在庫切れ/過小/十分 バッジ（F2）
├── low-stock-threshold-form.tsx   [新規] 店舗しきい値設定フォーム（F2）
├── inventory-alert-summary.tsx    [新規] 在庫切れ/過小の件数サマリー（F2）
├── store-stats-cards.tsx          [新規] 店舗 KPI カード（admin StatsCards を一般化）（F1）
├── store-recent-orders.tsx        [新規] 最近の注文リスト（F1）
└── store-top-products.tsx         [新規] 販売上位商品リスト（F1）

src/lib/
├── types.ts                       [変更] StoreInventoryRow / StoreDashboardStats 等を追加
└── schemas.ts                     [変更] UpdateSizeStockSchema / LowStockThresholdSchema を追加

prisma/schema.prisma               [変更] Store に lowStockThreshold 追加（Phase 1・additive）
```

> F1 統計チャートは [admin/sales-chart.tsx](../../../src/components/dashboard/admin/sales-chart.tsx) の `SalesChart`（`SalesPoint[]` 受け取り）を**そのまま流用**するため、seller 側に新規チャートは作らない。

### 1.3 再利用元マトリクス

> **判断1**: admin ダッシュボードに同等機能が実装済み。seller 版は「店舗スコープ」への特化として設計し、新規発明を最小化する。

| 再利用元 | パス | seller での扱い |
| --- | --- | --- |
| 認可ガード | [requireStoreOwner](../../../src/lib/auth-guards.ts#L87) | 全 query の冒頭で呼ぶ（store.id を取得 → 全 where に注入） |
| 統計 query 雛形 | [dashboard.ts](../../../src/queries/dashboard.ts) | `getAdminDashboardStats` 等を **storeId 絞り込み版**へ写す。`unstable_cache` + `Promise.all` 構造を踏襲 |
| 売上推移チャート | [sales-chart.tsx](../../../src/components/dashboard/admin/sales-chart.tsx) | `SalesPoint[]` 型のまま **そのまま流用**（依存追加なし・`@tremor/react`） |
| KPI カード | [stats-cards.tsx](../../../src/components/dashboard/admin/stats-cards.tsx) | 表示項目が店舗向けに異なるため **`store-stats-cards.tsx` を派生**（同じ shadcn Card グリッド構造） |
| データテーブル | [data-table.tsx](../../../src/components/ui/data-table.tsx) | 在庫一覧で流用（`filterValue="name"` で商品名検索） |
| 店舗注文取得パターン | [getStoreOrders](../../../src/queries/store.ts) | `getStoreRecentOrders` の where/include を踏襲 |
| Decimal→number | [toNumberSafe()](../../../src/lib/utils.ts#L25) | 金額集計・表示の return 境界で使用 |
| モーダル/トースト | `useModal()` / `useToast()`（[hooks/use-toast](../../../src/hooks/use-toast.ts)） | 在庫クイック編集の成功/失敗通知 |
| リエントランシーガード | [tech.md リエントランシーガード](../../../.claude/steering/tech.md)（`useRef` フラグ） | 在庫編集セルの多重送信防止 |
| 数量クランプ値 | [user.ts:494](../../../src/queries/user.ts#L494) `validQuantity` | F3 の減算量として使用（クランプと整合） |

### 1.4 認可方針

> **判断2**: 既存パターンに倣い、新規 query はすべて `requireStoreOwner` で正道実装する。

- 新規 seller query はすべて [requireStoreOwner(storeUrl)](../../../src/lib/auth-guards.ts#L87) を冒頭で呼ぶ（SELLER ロール + 店舗所有権の同時検証）。`if (!user) ... if (role !== ...)` のインライン展開を新規追加しない（CLAUDE.md 準拠）。
- **多層防御**: layout の `redirect("/")`（画面アクセス制御）に加え、各 server action が再度 `requireStoreOwner` を呼ぶ。
- **IDOR の二段検証**（在庫編集）: `requireStoreOwner` は「呼び出し元が storeUrl の所有者か」を保証するが、`updateSizeStock(sizeId, ...)` の `sizeId` が**その店舗に属するか**は別途検証が必要（[判断4](#判断4-在庫クイック編集-updatesizestock)）。
- **認可ガードは `try/catch` の外**に置く（認可エラーを汎用 DB エラーで上書きしない・[tech.md](../../../.claude/steering/tech.md)）。

---

## 2. F2: 在庫管理（`/dashboard/seller/stores/[storeUrl]/inventory`）

> 対応要件: F2-1〜F2-8。**優先度「高」のため実装は Phase 2（最初の機能フェーズ）**。

### 2.1 新規 query（`src/queries/inventory.ts`）

```typescript
"use server";

import { db } from "@/lib/db";
import { requireStoreOwner } from "@/lib/auth-guards";
import { UpdateSizeStockSchema, LowStockThresholdSchema } from "@/lib/schemas";

/** 在庫一覧の 1 行（バリアント×サイズ単位）。Decimal は number 化済み。 */
export type StoreInventoryRow = {
    sizeId: string;
    productName: string;
    variantName: string;
    size: string;          // "S" / "M" など
    quantity: number;      // 現在庫数（Size.quantity）
    price: number;         // 表示用（Size.price を number 化）
    sku: string;
    productSlug: string;
    variantId: string;
};

/**
 * @function getStoreInventory
 * @description 当該店舗の全 Size を「商品→バリアント→サイズ」の階層で取得し、
 *              在庫一覧用にフラット化して返す。
 * @access SELLER（店舗所有者のみ）
 * @param storeUrl 店舗 URL
 * @returns StoreInventoryRow[]（バリアント×サイズ単位）
 */
export const getStoreInventory = async (
    storeUrl: string
): Promise<StoreInventoryRow[]> => {
    const { store } = await requireStoreOwner(storeUrl); // 認可は try/catch の外
    try {
        const products = await db.product.findMany({
            where: { storeId: store.id },
            select: {
                name: true,
                slug: true,
                variants: {
                    select: {
                        id: true,
                        variantName: true,
                        sku: true,
                        sizes: {
                            select: {
                                id: true,
                                size: true,
                                quantity: true,
                                price: true,
                            },
                        },
                    },
                },
            },
        });

        // 商品→バリアント→サイズ をフラット化（Decimal は return 境界で number 化）
        return products.flatMap((p) =>
            p.variants.flatMap((v) =>
                v.sizes.map((s) => ({
                    sizeId: s.id,
                    productName: p.name,
                    variantName: v.variantName,
                    size: s.size,
                    quantity: s.quantity,
                    price: s.price.toNumber(),
                    sku: v.sku,
                    productSlug: p.slug,
                    variantId: v.id,
                }))
            )
        );
    } catch (error: unknown) {
        console.error("[Inventory:getStoreInventory] Error", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw new Error("Failed to fetch store inventory.");
    }
};

/**
 * @function updateSizeStock
 * @description 在庫数のクイック編集。店舗所有権 + Size の所有権チェーンを検証してから更新する。
 * @access SELLER（店舗所有者のみ・対象 Size が当該店舗の商品階層に属すること）
 * @param sizeId  更新対象の Size
 * @param quantity 新しい在庫数（int ≥ 0）
 * @param storeUrl 店舗 URL（所有権検証用）
 */
export const updateSizeStock = async (
    sizeId: string,
    quantity: number,
    storeUrl: string
): Promise<{ sizeId: string; quantity: number }> => {
    const { store } = await requireStoreOwner(storeUrl); // 認可は try/catch の外

    // 入力バリデーション（Zod・int ≥ 0）
    const parsed = UpdateSizeStockSchema.safeParse({ sizeId, quantity });
    if (!parsed.success) {
        throw new Error("在庫数は 0 以上の整数で指定してください。");
    }

    try {
        // IDOR 防止: size → variant → product.storeId が当該店舗か検証
        const owned = await db.size.findFirst({
            where: {
                id: sizeId,
                productVariant: { product: { storeId: store.id } },
            },
            select: { id: true },
        });
        if (!owned) {
            // 他店舗の Size を指定した場合（副作用を起こさず拒否）
            throw new Error("Forbidden: size not owned by current store.");
        }

        const updated = await db.size.update({
            where: { id: sizeId },
            data: { quantity: parsed.data.quantity },
            select: { id: true, quantity: true },
        });
        return { sizeId: updated.id, quantity: updated.quantity };
    } catch (error: unknown) {
        console.error("[Inventory:updateSizeStock] Error", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error; // 認可/Forbidden はそのまま伝播
    }
};

/**
 * @function updateStoreLowStockThreshold
 * @description 店舗単位の過小在庫しきい値を更新する（在庫アラートのバッジ判定に使用）。
 * @access SELLER（店舗所有者のみ）
 */
export const updateStoreLowStockThreshold = async (
    storeUrl: string,
    threshold: number
): Promise<{ lowStockThreshold: number }> => {
    const { store } = await requireStoreOwner(storeUrl);
    const parsed = LowStockThresholdSchema.safeParse({ threshold });
    if (!parsed.success) {
        throw new Error("しきい値は 0 以上の整数で指定してください。");
    }
    try {
        const updated = await db.store.update({
            where: { id: store.id },
            data: { lowStockThreshold: parsed.data.threshold },
            select: { lowStockThreshold: true },
        });
        return { lowStockThreshold: updated.lowStockThreshold };
    } catch (error: unknown) {
        console.error("[Inventory:updateStoreLowStockThreshold] Error", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw new Error("Failed to update low stock threshold.");
    }
};
```

> **注**: `updateStoreLowStockThreshold` は `Store.lowStockThreshold`（Phase 1 で追加）に依存するため、**Phase 1 完了後**に実装する。`store.ts` に置く選択肢もあるが、在庫機能の凝集のため `inventory.ts` に集約する。

### 2.2 Zod スキーマ（`src/lib/schemas.ts` に追加）

```typescript
// 在庫数クイック編集（int ≥ 0・上限は運用上のサニティとして 1,000,000）
export const UpdateSizeStockSchema = z.object({
    sizeId: z.string().min(1),
    quantity: z.number().int().min(0).max(1_000_000),
});

// 店舗の過小在庫しきい値
export const LowStockThresholdSchema = z.object({
    threshold: z.number().int().min(0).max(1_000_000),
});
```

### 2.3 在庫ステータス判定（共通ヘルパー）

バッジ判定は UI・サマリーで共有するため、純粋関数として切り出す（`src/lib/utils.ts` または `stock-status-badge.tsx` 内）。

```typescript
export type StockStatus = "out" | "low" | "ok";

/** 在庫数としきい値から在庫ステータスを判定（F2-5）。 */
export function getStockStatus(quantity: number, threshold: number): StockStatus {
    if (quantity <= 0) return "out";          // 在庫切れ（赤）
    if (quantity <= threshold) return "low";  // 過小在庫（橙）
    return "ok";                              // 十分（通常）
}
```

### 2.4 UI コンポーネント

| コンポーネント | 役割 | 種別 |
| --- | --- | --- |
| `inventory/page.tsx` | Server Component。`getStoreInventory` + `store.lowStockThreshold` を取得し、サマリー・しきい値フォーム・DataTable を描画。`force-dynamic` | RSC |
| `inventory/columns.tsx` | TanStack 列定義（商品名・バリアント・サイズ・**在庫数編集セル**・価格・**ステータスバッジ**） | client |
| `inventory-quantity-cell.tsx` | 在庫数のインライン編集。`useState` で編集値、`useRef` でリエントランシーガード（[tech.md](../../../.claude/steering/tech.md)）、確定時 `updateSizeStock` → 成功 `toast` + `router.refresh()` | client |
| `stock-status-badge.tsx` | `getStockStatus` の結果でバッジ表示（赤/橙/通常） | client |
| `low-stock-threshold-form.tsx` | しきい値入力 + 保存（`updateStoreLowStockThreshold`）。リエントランシーガード | client |
| `inventory-alert-summary.tsx` | 在庫切れ/過小の件数を集計表示（props で行データを受け取り集計） | client/RSC どちらでも可 |

**在庫数インライン編集のパターン**（リエントランシーガード + 同期 setter、[tech.md](../../../.claude/steering/tech.md)）:

```tsx
"use client";
const isSubmittingRef = useRef(false);
const [value, setValue] = useState(initialQuantity);

const handleSave = async () => {
    if (isSubmittingRef.current) return;        // 早期リターン（多重送信防止）
    isSubmittingRef.current = true;
    try {
        await updateSizeStock(sizeId, value, storeUrl);
        toast({ title: "在庫数を更新しました" });
        router.refresh();                       // Server Component を再取得
    } catch (error: unknown) {
        toast({ variant: "destructive", title: "更新に失敗しました" });
        if (error instanceof Error) {
            console.error("[InventoryCell:save] Error:", error.message, error.stack);
        }
    } finally {
        isSubmittingRef.current = false;        // 必ず解放
    }
};
```

---

## 3. F1: 店舗ダッシュボード（`/dashboard/seller/stores/[storeUrl]`）

> 対応要件: F1-1〜F1-9。優先度「中」。Phase 2（在庫）の query パターンを再利用する。

### 3.1 新規 query（`src/queries/store-dashboard.ts`）

> admin の [dashboard.ts](../../../src/queries/dashboard.ts) を **storeId 絞り込み版**へ写す。`requireStoreOwner` はキャッシュ外で呼び、キャッシュキーに `storeId` を含める（NFR-8）。

```typescript
"use server";

import { db } from "@/lib/db";
import { requireStoreOwner } from "@/lib/auth-guards";
import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";

/** 店舗ダッシュボード KPI。Decimal は number 化済み（シリアライズ安全）。 */
export type StoreDashboardStats = {
    totalRevenue: number;     // Paid 注文に紐づく OrderGroup.total の合計
    totalOrders: number;      // 当該店舗の OrderGroup 件数
    totalViews: number;       // Σ Product.views（既存フィールド）
    totalSales: number;       // Σ Product.sales
    totalProducts: number;
    lowStockCount: number;    // quantity <= lowStockThreshold の Size 件数（0 含む）
};

/** チャート用売上データポイント（admin と同型・SalesChart で共用）。 */
export type SalesPoint = { label: string; revenue: number };

/**
 * @function getStoreDashboardStats
 * @description 店舗 KPI を並列集計する。requireStoreOwner() はキャッシュ外で認可。
 *              キャッシュキーに storeId を含め店舗間混線を防ぐ（NFR-8）。20 分キャッシュ。
 * @access SELLER（店舗所有者のみ）
 */
export const getStoreDashboardStats = async (
    storeUrl: string
): Promise<StoreDashboardStats> => {
    const { store } = await requireStoreOwner(storeUrl); // キャッシュ外で認可
    return getCachedStoreStats(store.id);
};

// storeId をキー・引数に含めることで店舗ごとに独立したキャッシュになる（NFR-8）
const getCachedStoreStats = (storeId: string) =>
    unstable_cache(
        async (): Promise<StoreDashboardStats> => {
            try {
                const [revenueAgg, totalOrders, viewsSalesAgg, totalProducts, lowStock] =
                    await Promise.all([
                        // 店舗売上 = OrderGroup.total のうち親 Order.paymentStatus=Paid のみ（判断5）
                        db.orderGroup.aggregate({
                            _sum: { total: true },
                            where: { storeId, order: { paymentStatus: "Paid" } },
                        }),
                        db.orderGroup.count({ where: { storeId } }),
                        // Σ views / Σ sales（Product 単位）
                        db.product.aggregate({
                            _sum: { views: true, sales: true },
                            where: { storeId },
                        }),
                        db.product.count({ where: { storeId } }),
                        // 過小/在庫切れ件数（しきい値は別取得した store.lowStockThreshold を渡す設計でも可）
                        db.size.count({
                            where: {
                                productVariant: { product: { storeId } },
                                quantity: { lte: /* store.lowStockThreshold */ 5 },
                            },
                        }),
                    ]);

                return {
                    totalRevenue: (revenueAgg._sum.total ?? new Prisma.Decimal(0)).toNumber(),
                    totalOrders,
                    totalViews: viewsSalesAgg._sum.views ?? 0,
                    totalSales: viewsSalesAgg._sum.sales ?? 0,
                    totalProducts,
                    lowStockCount: lowStock,
                };
            } catch (error: unknown) {
                console.error("[StoreDashboard:getStoreDashboardStats] Error", {
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                });
                throw new Error("Failed to aggregate store dashboard stats.");
            }
        },
        ["store-dashboard-stats", storeId],         // ← storeId をキャッシュキーに含める
        { revalidate: 60 * 20, tags: [`store-dashboard-${storeId}`] }
    )();
```

> **しきい値の扱い（lowStockCount）**: `lowStockThreshold` は店舗ごとに可変なので、上記の擬似コードの定数 `5` は **実装時に `getStoreDashboardStats` 冒頭で取得した `store.lowStockThreshold` をクロージャ経由で渡す**こと（`requireStoreOwner` が返す `store` に含まれる）。`getCachedStoreStats(store.id, store.lowStockThreshold)` の形にし、しきい値もキャッシュ引数へ含める。

`getStoreSalesOverTime` / `getStoreRecentOrders` / `getStoreTopProducts` は admin の `getSalesOverTime` / `getRecentOrders` を踏襲し、`where` に `storeId`（売上は `order: { paymentStatus: "Paid" }` join）を加える:

```typescript
/**
 * @function getStoreSalesOverTime
 * @description 店舗の Paid 売上を期間別に集計（admin getSalesOverTime の店舗スコープ版）。
 * @access SELLER
 */
export const getStoreSalesOverTime = async (
    storeUrl: string,
    period: "daily" | "monthly" = "monthly"
): Promise<SalesPoint[]> => {
    const { store } = await requireStoreOwner(storeUrl);
    // since 計算は admin と同一。findMany は OrderGroup を storeId + 親 Paid で絞る
    // const groups = await db.orderGroup.findMany({
    //   where: { storeId: store.id, order: { paymentStatus: "Paid" }, createdAt: { gte: since } },
    //   select: { createdAt: true, total: true }, orderBy: { createdAt: "asc" },
    // });
    // バケット集計は Prisma.Decimal で .add()、return で .toNumber()（NFR-3）
};

/** @function getStoreRecentOrders @access SELLER 直近 N 件の OrderGroup（items/coupon include） */
export const getStoreRecentOrders = async (storeUrl: string, limit = 5) => { /* ... */ };

/** @function getStoreTopProducts @access SELLER sales 降順で上位 N 件 */
export const getStoreTopProducts = async (storeUrl: string, limit = 5) => { /* ... */ };
```

### 3.2 UI コンポーネント

| コンポーネント | 役割 |
| --- | --- |
| `page.tsx`（置換） | `Promise.all([getStoreDashboardStats, getStoreSalesOverTime, getStoreRecentOrders, getStoreTopProducts])` → 各コンポーネントへ。`force-dynamic`。`<div>SellerStorePage</div>` を置換 |
| `store-stats-cards.tsx` | KPI カード群（総売上・総注文数・総閲覧数・販売数・総商品数・在庫アラート件数）。[admin/stats-cards.tsx](../../../src/components/dashboard/admin/stats-cards.tsx) を派生 |
| `SalesChart`（再利用） | [admin/sales-chart.tsx](../../../src/components/dashboard/admin/sales-chart.tsx) を **そのまま import**。`data: SalesPoint[]` を渡す |
| `store-recent-orders.tsx` | 最近の注文リスト |
| `store-top-products.tsx` | 販売上位商品リスト |

> **ゼロ件エッジケース（F1-9・AC-F1-5）**: 注文 0 件でも KPI は `0`、`SalesChart` は空配列で破綻しないことをコンポーネントテストで担保する。

---

## 4. 設計の核心判断（詳細）

### 判断1: 既存実装の最大再利用

→ [§1.3 再利用元マトリクス](#13-再利用元マトリクス)。admin `dashboard.ts` の構造（`unstable_cache` + `Promise.all` + 構造化ログ）を踏襲し、`where` に `storeId` を注入するだけで店舗スコープ化できる。

### 判断2: 認可は `requireStoreOwner(storeUrl)`

→ [§1.4 認可方針](#14-認可方針)。`requireStoreOwner` は SELLER ロール検証 + `db.store.findUnique({ where:{ url, userId } })` で所有権を 1 回で確認し、`store` レコードを返す。返却された `store.id` を全 query の `where` に注入する。

### 判断3: 在庫しきい値は Store 単位で永続化

→ [§5.1 スキーマ変更](#51-スキーマ変更-storelowstockthreshold)。`Store.lowStockThreshold Int @default(5)`。バッジ判定は [§2.3 `getStockStatus`](#23-在庫ステータス判定共通ヘルパー)。サイズ別 override はスコープ外（C-b）。

### 判断4: 在庫クイック編集 `updateSizeStock`

`requireStoreOwner` は「呼び出し元が `storeUrl` の所有者か」を保証するが、`sizeId` が**その店舗に属するか**は保証しない。これを放置すると、自店舗の `storeUrl` を使いつつ他店舗の `sizeId` を渡す **IDOR** が成立する。対策として **所有権チェーン検証**（[§2.1](#21-新規-querysrcqueriesinventoryts) の `db.size.findFirst({ where:{ id, productVariant:{ product:{ storeId: store.id } } } })`）を更新前に行い、不一致なら副作用なしで拒否する。テストは **3 階層パターン**（[SECURITY_GAP_REPORT.md §5.2](../../testing/SECURITY_GAP_REPORT.md)）必須:

- (a) スロー検証: 他店舗 `sizeId` → `rejects.toThrow("Forbidden: size not owned by current store.")`
- (b) where 構造検証: `findFirst` が `productVariant.product.storeId` を含む where で呼ばれる
- (c) 副作用なし検証: `db.size.update` が **呼ばれない**

### 判断5: 店舗売上集計の OrderGroup×Order join

`OrderGroup`（[schema:521](../../../prisma/schema.prisma#L521)）は `paymentStatus` を持たず、決済状態は親 `Order.paymentStatus`（[schema:503](../../../prisma/schema.prisma#L503)）にある。店舗売上は店舗単位の `OrderGroup.total`（[schema:533](../../../prisma/schema.prisma#L533)）を合算するが、**未決済の売上を計上しない**ため、`where: { storeId, order: { paymentStatus: "Paid" } }` の relation filter で親 Order を join して絞り込む。Decimal は集計途中 `.add()`、return 境界でのみ `.toNumber()`（NFR-3）。

### 判断6: placeOrder 在庫減算（アトミック check-and-decrement）

注文確定時に在庫を減算する際、**「在庫を読む → 足りるか判定 → 減算する」を別操作に分けると TOCTOU レース**（並行注文で同じ在庫を二重に確保＝オーバーセル）が起きる。これを防ぐため、**条件付き `updateMany` で検証と減算を 1 操作にまとめる**:

```typescript
const updated = await tx.size.updateMany({
    where: { id: item.sizeId, quantity: { gte: item.quantity } }, // 足りる行のみ
    data: { quantity: { decrement: item.quantity } },             // 同時に減算
});
if (updated.count === 0) {
    // 条件を満たす行が無い = 在庫不足。throw で $transaction 全体をロールバック
    throw new Error("在庫が不足しています");
}
```

→ 詳細な配置と影響箇所は [§5.2](#52-placeorder-在庫減算の影響箇所マトリクス)。

### 判断7: 安全な変更を先・波及的変更を最後に

→ [README.md 実装フェーズ順](./README.md#実装フェーズ順安全な変更を先在庫減算を最後に)。しきい値スキーマ（additive・default 付き）は後方互換なので早期（Phase 1）。在庫減算は `placeOrder` チェックアウトフロー波及の最大リスクのため最後（Phase 4・回帰+E2E）。

---

## 5. スキーマ変更・影響箇所

### 5.1 スキーマ変更 `Store.lowStockThreshold`

**Before**（[schema.prisma:80-117](../../../prisma/schema.prisma#L80)）:

```prisma
model Store {
  // ...
  defaultDeliveryTimeMin              Int         @default(7)
  defaultDeliveryTimeMax              Int         @default(31)
  // lowStockThreshold は存在しない
}
```

**After**:

```prisma
model Store {
  // ...
  defaultDeliveryTimeMin              Int         @default(7)
  defaultDeliveryTimeMax              Int         @default(31)
  lowStockThreshold                   Int         @default(5)   // ← 追加（過小在庫しきい値）
}
```

- **additive・後方互換**: `@default(5)` を付与するため、既存レコード・既存の `db.store.create({ ... })` 呼び出しを壊さない。
- **手順**（Phase 1・[tasks.md Phase 1](./tasks.md#phase-1-スキーマ追加-lowstockthresholdadditive後方互換)）: `safe-migration` skill → `bunx prisma migrate dev` → `bunx prisma generate` → `bun run erd:generate`（[rule 03](../../../.claude/rules/03-data-model-diagram-sync.md)）を **同一コミット**。

### 5.2 placeOrder 在庫減算の影響箇所マトリクス

対象: [placeOrder](../../../src/queries/user.ts#L609)（`src/queries/user.ts`）。**F3 の核心改修**。

| # | 箇所 | 現状 | 破綻ポイント | 改修方針 |
| --- | --- | --- | --- | --- |
| #1 | OrderItem 作成ループ [user.ts:696-715](../../../src/queries/user.ts#L696) | `tx.orderItem.create` のみ。`Size.quantity` 不変 | 在庫が減らず**オーバーセル**可能 | **同ループ内**で条件付き `tx.size.updateMany`（`quantity:{ gte }` + `decrement`）を追加。`count===0` で throw |
| #2 | 数量クランプ [user.ts:494](../../../src/queries/user.ts#L494) | `validQuantity = Math.min(quantity, size.quantity)`（**tx 外の事前読み取り**） | tx 外読み取り → 確定までに在庫が変動し TOCTOU | クランプ値はそのまま UX 用に残すが、**権威ある検証は #1 の tx 内条件付き更新**。減算量は確定済み `item.quantity`（=`validQuantity`）を使う |
| #3 | エラー伝播 [user.ts:738-745](../../../src/queries/user.ts#L738) | `try/catch` で `console.error` + rethrow | 在庫不足 throw が汎用エラーに埋もれない必要 | `"在庫が不足しています"` をそのまま rethrow（既存 catch を変更しない。メッセージは UI で表示可能） |

**改修後の擬似コード**（[user.ts:696](../../../src/queries/user.ts#L696) のループ内）:

```typescript
for (const item of items) {
    await tx.orderItem.create({ /* 既存のまま */ });

    // --- F3: 在庫のアトミック減算（判断6）---
    const stock = await tx.size.updateMany({
        where: { id: item.sizeId, quantity: { gte: item.quantity } },
        data: { quantity: { decrement: item.quantity } },
    });
    if (stock.count === 0) {
        throw new Error("在庫が不足しています"); // $transaction 全体をロールバック
    }
}
```

> **テスト必須観点（F3）**: (a) 在庫十分 → 減算成功（AC-F3-1）、(b) 在庫不足 → throw + `Order`/`OrderGroup`/`OrderItem` が**作成されない**（`$transaction` モックで rollback を検証・AC-F3-2）、(c) `updateMany` が `quantity:{ gte }` 条件付きで呼ばれる（レース回避の構造検証・AC-F3-3）、(d) E2E で購入フロー全体（AC-F3-4）。

### 5.3 キャンセル/返品時の在庫復元（レビュー対象）

> **recommended ON だが Phase 4 の任意サブステップ 4-D**。在庫減算（F3）の整合性対。採用可否は [tasks.md レビュー必須ポイント](./tasks.md#レビュー必須ポイント) で確認する。

- 注文が `Canceled` / `Refunded` に遷移したとき、対象 OrderItem の `quantity` を `Size.quantity` に `increment` で戻す。
- **配置**: admin/seller の注文ステータス変更 action（`updateOrderGroupStatus` 系。admin-dashboard が将来の在庫連動フックを TODO コメントで残している箇所）に結線。
- **冪等性の注意**: `Canceled → Canceled` の再実行で**二重復元**しないよう、遷移ガード（直前ステータスが非終端のときのみ復元）または復元済みフラグが必要。これが復元を「任意・レビュー対象」とする理由。

```typescript
// 復元の擬似コード（4-D 採用時・ステータス変更 action の $transaction 内）
for (const item of group.items) {
    await tx.size.update({
        where: { id: item.sizeId },
        data: { quantity: { increment: item.quantity } },
    });
}
```

---

## 6. 型定義（`src/lib/types.ts` に追加）

```typescript
// 在庫一覧行（getStoreInventory の返却要素）
export type StoreInventoryRow =
    Prisma.PromiseReturnType<typeof getStoreInventory>[number];

// 店舗 KPI（getStoreDashboardStats の返却）
export type StoreDashboardStats =
    Prisma.PromiseReturnType<typeof getStoreDashboardStats>;
```

> admin の `StoreOrderType = Prisma.PromiseReturnType<typeof getStoreOrders>[0]`（[types.ts](../../../src/lib/types.ts)）と同パターン。`any` を使わず関数戻り値から型を導出する。
