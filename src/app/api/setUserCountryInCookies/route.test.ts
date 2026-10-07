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
        // XSS での窃取と CSRF を防ぐクッキー保護属性。route.ts 側で後退した場合に
        // 検知できるよう固定する（既定値に依存せず明示的に検証する）
        expect(setCookie).toContain("HttpOnly");
        expect(setCookie).toContain("SameSite=lax");
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
        expect(response.headers.get("set-cookie")).not.toContain(
            "untrusted-data"
        );
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

describe("POST /api/setUserCountryInCookies — rate limit (ADR-009)", () => {
    const validBody = {
        userCountry: {
            name: "Japan",
            code: "JP",
            city: "Tokyo",
            region: "Tokyo",
        },
    };

    // モジュールレベルの limiter はテスト間で共有されるため、テストごとに別の IP を使う
    const requestFrom = (
        headers: Record<string, string>,
        body: unknown = validBody
    ) =>
        new Request(url, {
            method: "POST",
            body: typeof body === "string" ? body : JSON.stringify(body),
            headers: { "Content-Type": "application/json", ...headers },
        });

    // limiter はモジュール評価時に環境変数から上限を読むため、上限を固定したうえで
    // 隔離したモジュールを読み込み、終了後に環境変数を元へ戻す
    const withIsolatedRoute = async (
        limit: string,
        run: (post: typeof POST) => Promise<void>
    ) => {
        const original = process.env.RATE_LIMIT_COOKIE_PER_MIN;
        process.env.RATE_LIMIT_COOKIE_PER_MIN = limit;
        try {
            await jest.isolateModulesAsync(async () => {
                const { POST: isolatedPost } = await import("./route");
                await run(isolatedPost);
            });
        } finally {
            if (original === undefined)
                delete process.env.RATE_LIMIT_COOKIE_PER_MIN;
            else process.env.RATE_LIMIT_COOKIE_PER_MIN = original;
        }
    };

    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        warnSpy.mockRestore();
    });

    it("同じ x-real-ip からの 6 回目は 429 + Retry-After を返し、cookie を設定しない", async () => {
        await withIsolatedRoute("5", async (post) => {
            // Arrange
            const headers = { "x-real-ip": "203.0.113.1" };
            for (let i = 0; i < 5; i++) {
                expect((await post(requestFrom(headers))).status).toBe(200);
            }

            // Act
            const response = await post(requestFrom(headers));

            // Assert
            expect(response.status).toBe(429);
            expect(
                Number(response.headers.get("retry-after"))
            ).toBeGreaterThanOrEqual(1);
            expect(response.headers.get("set-cookie")).toBeNull();
            // IP は個人情報に当たり得るためログに出さない
            expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(
                "203.0.113.1"
            );
        });
    });

    it("不正な JSON も回数に数える（パース前に判定する）", async () => {
        await withIsolatedRoute("5", async (post) => {
            // Arrange
            const headers = { "x-real-ip": "203.0.113.2" };
            for (let i = 0; i < 5; i++) {
                expect(
                    (await post(requestFrom(headers, "not-json"))).status
                ).toBe(400);
            }

            // Act
            const response = await post(requestFrom(headers));

            // Assert
            expect(response.status).toBe(429);
        });
    });

    it("x-real-ip が無い場合は制限しない（fail-open）", async () => {
        // Arrange
        const original = process.env.VERCEL;
        delete process.env.VERCEL;
        const statuses: number[] = [];

        try {
            // Act
            for (let i = 0; i < 10; i++) {
                statuses.push((await POST(requestFrom({}))).status);
            }

            // Assert
            expect(statuses.every((s) => s === 200)).toBe(true);
            // ローカル / CI（VERCEL 未設定）では欠落が正常なので警告しない
            expect(warnSpy).not.toHaveBeenCalled();
        } finally {
            if (original === undefined) delete process.env.VERCEL;
            else process.env.VERCEL = original;
        }
    });

    it("Vercel 上で x-real-ip が無い場合は IP を含まない警告を出し、fail-open する", async () => {
        // Arrange
        const original = process.env.VERCEL;
        process.env.VERCEL = "1";

        try {
            // Act
            const response = await POST(requestFrom({}));

            // Assert
            expect(response.status).toBe(200);
            expect(warnSpy).toHaveBeenCalledWith(
                "[setUserCountryInCookies:POST] x-real-ip missing; rate limit skipped",
                { failOpen: true }
            );
        } finally {
            if (original === undefined) delete process.env.VERCEL;
            else process.env.VERCEL = original;
        }
    });

    it("x-forwarded-for を変えても x-real-ip が同じなら回数はリセットされない", async () => {
        await withIsolatedRoute("5", async (post) => {
            // Arrange
            for (let i = 0; i < 5; i++) {
                await post(
                    requestFrom({
                        "x-real-ip": "203.0.113.3",
                        "x-forwarded-for": `198.51.100.${i}`,
                    })
                );
            }

            // Act
            const response = await post(
                requestFrom({
                    "x-real-ip": "203.0.113.3",
                    "x-forwarded-for": "198.51.100.99",
                })
            );

            // Assert
            expect(response.status).toBe(429);
        });
    });

    it("RATE_LIMIT_COOKIE_PER_MIN で上限を上書きできる", async () => {
        await withIsolatedRoute("2", async (post) => {
            // Arrange
            const headers = { "x-real-ip": "203.0.113.4" };
            await post(requestFrom(headers));
            await post(requestFrom(headers));

            // Act
            const response = await post(requestFrom(headers));

            // Assert
            expect(response.status).toBe(429);
        });
    });
});
