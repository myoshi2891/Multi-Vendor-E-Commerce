import { writeFileSync } from "node:fs";
import { db } from "@/lib/db";

// Read-only discovery: never seed, change ownership, or create Clerk accounts.
const output = process.argv[2];
const urls = ["DATABASE_URL", "DIRECT_URL", "E2E_DATABASE_URL"].map(
    (key) => process.env[key]
);
if (!output || !urls[0] || urls.some((url) => url !== urls[0]))
    throw new Error(
        "Provide an output path and matching dedicated database URLs."
    );
const target = new URL(urls[0]);
if (
    !["localhost", "127.0.0.1"].includes(target.hostname) ||
    !/(?:^|[_-])(?:e2e|test)(?:$|[_-])/.test(target.pathname.slice(1))
)
    throw new Error("A local dedicated test database is required.");
try {
    const sellerEmail = "design-seller+clerk_test@example.com";
    const adminEmail = "design-admin+clerk_test@example.com";
    const customerEmail = "design-customer+clerk_test@example.com";
    const [seller, admin, customer, product] = await Promise.all([
        db.user.findUnique({
            where: { email: sellerEmail },
            select: { id: true, role: true },
        }),
        db.user.findUnique({
            where: { email: adminEmail },
            select: { role: true },
        }),
        db.user.findUnique({
            where: { email: customerEmail },
            select: { role: true },
        }),
        db.product.findFirst({
            where: { variants: { some: {} } },
            select: { slug: true, variants: { select: { slug: true } } },
        }),
    ]);
    if (
        seller?.role !== "SELLER" ||
        admin?.role !== "ADMIN" ||
        customer?.role !== "USER" ||
        !product
    )
        throw new Error(
            "Existing test identities and a product with variants are required."
        );
    const stores = await db.store.findMany({
        where: { userId: seller.id },
        select: { name: true, url: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (!stores.length)
        throw new Error(
            "The existing seller needs an owned store for real-data acceptance."
        );
    writeFileSync(
        output,
        JSON.stringify(
            {
                sellerEmail,
                adminEmail,
                customerEmail,
                stores,
                productSlug: product.slug,
                variantSlugs: product.variants.map((variant) => variant.slug),
            },
            null,
            2
        )
    );
} finally {
    await db.$disconnect();
}
