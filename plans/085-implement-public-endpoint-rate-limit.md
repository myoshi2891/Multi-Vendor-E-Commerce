# Plan 085: 公開エンドポイントにレート制限を入れる（cookie 書き込み = アプリ内 / 検索 = Vercel WAF）

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> ```bash
> git diff --stat 7edcb20b -- src/app/api/setUserCountryInCookies src/lib/rate-limit.ts .env.example
> git status --porcelain -- src/app/api/setUserCountryInCookies src/lib/
> ```
> `.env.example` は plan 011 で未コミットのまま新規作成されている（2026-10-07 時点）。それ以外の差分が出たら
> "Current state" と突き合わせること。

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW（DB を使わない 1 ルートへの追加と、新規の純粋モジュール 1 つ。検索側はリポジトリの外で設定する）
- **Depends on**: [025](025-spike-rate-limit-public-endpoints.md)（spike・決定済み）
- **Category**: security
- **Planned at**: commit `7edcb20b`, 2026-10-07

## Why this matters

公開エンドポイントにはレート制限が無く、未認証のクライアントが検索（DB 負荷）や cookie 書き込みを
いくらでも繰り返せる。方式は [ADR-009](../docs/architecture/decisions/009-public-endpoint-rate-limiting.md)
で次のとおり決まった: 検索 2 本は **Vercel WAF の rate-limit ルール 1 本**（Hobby の無料枠）、
cookie 書き込みは **アプリ内のインメモリ Fixed Window limiter**（インスタンスごとの補助的な安全網）、
障害時は **fail-open**。

## Current state

- `src/app/api/setUserCountryInCookies/route.ts` — `POST` ハンドラー。`request.json()` → `isCountry` で形を検証 →
  各フィールド 100 文字の上限（`MAX_FIELD_LEN`）→ `response.cookies.set("userCountry", ...)`。
  エラーログは `console.error("[setUserCountryInCookies:POST] ...", { error, stack })` の 2 引数形式。
  呼び出し元は `src/components/store/layout/header/country-lang-curr-selector.tsx`（ユーザーが国を選択したときだけ呼ぶ）。
- `src/app/api/setUserCountryInCookies/route.test.ts` — `new Request(url, {...})` を組み立てて `POST` を直接呼ぶ形式。
- `src/` には rate-limit の実装が無い（`grep -rniE "ratelimit|rate-limit|upstash|throttle" src` → 0 件）。
- 規約（`.claude/steering/tech.md`）:
  - 数値型の環境変数は `trim()` してから変換し、空文字列には fallback を使う。`Number.isFinite` で検証する
  - `src/` での `console.log` は禁止。警告は `console.warn("[Module:Function] msg", { ... })` の形式
  - `any` は禁止
- 信頼境界（spike 文書の「Keying and trusted client identity」節）: **生の `x-forwarded-for` はキーにしない**。
  Vercel はプラットフォーム側で `x-real-ip` にクライアント IP を設定するので、これだけを信頼する。

## Commands you will need

| Purpose    | Command | Expected |
|------------|---------|----------|
| Unit tests | `bun run test -- src/lib/rate-limit.test.ts src/app/api/setUserCountryInCookies/route.test.ts` | all pass |
| Typecheck  | `bunx tsc --noEmit` | exit 0 |
| Lint       | `bun run lint` | exit 0 |
| E2E（退行確認） | `bunx playwright test tests/e2e/country-selector.spec.ts --project=chromium` | all pass |

## Scope

**In scope**:
- `src/lib/rate-limit.ts`（新規）/ `src/lib/rate-limit.test.ts`（新規）
- `src/app/api/setUserCountryInCookies/route.ts` / `route.test.ts`
- `.env.example`（`RATE_LIMIT_COOKIE_PER_MIN` を追記）
- テスト統計の同期（`spec-sync-after-test`）と `plans/README.md` の状態行

**Out of scope**:
- 検索 route（`index-products` / `search-products`）のコード — WAF 側で制限するので、アプリ側には入れない（ADR-009）
- `src/proxy.ts`（middleware）での一括制限 — ADR-009 の判断はルートごとの実装
- 依存の追加（`@upstash/ratelimit`・`@vercel/functions` 等）

## Steps

### Step 1 (Red): limiter のテストを書く

`src/lib/rate-limit.test.ts`（AAA）。時刻は `now` を注入して制御する:
1. `limit` 回までは `allowed: true`
2. `limit + 1` 回目は `allowed: false`、`retryAfterSec` はウィンドウの残り時間（切り上げ、1 以上）
3. `windowMs` が経過したらリセットされる
4. キーごとに独立している
5. `maxKeys` を超えたら最も古いキーを捨てる（捨てられたキーは、次の呼び出しで新しいウィンドウとして扱われる）
6. `parseLimitEnv`: 未定義・空・空白・`"abc"`・`"0"`・`"-1"` は fallback、`" 7 "` は 7、`"2.9"` は 2（切り捨て）

**Verify**: 上記のテストが、モジュールが存在しないことではなく **アサーションの失敗**で落ちること
（先にファイルだけ作って export を空にしておく）。

### Step 2 (Green): `src/lib/rate-limit.ts`

```ts
export type RateLimitDecision = { allowed: boolean; retryAfterSec: number };
export function createFixedWindowLimiter(opts: {
    limit: number; windowMs: number; maxKeys?: number; now?: () => number;
}): { check(key: string): RateLimitDecision };
export function parseLimitEnv(raw: string | undefined, fallback: number): number;
```

- 内部は `Map<string, { count: number; windowStart: number }>`。新しいキーを入れる前に `size >= maxKeys`（既定 10_000）なら、
  `map.keys().next()` で得た最も古いキーを削除する
- 期限切れのエントリーは、アクセスしたときに作り直す（タイマーは使わない）
- JSDoc を書く（「インスタンスごとの値で、全体の上限ではない」こと、ADR-009 へのリンク）

**Verify**: `bun run test -- src/lib/rate-limit.test.ts` → all pass

### Step 3 (Red → Green): route へ組み込む

`route.test.ts` に追加する（各テストで **異なる `x-real-ip`** を使い、モジュールレベルの limiter の状態がテスト間で漏れないようにする）:
- 同じ `x-real-ip` で 5 回は 200、6 回目は **429**。`Retry-After` ヘッダーは 1 以上の整数で、`set-cookie` は付かない
- 不正な JSON でも回数に数える（JSON をパースする前に判定する）
- `x-real-ip` が無ければ 10 回でも 429 にならない（fail-open。ローカル / CI の E2E を保護する）
- `x-forwarded-for` だけを変えても回数はリセットされない（`x-real-ip` が同じなら 6 回目は 429）
- `RATE_LIMIT_COOKIE_PER_MIN=2` のとき 3 回目が 429（`jest.isolateModules` で route を読み込み直す）

実装（`route.ts`）:
```ts
const cookieLimiter = createFixedWindowLimiter({
    limit: parseLimitEnv(process.env.RATE_LIMIT_COOKIE_PER_MIN, 5),
    windowMs: 60_000,
});
// POST の先頭で:
const clientIp = request.headers.get("x-real-ip")?.trim();
if (clientIp) {
    const decision = cookieLimiter.check(clientIp);
    if (!decision.allowed) {
        console.warn("[setUserCountryInCookies:POST] Rate limited", { retryAfterSec: decision.retryAfterSec });
        return new NextResponse("Too many requests.", {
            status: 429, headers: { "Retry-After": String(decision.retryAfterSec) },
        });
    }
}
```
IP は個人情報に当たり得るので、ログには出さない。

**Verify**: `bun run test -- src/app/api/setUserCountryInCookies/route.test.ts` → 既存のテストと新しいテストがすべて pass

### Step 4: `.env.example`

Stripe / PayPal のブロックの後に追記する:
```
# --- Rate limit (ADR-009) ---
# cookie 書き込み API の 1 分あたり上限（IP ごと・インスタンスごと）。未設定なら 5
RATE_LIMIT_COOKIE_PER_MIN=
```

### Step 5: 品質ゲートと統計の同期

`bunx tsc --noEmit` → `bun run lint` → E2E（country-selector, chromium）。テスト数が変わるので `spec-sync-after-test` を実行する
（`QA_HANDOFF.md` が SSOT → `07-testing.md` / `COVERAGE_REPORT.md` / `PROGRESS.md`、`bun run coverage:dashboard`）。

### Step 6（オペレーター作業）: Vercel WAF ルール

Vercel ダッシュボード → Project → Firewall → Configure → New Rule:
- If: `Request Path` が `/api/index-products` で始まる **OR** `Request Path` が `/api/search-products` で始まる
- Then: Rate Limit / Fixed Window / 60s / **30** requests / Key: IP / Action: Too Many Requests (429)
- 保存してから **Publish** する（保存だけではルールは本番に適用されない。Publish 済みであることをダッシュボードの公開状態で確認する）

**検索経路のレート制限は、次の 2 点がそろうまで「提供済み」と扱わない**:
(1) オペレーターがルールを Publish したこと（保存のみは不可）、(2) 下記 Verify の結果を「実施結果」節に記録したこと。
どちらかが欠ける間、本プランの Status は `IN PROGRESS（WAF 待ち）` のままとする。

**Verify（オペレーター）**: 本番 URL へ
`for i in $(seq 1 35); do curl -s -o /dev/null -w "%{http_code}\n" "https://<prod>/api/search-products?search=a"; done | sort | uniq -c`
を実行し、200 が 30 件前後、429 が 5 件前後になること。結果をこのプランの「実施結果」節に記録する。

## Done criteria

- [ ] `src/lib/rate-limit.test.ts` と、拡張した `route.test.ts` がすべて pass
- [ ] `bunx tsc --noEmit` と `bun run lint` が exit 0
- [ ] `grep -n "x-forwarded-for" src/app/api/setUserCountryInCookies/route.ts` → 0 件
- [ ] `.env.example` に `RATE_LIMIT_COOKIE_PER_MIN` がある
- [ ] テスト統計を同期し、ダッシュボードを再生成した
- [ ] Step 6 の WAF ルールについて、オペレーターの確認を記録した（未確認なら Status は `IN PROGRESS（WAF 待ち）`）

## STOP conditions

- 依存の追加が必要になった → STOP（ADR-009 の範囲外）
- 検索 route のコードを変更したくなった → STOP（WAF 側の責務）
- E2E（country-selector）が 429 で落ちた → STOP（ローカルに `x-real-ip` を付けるプロキシがある可能性。前提を確認し直す）
- Vercel のプランで rate-limit ルールが作成できない → STOP し、ADR-009 の見直しをメンテナーに依頼する

## Maintenance notes

- 商用公開や Pro プランへの移行時は ADR-009 を見直す（ルールを複数にする / Upstash を再評価する）。
- Vercel 以外へ移すときは、`x-real-ip` を信頼している前提が崩れる。信頼境界を設計し直すこと。
- 公開ルートを新しく追加するときは、WAF ルールの path 条件に加えるか、この limiter を再利用する。

## 実施結果（2026-10-07・未コミット）

- Step 1–5 完了。Red はいずれもアサーション失敗で確認（limiter 6 件 / route 4 件）。
- Jest 全体: 2941 passed / 2944 total・305 スイート（+19・+1）。`bunx tsc --noEmit` 0 件、`bun run lint` 0 errors（既存 8 warnings）。
- E2E `country-selector.spec.ts`（chromium）は 2 件失敗したが、**いずれも cookie API への POST より前で失敗**しており、429 ではない
  （テスト 1 は cookie 直接注入で API を呼ばない / テスト 2 は `getByText("Ship to")` の strict mode 違反）。:3000 で Docker アプリが
  動作している環境起因の既存失敗とみなし、本プランの範囲外とする。同 spec のコメントの `route.ts:49` 行番号参照はファイル名参照へ修正。
- **Step 6（Vercel WAF ルール）は未実施** — オペレーターの Publish と検証記録の両方が未確認のため、検索経路のレート制限は**未提供**扱い。

