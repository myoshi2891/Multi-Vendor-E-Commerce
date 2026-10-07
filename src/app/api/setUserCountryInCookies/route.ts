import { NextResponse } from "next/server";
import { isCountry } from "@/lib/utils";
import { createFixedWindowLimiter, parseLimitEnv } from "@/lib/rate-limit";

const MAX_FIELD_LEN = 100;

// インスタンスごとの補助的な安全網（ADR-009）。検索経路は Vercel WAF で制限する
const cookieLimiter = createFixedWindowLimiter({
    limit: parseLimitEnv(process.env.RATE_LIMIT_COOKIE_PER_MIN, 5),
    windowMs: 60_000,
});

export async function POST(request: Request) {
    // キーは Vercel がプラットフォーム側で設定する x-real-ip のみ。偽装可能な
    // x-forwarded-for は使わない。ヘッダーが無い環境（ローカル / CI）は fail-open
    const clientIp = request.headers.get("x-real-ip")?.trim();
    if (clientIp) {
        const decision = cookieLimiter.check(clientIp);
        if (!decision.allowed) {
            console.warn("[setUserCountryInCookies:POST] Rate limited", {
                retryAfterSec: decision.retryAfterSec,
            });
            return new NextResponse("Too many requests.", {
                status: 429,
                headers: { "Retry-After": String(decision.retryAfterSec) },
            });
        }
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch (error: unknown) {
        console.error("[setUserCountryInCookies:POST] Invalid JSON body", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return new NextResponse("Invalid JSON body.", { status: 400 });
    }

    const userCountry =
        typeof body === "object" && body !== null
            ? (body as Record<string, unknown>).userCountry
            : undefined;

    if (!isCountry(userCountry)) {
        return new NextResponse("Invalid userCountry data.", { status: 400 });
    }

    if (
        userCountry.name.length > MAX_FIELD_LEN ||
        userCountry.code.length > MAX_FIELD_LEN ||
        userCountry.city.length > MAX_FIELD_LEN ||
        userCountry.region.length > MAX_FIELD_LEN
    ) {
        return new NextResponse("userCountry field too long.", { status: 400 });
    }

    try {
        const response = new NextResponse("User country saved successfully", {
            status: 200,
        });
        const serialized = JSON.stringify({
            name: userCountry.name,
            code: userCountry.code,
            city: userCountry.city,
            region: userCountry.region,
        });

        response.cookies.set("userCountry", serialized, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
        });

        return response;
    } catch (error: unknown) {
        console.error("[setUserCountryInCookies:POST] Failed to set cookie", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return new NextResponse("Couldn't save data", { status: 500 });
    }
}
