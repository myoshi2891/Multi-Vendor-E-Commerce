import { POST } from "./route";

// ヘルパー: Requestオブジェクト生成
const createRequest = (body: Record<string, unknown>) =>
    new Request("http://localhost:3000/api/setUserCountryInCookies", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });

// ==================================================
// POST /api/setUserCountryInCookies
// ==================================================
describe("POST /api/setUserCountryInCookies", () => {
    it("有効な国データでCookieを設定し200を返す", async () => {
        const userCountry = { name: "Japan", code: "JP" };

        const response = await POST(createRequest({ userCountry }));

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(text).toBe("User country saved successfully");
    });

    it("userCountryが未指定の場合400を返す", async () => {
        const response = await POST(createRequest({}));

        expect(response.status).toBe(400);
    });

    it("userCountryがnullの場合400を返す", async () => {
        const response = await POST(
            createRequest({ userCountry: null })
        );

        expect(response.status).toBe(400);
    });

    it("CookieにuserCountryをJSON文字列で設定する", async () => {
        const userCountry = { name: "Japan", code: "JP" };

        const response = await POST(createRequest({ userCountry }));

        // NextResponse.cookies.set の結果は Set-Cookie ヘッダーに反映される
        const setCookie = response.headers.get("set-cookie");
        expect(setCookie).toBeTruthy();
        expect(setCookie).toContain("userCountry");
    });

    it("CookieにhttpOnlyフラグが設定される", async () => {
        const userCountry = { name: "USA", code: "US" };

        const response = await POST(createRequest({ userCountry }));

        const setCookie = response.headers.get("set-cookie");
        expect(setCookie).toContain("HttpOnly");
    });

    it("CookieにsameSite=laxが設定される", async () => {
        const userCountry = { name: "UK", code: "GB" };

        const response = await POST(createRequest({ userCountry }));

        const setCookie = response.headers.get("set-cookie");
        // NextResponseはSameSite値を小文字で出力する場合がある
        expect(setCookie!.toLowerCase()).toContain("samesite=lax");
    });

    it("無効なJSONボディの場合500を返す", async () => {
        const request = new Request(
            "http://localhost:3000/api/setUserCountryInCookies",
            {
                method: "POST",
                body: "invalid-json",
                headers: { "Content-Type": "application/json" },
            }
        );

        const response = await POST(request);

        expect(response.status).toBe(500);
    });
});
