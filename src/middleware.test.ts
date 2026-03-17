import { NextRequest, NextResponse } from "next/server";
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

import { clerkMiddleware } from "@clerk/nextjs/server";

// ミドルウェアの実体をインポート（clerkMiddleware のモックにより、内部の関数がそのまま取得される）
import middleware from "./middleware";

// clerkMiddleware のハンドラー関数の型
type MiddlewareHandler = Parameters<typeof clerkMiddleware>[0];

describe("Middleware", () => {
    let mockProtect: jest.Mock;
    let mockAuth: jest.Mock;
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.NODE_ENV = "test";

        // 認証処理のモック
        mockProtect = jest.fn();
        mockAuth = jest.fn(() => ({
            protect: mockProtect,
        }));
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
    });

    const typedMiddleware = middleware as unknown as MiddlewareHandler;

    describe("ルーティング保護 (Authentication & Route Protection)", () => {
        it("正常系: 保護されたルート (/dashboard) の場合は auth().protect() が呼ばれる", async () => {
            const req = new NextRequest("http://localhost:3000/dashboard");
            req.cookies.set("userCountry", JSON.stringify({ name: "Japan" }));
            await typedMiddleware(mockAuth as any, req, {} as any);

            expect(mockAuth).toHaveBeenCalled();
            expect(mockProtect).toHaveBeenCalled();
        });

        it("正常系: 保護されたルート (/dashboard/settings) の場合は auth().protect() が呼ばれる", async () => {
            const req = new NextRequest("http://localhost:3000/dashboard/settings");
            req.cookies.set("userCountry", JSON.stringify({ name: "Japan" }));
            await typedMiddleware(mockAuth as any, req, {} as any);

            expect(mockAuth).toHaveBeenCalled();
            expect(mockProtect).toHaveBeenCalled();
        });

        it("正常系: 保護されたルート (/checkout) の場合は auth().protect() が呼ばれる", async () => {
            const req = new NextRequest("http://localhost:3000/checkout");
            req.cookies.set("userCountry", JSON.stringify({ name: "Japan" }));
            await typedMiddleware(mockAuth as any, req, {} as any);

            expect(mockAuth).toHaveBeenCalled();
            expect(mockProtect).toHaveBeenCalled();
        });

        it("正常系: 保護されたルート (/profile) の場合は auth().protect() が呼ばれる", async () => {
            const req = new NextRequest("http://localhost:3000/profile");
            req.cookies.set("userCountry", JSON.stringify({ name: "Japan" }));
            await typedMiddleware(mockAuth as any, req, {} as any);

            expect(mockAuth).toHaveBeenCalled();
            expect(mockProtect).toHaveBeenCalled();
        });

        it("正常系: 保護されたサブルート (/profile/orders) の場合は auth().protect() が呼ばれる", async () => {
            const req = new NextRequest("http://localhost:3000/profile/orders");
            req.cookies.set("userCountry", JSON.stringify({ name: "Japan" }));
            await typedMiddleware(mockAuth as any, req, {} as any);

            expect(mockAuth).toHaveBeenCalled();
            expect(mockProtect).toHaveBeenCalled();
        });

        it("正常系: パブリックなルート (/) の場合は auth().protect() が呼ばれない", async () => {
            const req = new NextRequest("http://localhost:3000/");
            req.cookies.set("userCountry", JSON.stringify({ name: "Japan" }));
            await typedMiddleware(mockAuth as any, req, {} as any);

            expect(mockAuth).not.toHaveBeenCalled();
            expect(mockProtect).not.toHaveBeenCalled();
        });

        it("正常系: パブリックなルート (/browse) の場合は auth().protect() が呼ばれない", async () => {
            const req = new NextRequest("http://localhost:3000/browse");
            req.cookies.set("userCountry", JSON.stringify({ name: "Japan" }));
            await typedMiddleware(mockAuth as any, req, {} as any);

            expect(mockAuth).not.toHaveBeenCalled();
            expect(mockProtect).not.toHaveBeenCalled();
        });
    });

    describe("国情報 Cookie の処理 (Country Cookie Logic)", () => {
        it("正常系: 既に userCountry Cookie が存在する場合は NextResponse.next() を返し、Cookie を再設定しない", async () => {
            const req = new NextRequest("http://localhost:3000/");
            // userCountry Cookie をセット
            req.cookies.set("userCountry", JSON.stringify({ name: "Japan" }));

            const response = await typedMiddleware(mockAuth as any, req, {} as any);

            // getUserCountry は呼ばれないはず
            expect(getUserCountry).not.toHaveBeenCalled();
            
            // レスポンスに新しい cookie がセットされていないことを確認（next()が返る）
            expect(response).toBeInstanceOf(NextResponse);
            // リダイレクトではないことを確認
            expect(response.headers.get("Location")).toBeNull();
        });

        it("正常系: userCountry Cookie が存在しない場合は getUserCountry() を呼び、リダイレクトレスポンスに Cookie をセットする", async () => {
            const req = new NextRequest("http://localhost:3000/some-path");
            const mockCountry = { name: "United States", code: "US" };
            (getUserCountry as jest.Mock).mockResolvedValue(mockCountry);

            const response = await typedMiddleware(mockAuth as any, req, {} as any);

            // getUserCountry が呼ばれる
            expect(getUserCountry).toHaveBeenCalledTimes(1);

            // NextResponse.redirect(new URL(req.url)) が返される
            expect(response).toBeInstanceOf(NextResponse);
            // Location ヘッダーがリクエストURLと同じか確認
            expect(response.headers.get("Location")).toBe("http://localhost:3000/some-path");

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
                process.env.NODE_ENV = "production";
                const req = new NextRequest("http://localhost:3000/");
                const mockCountry = { name: "Japan", code: "JP" };
                (getUserCountry as jest.Mock).mockResolvedValue(mockCountry);

                const response = await typedMiddleware(mockAuth as any, req, {} as any);

                const setCookieHeader = response.headers.get("Set-Cookie");
                expect(setCookieHeader).toContain("Secure");
            } finally {
                process.env.NODE_ENV = "test";
            }
        });
    });
});
