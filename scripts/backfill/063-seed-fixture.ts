/**
 * plan 063 Step 4a — ステージング予行用のフィクスチャ投入。
 *
 * 使い方（ローカルの検証用 Postgres に対してのみ）:
 *   docker compose -f docker-compose.test.yml up -d
 *   DATABASE_URL=postgresql://test:test@localhost:55432/integration_test \
 *   DIRECT_URL=postgresql://test:test@localhost:55432/integration_test \
 *     bun run scripts/backfill/063-seed-fixture.ts
 *
 * 投入する 5 行は、Step 4 の述語が「拾うべきものだけを拾う」ことを示すために
 * 選んである:
 *
 * | 行 | order.total | pd.amount | method | ratio | 期待 |
 * |---|---|---|---|---|---|
 * | cents-stripe   | 99.99 | 9999.00 | Stripe | ≈100 | 99.99 へ補正 |
 * | cents-switched | 50.00 | 5000.00 | PayPal | ≈100 | 50.00 へ補正 + currency→usd |
 * | dollars-ok     | 20.00 |   20.00 | Stripe | ≈1   | **不変**（誤補正すると 0.20 になる） |
 * | zero-total     |  0.00 | 1234.00 | Stripe | NULL | **不変**（人手で解決する領域） |
 * | after-boundary | 30.00 | 3000.00 | Stripe | ≈100 | **不変**（境界より後） |
 *
 * `dollars-ok` を置くのが要点である。plan 063 が記録している旧 runbook の事故は
 * まさにこの行を 20.00 → 0.20 に壊したまま COMMIT したもので、フィクスチャに
 * 含めない限り予行では再現も検出もできない。
 *
 * @see plans/063-backfill-stripe-payment-amount.md
 */

import { PaymentMethod, PrismaClient } from "@prisma/client";

import { DEFAULT_BOUNDARY_ISO, maskDatabaseUrl } from "./063-shared";

const FIXTURE_PREFIX = "b063-";

const COUNTRY_ID = `${FIXTURE_PREFIX}country`;
const USER_ID = `${FIXTURE_PREFIX}user`;
const ADDRESS_ID = `${FIXTURE_PREFIX}address`;

/** 境界より前（cents 行が書かれていた時期）。 */
const BEFORE_BOUNDARY = new Date("2026-07-01T00:00:00Z");
/** 境界より後（コード修正済みの時期）。 */
const AFTER_BOUNDARY = new Date(
    new Date(DEFAULT_BOUNDARY_ISO).getTime() + 60 * 60 * 1000
);

type FixtureCase = {
    key: string;
    total: string;
    amount: string;
    currency: string;
    paymentMethod: string;
    orderPaymentMethod: PaymentMethod;
    createdAt: Date;
};

const CASES: readonly FixtureCase[] = [
    {
        key: "cents-stripe",
        total: "99.99",
        amount: "9999.00",
        currency: "usd",
        paymentMethod: "Stripe",
        orderPaymentMethod: PaymentMethod.Stripe,
        createdAt: BEFORE_BOUNDARY,
    },
    {
        key: "cents-switched",
        total: "50.00",
        amount: "5000.00",
        currency: "eur",
        paymentMethod: "PayPal",
        orderPaymentMethod: PaymentMethod.PayPal,
        createdAt: BEFORE_BOUNDARY,
    },
    {
        key: "dollars-ok",
        total: "20.00",
        amount: "20.00",
        currency: "usd",
        paymentMethod: "Stripe",
        orderPaymentMethod: PaymentMethod.Stripe,
        createdAt: BEFORE_BOUNDARY,
    },
    {
        key: "zero-total",
        total: "0.00",
        amount: "1234.00",
        currency: "usd",
        paymentMethod: "Stripe",
        orderPaymentMethod: PaymentMethod.Stripe,
        createdAt: BEFORE_BOUNDARY,
    },
    {
        key: "after-boundary",
        total: "30.00",
        amount: "3000.00",
        currency: "usd",
        paymentMethod: "Stripe",
        orderPaymentMethod: PaymentMethod.Stripe,
        createdAt: AFTER_BOUNDARY,
    },
];

/**
 * 検証用 DB 以外への投入を拒否する。
 *
 * このスクリプトは**書き込み**を行う。本番 DB の資格情報が `.env` に入っている
 * 以上、「環境変数を渡し忘れて本番へ流し込む」経路を塞いでおかないと、
 * backfill を検証するためのスクリプトが本番を汚す事故になりうる。
 * `tests/integration/setup/container.ts` が同じ理由で DB 名を検査している。
 */
function assertTestDatabase(rawUrl: string | undefined): void {
    if (!rawUrl) {
        throw new Error("DATABASE_URL が未設定です");
    }

    const url = new URL(rawUrl);
    const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(
        url.hostname
    );
    const dbName = url.pathname.replace(/^\//, "");
    const looksLikeTestDb = /test|integration/i.test(dbName);

    if (!isLocalHost || !looksLikeTestDb) {
        throw new Error(
            `検証用 DB ではありません（host=${url.hostname} db=${dbName}）。` +
                " localhost かつ DB 名に test/integration を含む接続先でのみ実行できます。"
        );
    }
}

async function main(): Promise<void> {
    assertTestDatabase(process.env.DATABASE_URL);
    console.log(`接続先: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);

    const db = new PrismaClient();

    try {
        // 再実行できるよう、前回のフィクスチャを先に消す（PaymentDetails は
        // Order への onDelete: Cascade なので Order を消せば連鎖する）。
        await db.order.deleteMany({
            where: { id: { startsWith: `${FIXTURE_PREFIX}order-` } },
        });
        await db.shippingAddress.deleteMany({ where: { id: ADDRESS_ID } });
        await db.user.deleteMany({ where: { id: USER_ID } });
        await db.country.deleteMany({ where: { id: COUNTRY_ID } });

        await db.country.create({
            data: {
                id: COUNTRY_ID,
                name: "Backfill063 Land",
                code: "B63",
            },
        });

        await db.user.create({
            data: {
                id: USER_ID,
                name: "Backfill063 Fixture",
                email: "backfill063@example.test",
                picture: "https://example.test/avatar.png",
            },
        });

        await db.shippingAddress.create({
            data: {
                id: ADDRESS_ID,
                firstName: "Back",
                lastName: "Fill",
                phone: "000-0000-0000",
                address1: "1 Fixture St",
                state: "FX",
                city: "Fixtureville",
                zip_code: "00000",
                userId: USER_ID,
                countryId: COUNTRY_ID,
            },
        });

        for (const testCase of CASES) {
            await db.order.create({
                data: {
                    id: `${FIXTURE_PREFIX}order-${testCase.key}`,
                    subTotal: testCase.total,
                    total: testCase.total,
                    shippingFees: "0",
                    paymentMethod: testCase.orderPaymentMethod,
                    shippingAddressId: ADDRESS_ID,
                    userId: USER_ID,
                    createdAt: testCase.createdAt,
                    paymentDetails: {
                        create: {
                            id: `${FIXTURE_PREFIX}pd-${testCase.key}`,
                            paymentIntentId: `pi_${testCase.key}`,
                            paymentMethod: testCase.paymentMethod,
                            status: "succeeded",
                            amount: testCase.amount,
                            currency: testCase.currency,
                            userId: USER_ID,
                            createdAt: testCase.createdAt,
                        },
                    },
                },
            });
            console.log(
                `  投入: ${testCase.key} (total=${testCase.total} amount=${testCase.amount} ${testCase.paymentMethod}/${testCase.currency})`
            );
        }

        console.log(`\n✅ フィクスチャ ${CASES.length} 件を投入しました`);
    } finally {
        await db.$disconnect();
    }
}

main().catch((error: unknown) => {
    if (error instanceof Error) {
        console.error("[Backfill063:fixture] Failed", {
            error: error.message,
            stack: error.stack,
        });
    } else {
        console.error("[Backfill063:fixture] Unknown error", { error });
    }
    process.exit(1);
});
