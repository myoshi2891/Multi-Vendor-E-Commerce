# 009. 公開エンドポイントのレート制限 — Vercel WAF（検索）+ アプリ内インメモリ（cookie 書き込み）

- **Status**: Accepted（2026-10-07・[plan 025](../../../plans/025-spike-rate-limit-public-endpoints.md) の Step 3 ゲートを通過）
- **Date**: 2026-10-07
- **Deciders**: メンテナー（spike [`rate-limiting-spike.md`](../rate-limiting-spike.md) の Open questions に回答）

---

## Context

アプリケーションには、リクエスト単位のレート制限が**どこにも無い**（`grep -rniE "ratelimit|rate-limit|upstash|throttle" src` は 0 件）。
未認証で呼べる公開ハンドラーは 3 本で、乱用されたときの影響はそれぞれ異なる。

| Route | 1 回あたりの処理 | 乱用時の影響 |
|---|---|---|
| `/api/index-products`（POST / GET） | Prisma の全文検索（GET は件数取得も行う）。plan 023 で `limit` の上限は 50 | DB 負荷 |
| `/api/search-products`（GET） | `$queryRaw` で `to_tsvector` / `plainto_tsquery` を実行し、`LIMIT 50` | DB 負荷 |
| `/api/setUserCountryInCookies`（POST） | JSON を検証して cookie を書き込む。DB は使わない | 書き込み・CPU の濫用 |

Webhook 3 本は署名検証を行っているので対象外とする。

前提となる制約:

- 本番環境は **Vercel + Neon**（[`docs/development/docker-dev.md`](../../development/docker-dev.md) の 6 行目）。サーバーレスなので、プロセス内の状態はインスタンス間で共有されない。
- メンテナーの方針として、**無料枠の範囲で**対応する。
- Vercel WAF の Hobby プランでは、レート制限ルールは **1 プロジェクトにつき 1 本**、方式は Fixed Window のみで、許可されたリクエストは月 100 万件まで追加料金なし（2026-06 時点の Vercel 公式ドキュメント）。
- Upstash Redis の Free プランは月 50 万コマンドまで。`@upstash/ratelimit` はおおむね 2 コマンドで 1 回判定するので、月 25 万リクエスト程度が上限になる。
- `x-forwarded-for` はクライアントが偽装できるので、レート制限のキーにしてはならない（spike の「Keying and trusted client identity」節）。

---

## Decision

1. **検索 2 本は Vercel WAF の rate-limit ルール 1 本で制限する**
   - 条件: path が `/api/index-products` または `/api/search-products`
   - キー: IP（プラットフォームが判定したクライアント IP）。Fixed Window、60 秒あたり **30 回**。超過時は **429** を返す
   - 設定は Vercel ダッシュボードで行うため、リポジトリには残らない。手順と確認方法は [plan 085](../../../plans/085-implement-public-endpoint-rate-limit.md) に記録する
2. **cookie 書き込みは、アプリ内のインメモリ Fixed Window limiter で制限する**（`src/lib/rate-limit.ts`）
   - キー: Vercel がプラットフォーム側で設定する `x-real-ip` だけを使う。**生の `x-forwarded-for` は使わない**
   - 上限: IP ごとに 1 分あたり **5 回**。環境変数 `RATE_LIMIT_COOKIE_PER_MIN` で上書きできる
   - 超過時は `429` と `Retry-After` を返す
   - 保持するキーの数に上限を設け、超えたら古いものから捨てる（limiter 自体がメモリを食い潰す経路を作らない）
3. **障害時は fail-open とする**: `x-real-ip` が無い場合（ローカル / Docker / CI）や判定できない場合は、制限せずに通す。

---

## Alternatives Considered

### Option B: Upstash Redis（`@upstash/ratelimit`）で全ルートを制限する

**メリット**: インスタンス間でカウントを共有できるので、上限が正しく保証される。endpoint ごとに上限を変えられ、Jest でテストも書ける。

**デメリット**: 外部依存 1 つと環境変数 2 つが増え、判定のたびにネットワーク往復が発生する。無料枠は月 25 万リクエスト程度で、検索トラフィックが伸びるとすぐに超える。

**なぜ選ばなかったか**: 「無料枠の範囲で」という方針の下では、DB 負荷が大きい検索側は WAF に任せた方が、上限に達するまでの余裕が大きく、アプリが実行される前に止められる。

### Option A のみ: すべてのルートをインメモリで制限する

**デメリット**: サーバーレスではインスタンスごとにカウントが分かれるため、全体の上限を保証できない。DB 負荷が大きい検索側の守りとしては不十分。

**なぜ選ばなかったか**: DB を守る主な手段にはならない。DB を使わない cookie ルートの補助的な安全網としてのみ採用する。

### Option D: 今フェーズでは見送る

**なぜ選ばなかったか**: 無料枠で実現できる手段があり、メンテナーが今フェーズの範囲に含めると判断したため。

---

## Consequences

### Positive

- DB 負荷が大きい検索経路は、アプリが実行される前（エッジ）で止まる。アプリ側でクライアント IP を判定する必要もない。
- 新しい依存も、外部のストアも増えない。費用は 0。
- cookie ルートは、アプリ内のテストで挙動を固定できる。

### Negative

- WAF の設定はリポジトリの外にあるため、レビューや差分で追えない。plan 085 の手順書と、オペレーターによる確認記録で補う。
- Hobby プランのルールは 1 本しかないので、ルートごとに上限を変えたり、別のルートを追加で守ったりすることはできない。
- cookie 側の上限はインスタンスごとの値で、全体の上限ではない。
- Vercel 以外の環境（ローカル / Docker）では、どちらの制限も働かない。

### Risks

- **Hobby プランは非商用利用に限られる**。商用として公開するときは Pro プランへ移行するのが前提になる。その時点で本 ADR を見直す（ルールを複数にする / Option B を再評価する）。
- `x-real-ip` は Vercel が設定するヘッダーである。Vercel 以外の環境に移した場合、このヘッダーをそのまま信頼すると偽装されたキーを受け入れることになる → 移行時に信頼境界を設計し直す。

---

## Related

- 設計 spike: [`docs/architecture/rate-limiting-spike.md`](../rate-limiting-spike.md)
- 実装プラン: [`plans/085-implement-public-endpoint-rate-limit.md`](../../../plans/085-implement-public-endpoint-rate-limit.md)
- 関連プラン: [023](../../../plans/023-bound-and-validate-public-search-pagination.md)（検索のページ件数の上限）/ [024](../../../plans/024-validate-usercountry-cookie-write.md)（cookie 書き込みの入力検証）
