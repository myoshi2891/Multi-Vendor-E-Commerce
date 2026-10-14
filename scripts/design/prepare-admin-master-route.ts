import { writeFileSync } from "node:fs";
import { createClerkClient } from "@clerk/backend";
import { db } from "@/lib/db";

// Read-only discovery of existing test data. Never create accounts or seed records.
const output = process.argv[2];
if (!output) throw new Error("Usage: bun scripts/design/prepare-admin-master-route.ts <output.json>");
const urls = ["DATABASE_URL", "DIRECT_URL", "E2E_DATABASE_URL"].map(name => process.env[name]?.trim());
if (!urls[0] || urls.some(value => value !== urls[0])) throw new Error("Use the same dedicated database for all three database variables.");
const parsed = new URL(urls[0]);
// "latest" や "contest_prod" を通さないよう、DB 名を区切り文字で分けた構成要素として照合する
const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
if (!["localhost", "127.0.0.1"].includes(parsed.hostname) || !/(?:^|[_-])(?:e2e|test)(?:$|[_-])/.test(databaseName)) {
    throw new Error("A local dedicated test database is required.");
}
if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Clerk development configuration is required.");
const adminEmail = "design-admin+clerk_test@example.com";
try {
    const [admin, category, attribute, coupon, offerTag, clerkUsers] = await Promise.all([
        db.user.findUnique({ where: { email: adminEmail }, select: { id: true, role: true } }),
        db.category.findFirst({ orderBy: { path: "asc" }, select: { id: true, name: true, url: true } }),
        db.attributeDefinition.findFirst({
            where: { type: "ENUM", archivedAt: null, options: { some: {} } },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
        }),
        db.coupon.findFirst({ orderBy: { code: "asc" }, select: { code: true } }),
        db.offerTag.findFirst({ orderBy: { name: "asc" }, select: { name: true } }),
        createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }).users.getUserList({ emailAddress: [adminEmail] }),
    ]);
    const identity = clerkUsers.data.find(user => user.id === admin?.id);
    if (admin?.role !== "ADMIN" || identity?.privateMetadata.role !== "ADMIN") {
        throw new Error("An existing matching Clerk/DB test administrator is required.");
    }
    if (!category || !attribute || !coupon || !offerTag) throw new Error("Existing category, ENUM options, coupon and offer tag data are required.");
    writeFileSync(output, JSON.stringify({ adminEmail, category, attribute, coupon, offerTag }, null, 2));
} finally {
    await db.$disconnect();
}
