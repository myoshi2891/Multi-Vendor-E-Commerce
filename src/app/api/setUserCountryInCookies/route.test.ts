import { POST } from "./route";

const url = "http://localhost:3000/api/setUserCountryInCookies";

const createRequest = (body: unknown) =>
    new Request(url, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
    });

describe("POST /api/setUserCountryInCookies", () => {
    it("stores a valid country in a path-scoped cookie", async () => {
        const response = await POST(
            createRequest({
                userCountry: {
                    name: "Japan",
                    code: "JP",
                    city: "Tokyo",
                    region: "Tokyo",
                },
            })
        );

        expect(response.status).toBe(200);
        const setCookie = response.headers.get("set-cookie");
        expect(setCookie).toContain("userCountry=");
        expect(setCookie).toContain("Path=/");
    });

    it("returns 400 when userCountry is missing", async () => {
        const response = await POST(createRequest({}));

        expect(response.status).toBe(400);
        expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("returns 400 and does not set a cookie for an invalid country shape", async () => {
        const response = await POST(
            createRequest({ userCountry: { name: "Japan" } })
        );

        expect(response.status).toBe(400);
        expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("returns 400 and does not set a cookie for malformed JSON", async () => {
        const response = await POST(
            new Request(url, {
                method: "POST",
                body: "not-json",
                headers: { "Content-Type": "application/json" },
            })
        );

        expect(response.status).toBe(400);
        expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("drops extra country fields before serializing the cookie", async () => {
        const response = await POST(
            createRequest({
                userCountry: {
                    name: "Japan",
                    code: "JP",
                    city: "Tokyo",
                    region: "Tokyo",
                    evil: "untrusted-data",
                },
            })
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("set-cookie")).not.toContain("evil");
        expect(response.headers.get("set-cookie")).not.toContain("untrusted-data");
    });

    it("returns 400 and does not set a cookie for an oversized country field", async () => {
        const response = await POST(
            createRequest({
                userCountry: {
                    name: "x".repeat(101),
                    code: "JP",
                    city: "Tokyo",
                    region: "Tokyo",
                },
            })
        );

        expect(response.status).toBe(400);
        expect(response.headers.get("set-cookie")).toBeNull();
    });
});
