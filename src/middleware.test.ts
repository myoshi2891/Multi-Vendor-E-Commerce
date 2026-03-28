import { NextRequest, NextResponse, NextFetchEvent } from "next/server";
import { getUserCountry } from "./lib/country";

// --- モックの設定 ---

// 1. @clerk/nextjs/server のモック
// clerkMiddleware は渡されたハンドラーをそのまま返すようにし、テストから直接呼び出せるようにする。
jest.mock("@clerk/nextjs/server", () => ({
    clerkMiddleware: jest.fn((handler) => handler),
    createRouteMatcher: jest.fn((routes: string[]) => {
        return (req: NextRequest) => {
            const path = req.nextUrl.pathname;
            return routes.some((route) => {
                // シンプルな前方一致または完全一致でシミュレーション（ReDoSを避ける）
                if (route.endsWith("(.*)")) {
                    const base = route.replace("(.*)", "");
                    return path.startsWith(base);
                }
                return path === route;
            });
        };
    }),
}));

// 2. ./lib/country のモック
jest.mock("./lib/country", () => ({
    getUserCountry: jest.fn(),
}));

import { clerkMiddleware, type ClerkMiddlewareAuth } from "@clerk/nextjs/server";

// ミドルウェアの実体をインポート（clerkMiddleware のモックにより、内部の関数がそのまま取得される）
import middleware from "./middleware";

// clerkMiddleware のハンドラー関数の型
type MiddlewareHandler = (auth: ClerkMiddlewareAuth, req: NextRequest, event: NextFetchEvent) => Promise<Response | void> | Response | void;

describe("Middleware", () => {
    let mockProtect: jest.Mock;
    // Clerk v7: auth は関数でありつつ auth.protect() プロパティも持つ
    let mockAuth: jest.Mock & { protect: jest.Mock };
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
        jest.clearAllMocks();
        Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', configurable: true });

        mockProtect = jest.fn();
        const fn = jest.fn(() => ({
            redirectToSignIn: jest.fn(),
        })) as jest.Mock & { protect: jest.Mock };
        fn.protect = mockProtect;
        mockAuth = fn;
    });

    afterEach(() => {
        Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, configurable: true });
    });

    const typedMiddleware = middleware as unknown as MiddlewareHandler;
    const mockEvent = {
        waitUntil: jest.fn(),
        passThroughOnException: jest.fn(),
        sourcePage: "",
    } as unknown as NextFetchEvent;

    describe("ルーティング保護 (Authentication & Route Protection)", () => {
        const protectedPaths = [
            "/dashboard",
            "/dashboard/settings",
            "/checkout",
            "/profile",
            "/profile/orders",
        ];
        const publicPaths = ["/", "/browse"];

        it.each(protectedPaths)(
            "正常系: 保護されたルート (%s) の場合は auth.protect() が呼ばれる",
            async (path) => {
                const req = new NextRequest(`http://localhost:3000${path}`);
                req.cookies.set("userCountry", JSON.stringify({ name: "Japan" }));
                await typedMiddleware(mockAuth as unknown as ClerkMiddlewareAuth, req, mockEvent);

                expect(mockProtect).toHaveBeenCalled();
            }
        );

        it.each(publicPaths)(
            "正常系: パブリックなルート (%s) の場合は auth.protect() が呼ばれない",
            async (path) => {
                const req = new NextRequest(`http://localhost:3000${path}`);
                req.cookies.set("userCountry", JSON.stringify({ name: "Japan" }));
                await typedMiddleware(mockAuth as unknown as ClerkMiddlewareAuth, req, mockEvent);

                expect(mockProtect).not.toHaveBeenCalled();
            }
        );
    });

    describe("国情報 Cookie の処理 (Country Cookie Logic)", () => {
        it("正常系: 既に userCountry Cookie が存在する場合は NextResponse.next() を返し、Cookie を再設定しない", async () => {
            const req = new NextRequest("http://localhost:3000/");
            // userCountry Cookie をセット
            req.cookies.set("userCountry", JSON.stringify({ name: "Japan" }));

            const response = await typedMiddleware(mockAuth as unknown as ClerkMiddlewareAuth, req, mockEvent) as NextResponse;

            // getUserCountry は呼ばれないはず
            expect(getUserCountry).not.toHaveBeenCalled();

            // レスポンスに新しい cookie がセットされていないことを確認（next()が返る）
            expect(response).toBeInstanceOf(NextResponse);
            // リダイレクトではないことを確認
            expect(response.headers.get("Location")).toBeNull();
        });

        it("正常系: userCountry Cookie が存在しない場合は getUserCountry() を呼び、レスポンスに Cookie をセットする（リダイレクトなし）", async () => {
            const req = new NextRequest("http://localhost:3000/some-path");
            const mockCountry = { name: "United States", code: "US" };
            (getUserCountry as jest.Mock).mockResolvedValue(mockCountry);

            const response = await typedMiddleware(mockAuth as unknown as ClerkMiddlewareAuth, req, mockEvent) as NextResponse;

            // getUserCountry が呼ばれる
            expect(getUserCountry).toHaveBeenCalledTimes(1);

            // NextResponse.next() が返される（リダイレクトではない）
            expect(response).toBeInstanceOf(NextResponse);
            expect(response.headers.get("Location")).toBeNull();

            // Cookie がレスポンスにセットされているか確認
            const setCookieHeader = response.headers.get("Set-Cookie");
            expect(setCookieHeader).toBeDefined();
            expect(setCookieHeader).toContain("userCountry");

            // Cookie の内容が正しいか検証（URLエンコードされる場合があるため、含まれる文字列でチェック）
            expect(setCookieHeader).toContain(encodeURIComponent(JSON.stringify(mockCountry)));
            expect(setCookieHeader).toContain("HttpOnly");
            expect(setCookieHeader).toContain("SameSite=lax");
        });

        it("正常系: NODE_ENV が production の場合は Cookie に Secure 属性が付与される", async () => {
            try {
                Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
                const req = new NextRequest("http://localhost:3000/");
                const mockCountry = { name: "Japan", code: "JP" };
                (getUserCountry as jest.Mock).mockResolvedValue(mockCountry);

                const response = await typedMiddleware(mockAuth as unknown as ClerkMiddlewareAuth, req, mockEvent) as NextResponse;

                const setCookieHeader = response.headers.get("Set-Cookie");
                expect(setCookieHeader).toContain("Secure");
            } finally {
                Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', configurable: true });
            }
        });
    });
});
