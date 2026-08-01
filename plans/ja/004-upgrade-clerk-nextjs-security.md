# プラン 004: `@clerk/nextjs` を CRITICAL ミドルウェア認証バイパス勧告の圏外へアップグレード

> 原本: [../004-upgrade-clerk-nextjs-security.md](../004-upgrade-clerk-nextjs-security.md)

> **Executor 向け指示**: このプランを順番どおりに実行すること。各検証コマンドを実行し、
> 次に進む前に期待結果を確認する。「STOP conditions」に該当する事象が起きたら、
> 停止して報告すること — 独自判断で進めない。完了したら `plans/README.md` の
> このプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**: `git diff --stat f9752c0..HEAD -- package.json bun.lock src/middleware.ts`
> `package.json`/`bun.lock` が既に `@clerk/nextjs` を 7.2.4 以降（本プランの目標値 —
> CRITICAL 勧告自体の修正版は **7.2.1** だが、7.2.4 は推移的 HIGH `js-cookie` も解消するため
> こちらを目標にしている）にしている場合、
> 勧告は既に解消済みの可能性がある — 何もする前に STOP してインストール済み
> バージョンを報告すること。

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW-MED
- **Depends on**: none
- **Category**: dependencies
- **Planned at**: commit `f9752c0`, 2026-07-03

## なぜ重要か

`@clerk/nextjs` は `^7.0.7` にピン留めされ 7.0.7 に解決される。これは **GHSA-vqx2-fgx2-5wq9**（CRITICAL、ミドルウェアベースのルート保護バイパス、`>=7.0.0 <7.2.1` に影響、`7.2.1` で修正）と HIGH の GHSA-w24r-5266-9c3c の影響範囲内にある。本リポジトリの `src/middleware.ts` は、まさにこの勧告が標的とするパターン — `createRouteMatcher([...])` + `await auth.protect()` で `/dashboard`、`/checkout`、`/profile` をゲート — を使用している。攻撃者は有効なセッションなしにこれらの保護されたルートシェルに到達できる可能性がある。多層防御（サーバーアクションは `src/lib/auth-guards.ts` 経由で再検証し、dashboard レイアウトは `currentUser()` を呼ぶ）は露出を減らすが排除はしない — ミドルウェアを唯一のゲートとして依存しているページはすべてリスクにさらされる。v7 系内でのアップグレードは、小さく十分に限定された影響範囲でこの勧告を解消する。このアップグレードは、Clerk がパッチ済みの `@clerk/shared` を引くようになると、推移的依存の HIGH `js-cookie@3.0.5`（`@clerk/shared` 経由）も解消する。

## Current state

- `package.json:21` — `"@clerk/nextjs": "^7.0.7"`；`bun.lock` は 7.0.7 に解決。
- `package.json:116` — `"@clerk/testing": "^2.0.7"`（互換性を維持すること）。
- `src/middleware.ts` — 保護ルートのゲート（ファイル全体は短い；関連する行）:

  ```ts
  import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
  export default clerkMiddleware(async (auth, req, next) => {
      const protectedRoutes = createRouteMatcher([
          "/dashboard", "/dashboard/(.*)", "/checkout", "/profile", "/profile/(.*)",
      ]);
      if (protectedRoutes(req)) await auth.protect();
      // ... userCountry cookie logic ...
  });
  export const config = { matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"] };
  ```

- Clerk は `src/` 内の約55箇所で import されている（middleware、`layout.tsx` の `ClerkProvider`、`SignIn`/`SignUp`/`UserProfile` UI、`webhooks/route.ts` と `store.ts` の `clerkClient`、dashboard レイアウト + 多数の `src/queries/*` の `currentUser()`）。7.0 から 7.5 の間で削除された API はどれも使用していない（これは同一メジャー内のアップグレード）。
- `src/middleware.test.ts` が存在し（4テスト）、Clerk は `src/queries/*.test.ts` の各スイートでモックされている。

### リポジトリ規約 / 制約

- **パッケージマネージャーは Bun**（`bun.lock`）。`bun install` でインストールすること。
- **`src/middleware.ts` のロジックは変更しないこと** — 修正は依存バージョンのみ。`clerkMiddleware` + `auth.protect()` パターンは意図的なものであり 7.5.x でも引き続き有効（`.claude/steering/tech.md`「Clerk v7 非同期 API」参照）。`middleware`→`proxy` の非推奨警告は**文書化された非対応事項**である — ファイルをリネームしないこと。
- Peer 要件: `@clerk/nextjs` 7.x の peer は `next: ^16.1.0-0`；リポジトリは `next@16.2.1` を実行 — 充足済み。Next をバンプしないこと。

## 必要なコマンド

| 目的         | コマンド                                        | 期待結果            |
|-----------------|------------------------------------------------|---------------------|
| インストール         | `bun install`                                  | exit 0, lock 更新|
| 監査（確認）   | `bun audit`                                     | Clerk CRITICAL が消えている |
| 型チェック       | `bunx tsc --noEmit`                            | exit 0              |
| Middleware テスト | `bun run test -- src/middleware.test.ts`       | 全件 pass            |
| Clerk モック済み    | `bun run test -- src/queries/user.test.ts`     | 全件 pass            |
| Lint            | `bun run lint`                                 | exit 0（警告は許容）   |

## Scope

**対象内**:
- `package.json` — `@clerk/nextjs`（peer 要件がある場合のみ `@clerk/testing` も）をバンプ
- `bun.lock` — `bun install` により再生成
- `plans/README.md` — 完了時に plan 004 のステータス行を更新（**bump とは別の docs コミット**）

**対象外**:
- `src/middleware.ts` および Clerk を使用する各ソースファイル — コード変更は想定していない。アップグレードによりコード変更が必要になった場合、それは STOP 条件である（報告すること；広範なリファクタを独自判断で行わない）。
- Prisma、Next.js、その他無関係な依存関係。
- `js-cookie` の override（Step 3 の監査結果でバンプ後も HIGH が残る場合のみ追加 — Step 3 参照）。

## Git ワークフロー

- Branch: `advisor/004-upgrade-clerk`
- コミットスタイル: `chore(deps): upgrade @clerk/nextjs to ^7.5.x (GHSA-vqx2-fgx2-5wq9)`
- 指示がない限り push や PR は作成しないこと。

## Steps

### Step 1: バージョンをバンプして再インストール

`package.json` で `"@clerk/nextjs": "^7.0.7"` を最新の `7.x`（目標は `^7.5.0` 以降；`bun info @clerk/nextjs version` または npm view で正確な最新 7.x を確認）に変更する。その後:

```
bun install
```

**検証**: `bun install` が exit 0 で、`bun.lock` が `@clerk/nextjs` を `>= 7.2.4` のバージョンに解決していること。確認方法:
`grep -A2 '"@clerk/nextjs"' bun.lock | head`（新しいバージョンが表示されるはず）。

### Step 2: 型チェック + Clerk 関連テストの実行

**検証**:
- `bunx tsc --noEmit` → exit 0（Clerk の型による新規エラーなし）
- `bun run test -- src/middleware.test.ts` → 全件 pass
- `bun run test -- src/queries/user.test.ts` → 全件 pass（代表的な Clerk モック済みスイート）

Clerk モック済みテストがモック形状の変化により失敗した場合は、**テストのモックのみ**を新しい Clerk サーフェスに合わせて調整すること — プロダクションコードは変更しない。プロダクションコードの変更が必要な場合は STOP する。

### Step 3: 勧告が解消されたことを確認

**検証**: `bun audit` が `@clerk/nextjs` の CRITICAL GHSA-vqx2-fgx2-5wq9 をもう一覧に含まないこと。次に `js-cookie` を確認する:
- `grep -A2 'js-cookie' bun.lock | head` — `@clerk/shared` がパッチ済み `js-cookie`（勧告が修正された >3.0.5）をピンするリリースに進んでいれば、HIGH は解消している。
- **バンプ後も** `bun audit` が `js-cookie` の HIGH を示す場合**にのみ**、
  `package.json` に一時的な override を追加して再インストールする。バンプで
  解消済みなら（Clerk がパッチ済み `@clerk/shared` を引く想定どおりのケース）
  **このステップは丸ごとスキップする**。不要な override は、上流が本来自由に
  進められる推移的依存をピン留めし、将来のパッチを黙って止めてしまう。

  必要な場合は、キャレット範囲ではなく勧告が名指しするパッチ済みバージョンを
  正確にピンすること。

  > **`package.json` には既に `overrides` が存在する。新規キーとして追加せず、
  > 既存オブジェクトへ *マージ* すること。** 現行は `@types/react` / `@types/react-dom`
  > の React 19 ピン（`package.json:140-143`）が入っており、`"overrides": { … }` を
  > もう一つ書くと JSON の重複キーとなって**後勝ちで React の型ピンが消える**
  > （型エラーが大量に出るまで気付けない壊れ方をする）。

  ```json
  "overrides": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "js-cookie": "3.0.6"
  }
  ```

  （`3.0.6` は、勧告が修正版として挙げている正確なバージョンに置き換えること。
  既存 2 キーは**現物を確認してから**書き写すこと — 上記は 2026-07-27 時点の値であり、
  ドリフトしている場合は現物を正とする。）`bun install` 後に `bun audit` を再実行する。
  Clerk を壊さずに解決できない場合は STOP して報告すること — Clerk を強制的に
  ダウングレードしない。

  **撤去条件（この override は恒久的なものではない）**: 上流の `@clerk/shared` が
  パッチ済み `js-cookie` を引くリリースへ進んだ時点で、`js-cookie` の行だけを削除し、
  `bun install && bun audit` で HIGH が再出現しないことを確認する。一時 override を
  放置すると、上流が本来自由に進められる推移的依存をピン留めし続けることになる
  （下の「訂正」が述べている、override を*正確な単一バージョン*にする理由と同じ動機）。

  > **訂正（2026-07-18）**: 以前の版はこの正確なピンの根拠を「`^3.0.5` のような
  > 範囲は脆弱な `3.0.5` に解決されたままとなる」と説明していたが、これは
  > キャレット範囲の挙動として**誤り**である。`^3.0.5` は `>=3.0.5 <4.0.0` を
  > 意味し、新規解決では最新の `3.x`（＝パッチ済みリリース）が選ばれる。
  > 指示（正確にピンする）自体は変わらないが、根拠は別にある: 範囲指定では
  > パッチ済みバージョンが**保証されない**（`bun.lock` に既に条件を満たす古い
  > エントリがあればそのまま残り、再インストール後も audit が失敗しうる）こと、
  > および override は「既知の良好な単一バージョン」を一時的かつ監査可能に
  > 宣言する手段であり、浮動範囲にすると後からその override がまだ効いているのか
  > 判別できなくなること。

### Step 4: 完全なテスト + lint

**検証**:
- `bun run test` → 全件 pass（フルユニットスイート；他所で Clerk モックの回帰がないことを確認）
- `bun run lint` → exit 0

### Step 5: 手動での保護ルートスモークテスト（報告のみ）

このステップは executor のサンドボックスでは完全には自動化できない。レビュアー向けに文書化すること: 開発サーバーを起動した状態（`bun run dev`）で、**未認証**の `/dashboard` へのリクエストは sign-in へリダイレクトされ（dashboard シェルを描画しない）なければならない。開発サーバーを実行できる場合は確認し結果を記録すること；できない場合は、この手動チェックが保留中であることをレポートに記録すること。

## Test plan

- 新規の自動テストは厳密には不要（これはバージョンバンプ）だが、既存の `src/middleware.test.ts` と Clerk モック済み query スイートが回帰ゲートであり、green を維持しなければならない。
- Clerk モックの変更が必要だった場合、コミット本文にどのモックをなぜ変更したか正確に記す。
- 検証: `bun run test` が全件 pass；`bun audit` の CRITICAL が解消。

## Done criteria

以下すべてを満たすこと:

- [ ] `package.json` が `@clerk/nextjs` を `>= 7.2.4`（**本プランの目標値**。目標 `^7.5.x`）で示している
- [ ] `bun.lock` が `@clerk/nextjs` を `>= 7.2.4`（**本プランの目標値**）に解決している

  > **`7.2.4` は本プランの目標値であって、CRITICAL 勧告の修正版ではない。**
  > GHSA-vqx2-fgx2-5wq9 の 7 系修正版は **`7.2.1`**（影響レンジ `>=7.0.0 <7.2.1`）。
  > 7.2.4 を目標に置いているのは、推移的 HIGH の `js-cookie` も同時に解消したいという
  > **本プラン都合**による上乗せである。両者を混同して「勧告の修正版は 7.2.4」と
  > 書かないこと。勧告レンジの単一の出典は
  > [`plans/audit/findings-06-dependencies.md`](../audit/findings-06-dependencies.md)
  > （同一 GHSA でもメジャー系列ごとにレンジが違う — 6 系は `<6.39.2`、5 系は `<5.7.6`）。
  > なお `js-cookie` は `@clerk/nextjs` のバージョン単独では決まらないため、
  > `bun.lock` の解決結果を**独立に**確認すること。
- [ ] `bun audit` が `@clerk/nextjs` の GHSA-vqx2-fgx2-5wq9 をもう報告しない
- [ ] `bunx tsc --noEmit` が exit 0
- [ ] `bun run test` が exit 0（フルユニットスイート green）
- [ ] `bun run lint` が exit 0
- [ ] `src/` 配下のソースファイルが一切変更されていない — **bump コミットの直前**で `git status` が `package.json` + `bun.lock` のみ（モックが変更された場合はテストモックファイルも）を示す
- [ ] `plans/README.md` の 004 のステータス行が更新されている — bump コミットの後、**別の docs コミット**で

## STOP conditions

以下に該当する場合は停止して報告すること:

- アップグレードが `src/` 配下のプロダクションファイルの変更を要求する（7.0 とターゲットの間の実際の破壊的変更）— ファイルとエラーを報告する；広範な移行を試みない。
- `bun install` が peer の解決に失敗する（例: Next.js のバンプを要求する）— peer 競合を報告する。
- `bun audit` が `js-cookie` の HIGH の残存を示し、クリーンな override で解決できない — 報告する；Clerk をダウングレードしない。
- 複数の Clerk モック済みテストが、単なるモック形状の調整ではなく実際の API 変更を示唆する形で失敗する。

## Maintenance notes

- `@clerk/testing` は `@clerk/nextjs` のメジャーと互換に保つこと；peer 範囲が要求する場合のみバンプする。
- Clerk が示唆している `middleware`→`proxy` への移行に注意すること — リポジトリには、Clerk が `proxy.ts` を公式サポートするまで `src/middleware.ts` をリネーム**しない**という文書化された決定がある（`.claude/steering/tech.md`）。この非推奨警告に対してここで対応しないこと。
- レビュアーは diff がバージョンのみ（+ lockfile）であること、未認証の `/dashboard` への手動スモークが実施されたか明示的に保留フラグが立てられていることを確認すること。
- 先送り: Prisma 5→6 のメジャーラグ（DEPS-04）は別の、より大きなアップグレードである — このセキュリティバンプに同梱しないこと。

### 解消状況（2026-07-18 検証）

本プランは **DONE** であり、**両勧告とも現行ツリーで解消済み**。上記の
「Why this matters」「Current state」は commit `f9752c0` 時点のツリーを
記述した履歴記録であり、現状として読まないこと:

| 項目 | 計画時（`f9752c0`） | 現行ツリー |
|---|---|---|
| `@clerk/nextjs` | `^7.0.7` → `7.0.7` に解決（GHSA-vqx2-fgx2-5wq9 の影響範囲 `>=7.0.0 <7.2.1` 内） | `^7.5.0` — 影響範囲外 |
| `@clerk/testing` | `^2.0.7` | `^2.2.9` |
| `js-cookie`（推移的） | `@clerk/shared` 経由の `3.0.5`（HIGH） | `@clerk/shared@4.25.4` 経由の `3.0.7` |

したがって **`js-cookie` の override は不要**であり、追加すべきでもない。
Clerk のバンプがパッチ済み `@clerk/shared` を引いた形で、これは Step 3 が
想定していた結末そのものである。Step 3 の override ブロックは実行すべき
手順ではなく、条件付きの待避策として残る。

その後の Clerk 関連作業: `plans/057` は `next` のバンプであり Clerk では
ない。上記の `middleware`→`proxy` 非推奨は `.claude/steering/tech.md` の
決定により意図的に未対応のまま。
