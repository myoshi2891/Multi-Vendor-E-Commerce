/**
 * インメモリの Fixed Window レート制限。
 *
 * カウントはプロセス内の `Map` に保持するため、**インスタンスごとの値であり全体の上限ではない**
 * （Vercel のサーバーレスではインスタンス間で共有されない）。DB 負荷の大きい検索経路は
 * Vercel WAF で制限し、本モジュールは DB を使わない経路の補助的な安全網として使う。
 * 方式の決定: docs/architecture/decisions/009-public-endpoint-rate-limiting.md
 */

export type RateLimitDecision = { allowed: boolean; retryAfterSec: number };

type WindowEntry = { count: number; windowStart: number };

const DEFAULT_MAX_KEYS = 10_000;

/**
 * Fixed Window limiter を生成する。
 *
 * - 期限切れのエントリはアクセス時に作り直す（タイマーを持たない）
 * - 保持キー数が `maxKeys` に達したら、挿入順で最も古いキーを捨てる
 *   （ランダムな IP を大量に送られても limiter 自体がメモリを食い潰さない）
 *
 * @param opts.limit    ウィンドウあたりの許可回数
 * @param opts.windowMs ウィンドウ長（ミリ秒）
 * @param opts.maxKeys  保持するキー数の上限（既定 10,000）
 * @param opts.now      現在時刻の取得関数（テスト用に注入可能）
 */
export function createFixedWindowLimiter(opts: {
    limit: number;
    windowMs: number;
    maxKeys?: number;
    now?: () => number;
}): { check(key: string): RateLimitDecision } {
    const { limit, windowMs } = opts;
    const maxKeys = opts.maxKeys ?? DEFAULT_MAX_KEYS;
    const now = opts.now ?? Date.now;
    const entries = new Map<string, WindowEntry>();

    const check = (key: string): RateLimitDecision => {
        const current = now();
        const entry = entries.get(key);

        if (entry && current - entry.windowStart < windowMs) {
            if (entry.count < limit) {
                entry.count += 1;
                return { allowed: true, retryAfterSec: 0 };
            }
            const remainingMs = entry.windowStart + windowMs - current;
            return {
                allowed: false,
                retryAfterSec: Math.max(1, Math.ceil(remainingMs / 1000)),
            };
        }

        // 新規キー、または期限切れ。期限切れは削除して挿入順の末尾へ付け直す
        entries.delete(key);
        if (entries.size >= maxKeys) {
            const oldest = entries.keys().next();
            if (!oldest.done) entries.delete(oldest.value);
        }
        entries.set(key, { count: 1, windowStart: current });
        return { allowed: true, retryAfterSec: 0 };
    };

    return { check };
}

/**
 * 上限値の環境変数を正の整数へ変換する。
 * 未設定・空白・非数値・1 未満は `fallback`、小数は切り捨てる（tech.md「環境変数の数値変換」）。
 */
export function parseLimitEnv(
    raw: string | undefined,
    fallback: number
): number {
    const trimmed = raw?.trim();
    if (!trimmed) return fallback;

    const value = Math.floor(Number(trimmed));
    if (!Number.isFinite(value) || value < 1) return fallback;
    return value;
}
