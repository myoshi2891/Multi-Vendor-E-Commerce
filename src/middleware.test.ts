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
                const regexStr = "^" + route.replace("(.*)", ".*") + "$";
                const regex = new RegExp(regexStr);
                return regex.test(path);
            });
        };
    }),
}));

// 2. ./lib/country のモック
jest.mock("./lib/country", () => ({
    getUserCountry: jest.fn(),
}));

// ミドルウェアの実体をインポート（clerkMiddleware のモックにより、内部の関数がそのまま取得される）
import middleware from "./middleware";

describe("Middleware", () => {
    let mockProtect: jest.Mock;
    let mockAuth: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // 認証処理のモック
        mockProtect = jest.fn();
        mockAuth = jest.fn(() => ({
            protect: mockProtect,
        }));
    });

    describe("ルーティング保護 (Authentication & Route Protection)", () => {
        it("正常系: 保護されたルート (/dashboard) の場合は auth().protect() が呼ばれる", async () => {
            const req = new NextRequest("http://localhost:3000/dashboard");
            await (middleware as any)(mockAuth, req, {});

            expect(mockAuth).toHaveBeenCalled();
            expect(mockProtect).toHaveBeenCalled();
        });

        it("正常系: 保護されたルート (/checkout) の場合は auth().protect() が呼ばれる", async () => {
            const req = new NextRequest("http://localhost:3000/checkout");
            await (middleware as any)(mockAuth, req, {});

            expect(mockAuth).toHaveBeenCalled();
            expect(mockProtect).toHaveBeenCalled();
        });

        it("正常系: 保護されたサブルート (/profile/orders) の場合は auth().protect() が呼ばれる", async () => {
            const req = new NextRequest("http://localhost:3000/profile/orders");
            await (middleware as any)(mockAuth, req, {});

            expect(mockAuth).toHaveBeenCalled();
            expect(mockProtect).toHaveBeenCalled();
        });

        it("正常系: パブリックなルート (/) の場合は auth().protect() が呼ばれない", async () => {
            const req = new NextRequest("http://localhost:3000/");
            await (middleware as any)(mockAuth, req, {});

            expect(mockAuth).not.toHaveBeenCalled();
            expect(mockProtect).not.toHaveBeenCalled();
        });

        it("正常系: パブリックなルート (/browse) の場合は auth().protect() が呼ばれない", async () => {
            const req = new NextRequest("http://localhost:3000/browse");
            await (middleware as any)(mockAuth, req, {});

            expect(mockAuth).not.toHaveBeenCalled();
            expect(mockProtect).not.toHaveBeenCalled();
        });
    });

    describe("国情報 Cookie の処理 (Country Cookie Logic)", () => {
        it("正常系: 既に userCountry Cookie が存在する場合は NextResponse.next() を返し、Cookie を再設定しない", async () => {
            const req = new NextRequest("http://localhost:3000/");
            // userCountry Cookie をセット
            req.cookies.set("userCountry", JSON.stringify({ name: "Japan" }));

            const response = await (middleware as any)(mockAuth, req, {});

            // getUserCountry は呼ばれないはず
            expect(getUserCountry).not.toHaveBeenCalled();
            
            // レスポンスに新しい cookie がセットされていないことを確認（next()が返る）
            // NextResponse.next() は基本ヘッダーを引き継ぐが、新たなSet-Cookieは発生しない。
            // ※ next/server の仕様上、内部状態の厳密な比較は難しいため、関数呼び出しで検証
            expect(response).toBeInstanceOf(NextResponse);
            // リダイレクトではないことを確認
            expect(response.headers.get("Location")).toBeNull();
        });

        it("正常系: userCountry Cookie が存在しない場合は getUserCountry() を呼び、リダイレクトレスポンスに Cookie をセットする", async () => {
            const req = new NextRequest("http://localhost:3000/some-path");
            const mockCountry = { name: "United States", code: "US" };
            (getUserCountry as jest.Mock).mockResolvedValue(mockCountry);

            const response = await (middleware as any)(mockAuth, req, {});

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
    });
});
