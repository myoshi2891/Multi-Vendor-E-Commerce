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
    const countryCookie = req.cookies.get("userCountry");
    if (!countryCookie) {
        try {
            const userCountry = await getUserCountry();
            const serialized = JSON.stringify(userCountry);

            // requestにcookieを設定（同じリクエストサイクル内で読み取り可能）
            req.cookies.set("userCountry", serialized);

            // responseを作成してブラウザにもcookieを送信
            const response = NextResponse.next({ request: req });
            response.cookies.set("userCountry", serialized, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
            });
            return response;
        } catch (error) {
            if (error instanceof Error) {
                console.error("[middleware] Failed to set userCountry cookie:", error.message, error.stack);
            } else {
                console.error("[middleware] Failed to set userCountry cookie:", error);
            }
            // Cookie設定失敗時もレスポンスを返す（リクエストをクラッシュさせない）
            return NextResponse.next({ request: req });
        }
    }

    return NextResponse.next({ request: req });
});

export const config = {
    matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
