import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserCountry } from "./lib/country";

export default clerkMiddleware(async (auth, req, next) => {
    const protectedRoutes = createRouteMatcher([
        "/dashboard",
        "/dashboard/(.*)",
        "/checkout",
        "/profile",
        "/profile/(.*)",
    ]);
    if (protectedRoutes(req)) auth().protect();

    // リダイレクトではなくレスポンスに直接 Cookie をセット
    // （リダイレクト方式は非ブラウザクライアントで無限ループを引き起こす）
    const response = NextResponse.next();

    const countryCookie = req.cookies.get("userCountry");
    if (!countryCookie) {
        try {
            const userCountry = await getUserCountry();
            response.cookies.set("userCountry", JSON.stringify(userCountry), {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
            });
        } catch (error) {
            console.error("[middleware] Failed to set userCountry cookie:", error instanceof Error ? error.message : error);
            // Cookie 設定失敗時もレスポンスを返す（リクエストをクラッシュさせない）
        }
    }

    return response;
});

export const config = {
    matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
