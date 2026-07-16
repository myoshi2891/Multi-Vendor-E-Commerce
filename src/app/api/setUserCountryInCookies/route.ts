import { NextResponse } from "next/server";
import { isCountry } from "@/lib/utils";

const MAX_FIELD_LEN = 100;

export async function POST(request: Request) {
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
