import { readFileSync, writeFileSync } from "node:fs";
import { db } from "@/lib/db";

// Read only. Never seed, migrate, create accounts, or change records for this audit.
const output = process.argv[2];
if (!output)
    throw new Error(
        "Usage: bun scripts/design/prepare-route-audit.ts <inventory.json>"
    );
const ledger = readFileSync("docs/design/design-system/PROGRESS.md", "utf8");
// 成功・失敗（クエリ / 識別子欠落 / 書き込み）のどちらでも接続を閉じる
try {
    const [product, store, attribute, order] = await Promise.all([
        db.product.findFirst({
            // バリアント無し商品を拾うと [variantSlug] / [variantId] が埋まらない
            where: { variants: { some: {} } },
            select: {
                id: true,
                slug: true,
                variants: { take: 1, select: { id: true, slug: true } },
            },
        }),
        db.store.findFirst({ select: { url: true } }),
        db.attributeDefinition.findFirst({
            where: { type: "ENUM" },
            select: { id: true },
        }),
        db.order.findFirst({ select: { id: true } }),
    ]);
    const values: Record<string, string | undefined> = {
        "[productSlug]": product?.slug,
        "[variantSlug]": product?.variants[0]?.slug,
        "[productId]": product?.id,
        "[variantId]": product?.variants[0]?.id,
        "[storeUrl]": store?.url,
        "[id]": attribute?.id,
        "[orderId]": order?.id,
        "[page]": "1",
        "[filter]": "all",
    };
    const inventory = ledger
        .split("\n")
        .filter((line) => line.startsWith("| DS-PAGE-"))
        .map((line) => {
            const columns = line
                .split("|")
                .slice(1, -1)
                .map((value) => value.trim());
            const route = columns[1].replaceAll("`", "");
            let actualPath = route;
            for (const [key, value] of Object.entries(values)) {
                if (!actualPath.includes(key)) continue;
                if (!value)
                    throw new Error(
                        `Missing existing audit data for ${columns[0]} (${key}).`
                    );
                actualPath = actualPath.replaceAll(key, value);
            }
            return {
                id: columns[0],
                route,
                actualPath,
                previousSource: columns[2],
            };
        });
    writeFileSync(output, JSON.stringify(inventory, null, 2));
} finally {
    await db.$disconnect();
}
