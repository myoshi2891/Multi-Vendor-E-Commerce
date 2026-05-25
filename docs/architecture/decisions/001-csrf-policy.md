# 001. CSRF Protection Policy for Server Actions

- **Status**: Accepted
- **Date**: 2026-05-24
- **Deciders**: project team

---

## Context

本プロジェクトの mutation 処理（決済・注文・店舗・商品・クーポン管理）は、すべて Next.js 16 App Router の Server Actions として `src/queries/` 配下に実装されている。これらは Cookie ベースの Clerk セッションで認可されるため、第三者サイトからの自動フォーム送信や `<img src="...">` 系の偽装リクエストに対する **CSRF 防御の方針** を明示する必要がある。

調査時点（2026-05-24）の事実:

- `package.json` に CSRF 関連ライブラリ（`next-csrf` / `@edge-csrf/nextjs` / `csurf` 等）は無い。
- `src/lib/csrf*`、`src/queries/` 内での `headers()` 呼び出し、Origin/Referer 検証コードは存在しない。
- `specs/multi-vendor-ecommerce/06-quality.md` の Security 節に CSRF 項目は無い。
- 一方、Next.js 14 以降の Server Actions はフレームワーク内で **Origin ↔ Host header の照合** を自動実施し、不一致リクエストを 403 で拒否する（[Next.js Security docs](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#security)）。
- Clerk セッション Cookie は `SameSite=Lax` で発行され（v7 既定）、クロスサイト POST にはそもそも添付されない。

つまり既定状態でも二重の構造的防御（SameSite Cookie + Origin/Host 一致）が働いている。この上に**明示的トークン**を追加する価値・コストを評価したうえで採否を決める必要があった。

---

## Decision

**Next.js 16 Server Actions 組込みの Origin/Host 検証 + Clerk の SameSite=Lax Cookie** を CSRF 防御の単一ソースとする。明示的な CSRF トークン実装は導入しない。

具体的には:

1. `src/lib/csrf.ts` 等のトークンモジュールを新設しない。
2. 全 mutation Server Action へのトークン伝搬コードを追加しない。
3. Next.js のリリースノートで Origin 検証関連の挙動変更が出た場合は `tech.md` の CSRF 行を更新し、必要なら本 ADR を Superseded で置き換える。
4. テストレイヤーでは CSRF を直接検証しない（後述「Consequences」参照）。

---

## Alternatives Considered

### Option A: Next.js 既定 + SameSite=Lax のみ（採択）

**説明**: 追加実装なし。`<form action={serverAction}>` / `useActionState` 経由の通常パスはすべてフレームワークが守る。

- ✅ 実装ゼロ、保守ゼロ、Next.js のセキュリティ更新を自動取り込み。
- ✅ React Server Components / Server Actions の標準パターンと完全に整合。
- ❌ Origin header を spoof 不能と仮定するため、ブラウザのバグや将来の仕様変更にはフレームワーク依存。
- ❌ Jest 単体テストでは Server Action 内に Origin が露出しないため、CSRF 機構そのものは検証不可能。

### Option B: ダブルサブミット Cookie（`@edge-csrf/nextjs` 等）

**説明**: middleware で CSRF トークンを Cookie に発行 → Server Action 呼び出し時に hidden field でトークンを再送 → サーバー側で Cookie 値と再送値の一致を検証。

- ✅ 多層防御。Origin チェックが破られた場合の二段目となる。
- ✅ トークン検証ロジックを単体テストで検証可能。
- ❌ Server Action は `<form action={fn}>` で呼ばれることが多く、hidden field 注入の機構を全フォームに横展開する必要がある（Server Component と Client Component で挙動が異なり、`useActionState` と FormData の組合せで複雑化）。
- ❌ Edge runtime での Cookie 書き込み制約と Clerk middleware の連結に追加調整が必要。
- ❌ Origin チェックと「同等の脅威モデル」を扱うため二重防御の追加価値が限定的（攻撃シナリオが共通: 攻撃者が任意の Header を作れるなら Cookie も読めない一方、Cookie を読めるならトークンも漏れる）。

### Option C: 自前 `src/lib/csrf.ts` でセッション結合トークン

**説明**: Clerk セッション ID から HMAC でトークンを派生し、Cookie + Header の両方に同梱して検証する。

- ✅ Clerk セッションとの結合により stolen token の有効期間を最短化可能。
- ❌ 暗号鍵管理（環境変数、ローテーション）と Clerk セッションライフサイクルへの結合の保守コストが大きい。
- ❌ Option B 同様、Server Action パイプライン全体への横展開が必要で、ビュー側の DX を犠牲にする。
- ❌ 「Next.js 既定が変わったらどうする」を解決しないため、Option A の本質的代替にならない。

---

## Consequences

### Positive

- 実装・保守コストがゼロ。フレームワークのセキュリティアップデートを自動的に取り込む。
- ビュー層・テスト層・CI 設定に CSRF 専用の足場が不要で、開発速度を維持できる。
- Clerk セッション Cookie の SameSite=Lax と組み合わせることで、CSRF の主要ベクトル（cross-site automatic POST）は構造的に閉じる。

### Negative

- Jest 単体テストでは CSRF 機構そのものを検証できない（Server Action は Origin header を受け取らない）。E2E でも同一 origin で動くため実害シナリオの再現が困難。
- フレームワーク既定への信頼が前提となる。Next.js が将来 Origin 検証の挙動を変えた場合、本 ADR は即座に再評価が必要。
- 多層防御（defense in depth）の観点では一段薄い。Origin 検証が破られた場合の二次防御がない。

### Mitigation

- `tech.md` の「コーディング規約」表に **「CSRF: Next.js 16 Server Actions の Origin/Host 検証に依拠。`src/lib/csrf*` を新設しないこと。例外時は ADR 001 を更新する」** を追記し、新規実装での乖離を防ぐ。
- `specs/multi-vendor-ecommerce/06-quality.md` の Security 節に方針行を追記し、QA レビューでも参照できるようにする。
- リリース時に Next.js のリリースノートで `Server Actions` / `Origin` キーワードを確認する責務を、メンテナーに委ねる（自動化はスコープ外）。
- 万が一 Origin 検証が外れた場合の検出: 既存の `src/queries/` 単体テスト（unauth・role・IDOR の 270 件超）が「未認証アクセスは弾く」「他人のリソースは見えない」の最終防衛線として残る。

---

## Related

- 関連スペック: [`specs/multi-vendor-ecommerce/06-quality.md`](../../../specs/multi-vendor-ecommerce/06-quality.md) — Security 節に方針行を同期。
- 関連ステアリング: [`.claude/steering/tech.md`](../../../.claude/steering/tech.md) — コーディング規約表に新規行。
- 関連レポート: [`docs/testing/SECURITY_GAP_REPORT.md`](../../testing/SECURITY_GAP_REPORT.md) — CSRF は本 ADR を参照する旨を追記。
- Next.js 公式: [Server Actions and Mutations — Security](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations#security)
