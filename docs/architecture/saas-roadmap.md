# SaaS 化 設計ノート・ロードマップ

> **現時点では不要です。** 将来のマルチテナント対応・SaaS 化を見据えたメモです。
> 現フェーズの移行手順は [`docs/migration/01-data-migration-guide.md`](../migration/01-data-migration-guide.md) を参照してください。

---

## マルチテナント Prisma テンプレート

全ビジネステーブルに `orgId` を持たせる設計：

```prisma
model Organization {
  id    String @id @default(uuid())
  name  String
  users User[]
}

model User {
  id           String       @id @default(uuid())
  orgId        String
  organization Organization @relation(fields: [orgId], references: [id])
}
```

**クエリでは必ず `orgId` を条件に含めること**（漏洩防止）：

```ts
await db.product.findMany({
  where: { orgId: session.orgId }
})
```

---

## Stripe / PayPal 対応 DB 設計

```prisma
model Subscription {
  id                   String  @id @default(uuid())
  orgId                String
  stripeCustomerId     String?
  paypalSubscriptionId String?
  status               String
}
```

設計ポイント：provider 固有カラムは nullable、Webhook ログを別テーブルで保存。

---

## Row Level Security（RLS）— フェーズ2以降

PostgreSQL の RLS で DB レベルのテナント分離を実現：

```sql
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation
ON "Product"
USING (org_id = current_setting('app.current_org')::uuid);
```

> **個人開発の現フェーズでは不要。** SaaS 化・マルチテナント対応時に検討。

---

## SaaS 化ロードマップ

| フェーズ | 内容 |
|---|---|
| Phase 1 | 単一 DB / 単一テナント（現状） |
| Phase 2 | `orgId` 分離 + RLS 導入 |
| Phase 3 | Stripe / PayPal 課金連携 |
| Phase 4 | Prisma Accelerate 有料化 + Read Replica |
| Phase 5 | 監視 + ログ基盤（Sentry 等） |
