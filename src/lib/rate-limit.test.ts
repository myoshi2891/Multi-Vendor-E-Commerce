import { createFixedWindowLimiter, parseLimitEnv } from "./rate-limit";

describe("createFixedWindowLimiter", () => {
    const makeClock = (start = 1_000_000) => {
        let t = start;
        return {
            now: () => t,
            advance: (ms: number) => {
                t += ms;
            },
        };
    };

    it("limit 回までは許可する", () => {
        // Arrange
        const clock = makeClock();
        const limiter = createFixedWindowLimiter({
            limit: 3,
            windowMs: 60_000,
            now: clock.now,
        });

        // Act
        const results = [1, 2, 3].map(() => limiter.check("1.1.1.1").allowed);

        // Assert
        expect(results).toEqual([true, true, true]);
    });

    it("limit + 1 回目は拒否し、ウィンドウ残り時間を切り上げた秒数を返す", () => {
        // Arrange
        const clock = makeClock();
        const limiter = createFixedWindowLimiter({
            limit: 2,
            windowMs: 60_000,
            now: clock.now,
        });
        limiter.check("ip");
        clock.advance(10_500);
        limiter.check("ip");

        // Act
        const decision = limiter.check("ip");

        // Assert
        expect(decision.allowed).toBe(false);
        expect(decision.retryAfterSec).toBe(50); // 60s - 10.5s = 49.5s → 50
    });

    it("windowMs 経過後はリセットされる", () => {
        // Arrange
        const clock = makeClock();
        const limiter = createFixedWindowLimiter({
            limit: 1,
            windowMs: 60_000,
            now: clock.now,
        });
        limiter.check("ip");
        expect(limiter.check("ip").allowed).toBe(false);

        // Act
        clock.advance(60_000);
        const decision = limiter.check("ip");

        // Assert
        expect(decision).toEqual({ allowed: true, retryAfterSec: 0 });
    });

    it("キーごとに独立して数える", () => {
        // Arrange
        const clock = makeClock();
        const limiter = createFixedWindowLimiter({
            limit: 1,
            windowMs: 60_000,
            now: clock.now,
        });
        limiter.check("a");

        // Act
        const other = limiter.check("b");
        const same = limiter.check("a");

        // Assert
        expect(other.allowed).toBe(true);
        expect(same.allowed).toBe(false);
    });

    it("maxKeys を超えると最も古いキーを捨てる", () => {
        // Arrange
        const clock = makeClock();
        const limiter = createFixedWindowLimiter({
            limit: 1,
            windowMs: 60_000,
            maxKeys: 2,
            now: clock.now,
        });
        limiter.check("a");
        limiter.check("b");

        // Act
        limiter.check("c"); // "a" が追い出される
        const evicted = limiter.check("a"); // 新しいウィンドウ扱い
        const kept = limiter.check("c");

        // Assert
        expect(evicted.allowed).toBe(true);
        expect(kept.allowed).toBe(false);
    });
});

describe("parseLimitEnv", () => {
    it.each([undefined, "", "   ", "abc", "0", "-1", "Infinity"])(
        "不正値 %p は fallback を返す",
        (raw) => {
            expect(parseLimitEnv(raw, 5)).toBe(5);
        }
    );

    it("前後の空白を除いて整数に変換する", () => {
        expect(parseLimitEnv(" 7 ", 5)).toBe(7);
    });

    it("小数は切り捨てる", () => {
        expect(parseLimitEnv("2.9", 5)).toBe(2);
    });
});
