# プラン 011: オンボーディング修正 — stale な画面ドキュメントの退役、README の env リスト補完、`.env.example` の追加

> 原本: [../011-onboarding-docs-env-and-stale-plan.md](../011-onboarding-docs-env-and-stale-plan.md)

> **Executor 向け指示**: このプランを順番どおりに実行すること。各検証コマンドを実行し、
> 次に進む前に期待結果を確認する。「STOP conditions」に該当する事象が起きたら、
> 停止して報告すること — 独自判断で進めない。完了したら `plans/README.md` の
> このプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**: `git diff --stat f9752c0..HEAD -- README.md docs/unimplemented-screens-plan.md .env.docker.example .gitignore`
> 対象ファイルのいずれかがこのプラン作成後に変更されていれば、「Current state」の
> 抜粋を実コードと比較すること。不一致があれば STOP。

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `f9752c0`, 2026-07-03

## なぜ重要か

3つのオンボーディング/ドキュメント上の欠陥。すべてドキュメントのみ（コードリスクなし）:

1. **積極的に誤っているドキュメント**: `docs/unimplemented-screens-plan.md` は約19ルートを未実装として列挙しているが、**そのすべてが今や存在する**（admin orders/coupons、seller inventory、dashboard トップ群、profile settings/messages、track-order、support-forms、offers、compare、静的ページ群）。ロードマップ/direction のソースとして引用されているため、読者は既に出荷済みの作業をスケジュールしてしまう。埋め込まれた Gantt の日付も過去のものである。
2. **不完全な README の env リスト**: README のセットアップブロックは9個の環境変数を文書化しているが、実際にコードが読んでいるいくつかを省略している — README に従う新規開発者は、シグナルもなく部分的にしか起動しないアプリ（壊れた Cloudinary アップロード、検証不能な Stripe webhook）を手にすることになる。
3. **`.env.example` の欠如**: `.gitignore` は `!.env.example` をホワイトリストしており存在が期待されていることを示唆するが、実際には（コンテナ志向の）`.env.docker.example` と `.env.test.example` しか存在しない — bare-metal で `bun run dev` するコントリビューターにはコピーすべきテンプレートが無い。

## Current state

### Stale なドキュメント

`docs/unimplemented-screens-plan.md` は冒頭で画面が「ディレクトリ未作成 / プレースホルダー」であると主張し、`/dashboard/admin`、`/dashboard/admin/orders`、`/dashboard/admin/coupons` のようなルートを表にしている。これらはすべて今や `src/app/` 配下に実体のある `page.tsx` ファイルを持つ（監査時に確認済み）。有効なエントリは1つも残っていない。

### README の env ブロック、`README.md:486-495`

```env
DATABASE_URL=                    # Prisma Accelerate 接続 URL
DIRECT_URL=                      # マイグレーション用の直接 PostgreSQL URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
WEBHOOK_SECRET=                  # Clerk Webhook 署名
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=
PAYPAL_SECRET=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
```

`src/` で実際に参照されている env 変数**名**（`grep -rho 'process\.env\.[A-Z_][A-Z0-9_]*' src/ | sort -u` から、放棄済みの Elasticsearch 経路を除く）:

```
IPINFO_TOKEN
NEXT_PUBLIC_PAYPAL_CLIENT_ID
NEXT_PUBLIC_STRIPE_PUBLIC_KEY
PAYPAL_API_BASE
PAYPAL_SECRET
PAYPAL_WEBHOOK_ID
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
WEBHOOK_SECRET
```

加えて、直接の `process.env` ではなくライブラリ設定経由で使われる変数（`.env.docker.example` に存在）: Clerk の publishable/secret キー、Clerk の sign-in/up URL 変数、`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`、`NEXT_PUBLIC_CLOUDINARY_PRESET_NAME`、`NEXT_PUBLIC_APP_URL`。**変数名の権威的な superset として `.env.docker.example` を使う**こと（Docker 固有のホスト名は除く）。

> **Clerk の URL 変数 — 扱いを 1 つに統一すること。** `NEXT_PUBLIC_CLERK_SIGN_IN_URL`、
> `NEXT_PUBLIC_CLERK_SIGN_UP_URL`、`NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
> （`.env.docker.example:26-28`）は**任意**である: `src/` はこれらを一切読まない
> （`grep -rn 'CLERK_SIGN_IN_URL\|CLERK_SIGN_UP_URL\|AFTER_SIGN_IN' src/` → 0 件）。
> Clerk がライブラリ設定として消費し、未設定なら Clerk 自身の既定値にフォールバックする。
> ただし本リポジトリは `src/app/(auth)/sign-in`・`sign-up` に**カスタム**認証ページを持つため、
> 値は任意ではなく確定しており、`.env.example` に載せる価値がある。
>
> 本プラン内の**3 箇所すべてで「既定値ありの任意」として統一**すること: 上の superset、
> 下の「README に不足している」リスト（**載せない** — あちらはコードが必須とする変数のためのもの）、
> Step 2 の `.env.example` テンプレート（本リポジトリの実値を入れて任意と明記して**載せる**）。
> superset を「必須」と呼びながらテンプレートでは「必要に応じて」とコメントアウトする、という
> 現状の不一致を解消するための注記である。`AFTER_SIGN_IN_URL` も他の 2 つと並べて記載すること
> （兄弟変数だけ載せて 1 つ落とすのは同じ欠陥）。

コードが必要としているが README に無いもの: **`STRIPE_WEBHOOK_SECRET`**、**`PAYPAL_API_BASE`**、**`PAYPAL_WEBHOOK_ID`**、**`IPINFO_TOKEN`**、**`NEXT_PUBLIC_APP_URL`**、そして **`NEXT_PUBLIC_CLOUDINARY_*`** のペア（README は Cloudinary を前提条件として挙げているにも関わらず、その変数を省略している）。

### `.env.example`

存在しない。`.gitignore:37` はそれをホワイトリストしている（`!.env.example`）。`.env.docker.example`（2718 B）と `.env.test.example`（2018 B）は存在する。

### 規約（documentation-guide）

- stale なドキュメントは削除またはアーカイブすべき（`.claude/steering/documentation-guide.md` — 「古い情報の放置」がアンチパターンとして挙げられている）。真に未解決の作業は stale なプランドキュメントではなく `specs/.../08-open-questions.md` に入れる。
- **シークレットの規則（厳格）**: 変数**名**のみを参照する。いかなる `.env*` ファイルからも実際の**シークレット**値を README や `.env.example` にコピーしないこと。シークレット/環境依存値は空欄、**非シークレットのルーティング/エンドポイント既定値は例外**。具体的には `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` 系と **`PAYPAL_API_BASE=https://api-m.sandbox.paypal.com`**（sandbox の base URL はシークレットではない）は、README ブロックと `.env.example` の**両方**で同じリテラル既定値を持つ（空欄にしない）。ルール＝「値を一切書かない」ではなく「シークレットを書かない」。EN 版 `plans/011` の "Empty-value vs literal-value policy" と同一分類。

## 必要なコマンド

| 目的        | コマンド                                        | 期待結果            |
|----------------|------------------------------------------------|---------------------|
| Env 名の差分  | `grep -rho 'process\.env\.[A-Z_][A-Z0-9_]*' src/ \| sort -u` | 名前のリスト |
| Example の確認 | `git check-ignore .env.example`                | 何も出力しない（ホワイトリスト済み、track される） |

（ビルド/テストゲートなし — このプランはドキュメントとテンプレートファイルのみを変更する。）

## Scope

**対象内**:
- `docs/unimplemented-screens-plan.md` — 削除またはアーカイブ
- `README.md` — env 変数ブロックを補完
- `.env.example`（新規作成）— 名前 + 空/プレースホルダー値のテンプレート

**対象外**:
- 既存の任意のソースファイル、既存の任意の `.env*` ファイル（`.env.docker.example` / `.env.test.example` は編集しないこと）。
- Elasticsearch の env 変数（`ELASTICSEARCH_*`）— 放棄済み経路；オンボーディングドキュメントに追加しないこと。
- `specs/` の内容。ただし真に未解決の項目をそこへ移す場合を除く（そのような項目があればの話；監査では未解決のものは見つからなかった）。

## Git ワークフロー

- Branch: `advisor/011-onboarding-docs`
- コミットスタイル: 例 `docs: retire stale screens plan; complete env docs; add .env.example`
- 指示がない限り push や PR は作成しないこと。

## Steps

### Step 1: stale な画面ドキュメントを退役させる

推奨: 履歴/文脈が見えるよう、完全削除ではなくアーカイブする。無ければ `docs/archive/` を作成し、ヘッダーを冠してファイルを移動する:

```markdown
> **SUPERSEDED (2026-07): すべての画面は実装済み。** この計画書に列挙された未実装画面
> （admin orders/coupons、seller inventory、dashboard トップ、profile settings/messages、
> track-order、support-forms、offers、compare、静的ページ群）は 2026-06 までに実装された。
> 未解決の作業がある場合は specs/multi-vendor-ecommerce/08-open-questions.md を参照。
```

次に `git mv docs/unimplemented-screens-plan.md docs/archive/unimplemented-screens-plan.md`（チームが削除を好む場合は `git rm` でも可 — アーカイブがより安全なデフォルト）。

移動後、旧パスにリンクしている他のドキュメントを更新する:
`grep -rn "unimplemented-screens-plan" . --include="*.md" | grep -v node_modules` — direction のソースとして引用している recon/roadmap ドキュメント等、各参照を修正または削除する。

**参照は 2 つの表記形で書かれている。両方を更新すること**（監査時点の実測）:

| 表記形 | 例 | 更新後 |
|---|---|---|
| リポジトリルート起点 | `docs/unimplemented-screens-plan.md` | `docs/archive/unimplemented-screens-plan.md` |
| 相対リンク | `../../unimplemented-screens-plan.md` | `../../archive/unimplemented-screens-plan.md` |

相対リンク形は `docs/design/*/README.md` の **9 ファイル**（`offers` / `admin-dashboard` /
`profile-settings` / `track-order` / `storefront-static-pages` / `compare` / `profile-messages` /
`support-forms` / `seller-dashboard`）にある。`docs/` 起点の grep しか掛けないとここを取りこぼす。

> **手で選んだサブセットではなく、リポジトリ全体を検索すること。** 本ステップの旧版は
> `docs/ README.md .claude/ specs/` の 4 箇所しか走査しておらず、これは**下の「検証」コマンドより
> 狭い**。そのため 4 箇所の外にある参照は修正を免れたままゲートだけが落ちる。これは仮定の話ではない:
> `plans/` だけで約 15 件（`plans/ADVISOR_STATE.md`・`plans/audit/recon.md`・
> `plans/audit/findings-07-dx-docs.md`・`plans/audit/VETTED_FINDINGS.md`・本プランの EN/ja 自身）、
> `docs/design/*/README.md` にさらに約 11 件ある。修正の範囲と検証の範囲を一致させること。
>
> `plans/audit/findings-*` と本プラン自身の参照は**残ってよい** — 監査自身の証跡として当該ファイルを
> 引用しているため。削除ではなく新しいアーカイブパスへ向け直すこと。下の検証コマンドはそれを許容する
> （**旧**パスへの生きた参照が無いことだけを要求する）。

**検証**:

```bash
# 本プラン自身（旧トークンを「旧 → archive/ へ移動」の移行例として引用している）と
# plans/audit/*（監査証跡）は **走査対象から除外**する。これらは上の但し書きで
# 「残ってよい」参照であり、走査に含めると本文中の旧トークン例示に常にヒットして
# ゲートが構造的に永久失敗する（＝誤検出）。除外は grep -r の段階で行う
# （-h でファイル名が落ちるため、抽出後にファイル単位で弾けない）。
grep -rhoE "[^ )\"'\`]*unimplemented-screens-plan[^ )\"'\`]*" . --include="*.md" \
  --exclude="011-onboarding-docs-env-and-stale-plan.md" \
  --exclude-dir="audit" \
  | grep -v "node_modules" \
  | grep -vE "(^|/)archive/unimplemented-screens-plan" \
  || true
# ↑ 末尾の `|| true` が無いと、成功ケース（ヒット 0 件 = 旧パス参照なし）で
#   末尾の `grep -v` が「出力行ゼロ」により **exit 1** を返し、exit code を見る
#   CI ゲートが誤って失敗する。合否は「出力された行の有無」で判断すること
#   （0 行＝pass）。exit code を合否に使うなら次段の判定形にする。
```

→ **ヒット 0 件**（＝出力が空）なら pass。ヒットが 1 件でもあれば、それは（本プラン・
監査証跡を除いた）**旧パスへの生きた参照**である。exit code ではなく**出力行の有無**で
判定すること（上記のとおり成功ケースでも末尾 `grep` は exit 1 を返しうる）。

**（補助）監査ディレクトリ専用スキャン**: 上のメインゲートは `--exclude-dir="audit"` で
`plans/audit/*` を**丸ごと**外すが、前段の但し書きは「監査証跡の参照も新しいアーカイブパスへ
**向け直す**」ことを求めている。ディレクトリごと除外すると、audit 内に残った**旧パスの
生きた参照**（＝アーカイブパスへ向いていない参照）を取りこぼす。そこで audit だけを対象に、
**アーカイブパスに向いていない**旧トークン参照を洗い出す（ゲートは**落とさず**目視レビュー用に
一覧化する）:

```bash
# audit 配下のみ。archive/ へ向いている参照は「向け直し済み」として除外し、
# 残り（= 旧パスのままの参照）を列挙する。0 行なら向け直し完了。
grep -rnoE "[^ )\"'\`]*unimplemented-screens-plan[^ )\"'\`]*" plans/audit --include="*.md" \
  | grep -vE "(^|/)archive/unimplemented-screens-plan" \
  || true
# 出力された各行は「意図的な履歴引用（旧トークンをそのまま示す例）」か
# 「向け直し漏れ」のどちらか。前者なら残置可・後者は archive パスへ修正する
# （メインゲートとは別に人間が判断する。ここで機械的に fail はさせない）。
```

> **除外は `docs/archive` ではなく `archive/unimplemented-screens-plan` で行うこと。**
> 旧版のゲートは `grep -v docs/archive` で除外していたが、これは**正しく更新した参照を
> 失敗と判定する**。上表のとおり `docs/design/*/README.md` の 9 ファイルは相対リンク形であり、
> 更新後は `../../archive/unimplemented-screens-plan.md` になる。この文字列は `archive/` を
> 含むが `docs/archive` は**含まない**ため、旧ゲートでは 9 件すべてが残存扱いになった。
> ファイル名直前のパスセグメント（`archive/`）で除外すれば、ルート起点・相対リンクの
> どちらの表記形でも正しく除外できる。
>
> この変更によりゲートは**二値判定**になる。旧版の「または残る全参照が新しいアーカイブパスを
> 指す」という但し書きは、コマンド単体では真偽を決められず人間の目視判断を要求していたため削除した。
>
> **行単位ではなく出現単位で照合する。** 行志向の `grep -v`（`grep "…" | grep -v "archive/…"`）は
> アーカイブ文字列を含む**行全体**を落とすため、**旧新両方のパス**を書いた行（例: 「旧
> `unimplemented-screens-plan.md` から `archive/unimplemented-screens-plan.md` へ移動」）に潜む
> 旧参照を見逃す。上記の `grep -oE` は各パストークンを個別に抽出するので、旧パストークンが
> `archive/` 除外を生き延び、ゲートが取りこぼさない。

### Step 2: README の env ブロックを補完する

`README.md:486-495` の env ブロックを、完全なセット（名前 + 空値、グループ化）に置換する。`.env.docker.example` を superset として使い、コンテナのホスト名を取り除く。目標形状:

```env
# --- Database (Prisma + Accelerate) ---
DATABASE_URL=
DIRECT_URL=

# --- Clerk (auth) ---
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
WEBHOOK_SECRET=                     # Clerk Webhook 署名 (Svix)
# 任意 (未設定なら Clerk の既定値)。src/ は参照せず Clerk がライブラリ設定として読む。
# 本リポジトリは src/app/(auth)/ にカスタム認証ページを持つため、既定値ではなく下記の値を使う。
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/

# --- Stripe ---
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=
STRIPE_WEBHOOK_SECRET=              # Stripe Webhook 署名検証

# --- PayPal ---
PAYPAL_SECRET=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
PAYPAL_API_BASE=                    # 例: https://api-m.sandbox.paypal.com
PAYPAL_WEBHOOK_ID=

# --- Cloudinary (画像) ---
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_PRESET_NAME=

# --- その他 ---
IPINFO_TOKEN=                       # 地域判定 (userCountry)
NEXT_PUBLIC_APP_URL=                # 例: http://localhost:3000
```

実際の env 名 grep + `.env.docker.example` と突合し、必要なものが欠けておらず放棄済み（Elasticsearch）のものが追加されていないことを確認する。名前/プレースホルダーのみ — 実際の値は入れない。

**検証**: `grep -rho 'process\.env\.[A-Z_][A-Z0-9_]*' src/ | sort -u`（`ELASTICSEARCH_*`、`NODE_ENV`、`E2E_BASE_URL` を除く）の全名前が README ブロックに現れる。

### Step 3: `.env.example` を追加する

リポジトリルートに、Step 2 と同じ変数名で**空またはプレースホルダーと明確に分かる**値の `.env.example` を作成する（例: `PAYPAL_API_BASE=https://api-m.sandbox.paypal.com` は非秘密の既定値として；すべてのシークレットは空欄のまま）。名前は `.env.docker.example` から導出するが、Docker コンテナのホスト名は localhost の等価物に置き換え、すべての認証情報を空欄にする。

**検証**: `git check-ignore .env.example` が何も出力しない（ホワイトリストされ track される）；ファイルを開いて実際のシークレット値が含まれていないことを確認する（すべてのキーが空欄か非秘密のプレースホルダー）。

### Step 4: README のセットアップ節から `.env.example` を参照する

README のセットアップ手順に、bare-metal ユーザーをそこへ導く1行を追加する。例: `cp .env.example .env.local`（リポジトリの env ファイル規約に合わせる — `.gitignore` は `.env*.local` を無視するため、`.env.local` がローカルオーバーライドの対象になる）。

**検証**: `grep -n ".env.example" README.md` → 参照が表示される。

## Test plan

- 自動テストなし（ドキュメント + テンプレートのみ）。検証は各ステップの grep チェックと、README や `.env.example` にシークレット値が漏れていないことを確認する手動読み合わせ。

## Done criteria

以下すべてを満たすこと:

- [ ] `docs/unimplemented-screens-plan.md` が（SUPERSEDED ヘッダー付きで `docs/archive/` へ移動して）アーカイブされている、または削除されており、生きたドキュメントが旧パスにリンクしていない
- [ ] README の env ブロックが、`STRIPE_WEBHOOK_SECRET`、`PAYPAL_API_BASE`、`PAYPAL_WEBHOOK_ID`、`IPINFO_TOKEN`、`NEXT_PUBLIC_APP_URL`、`NEXT_PUBLIC_CLOUDINARY_*` を含む、ソース参照済みの全変数を列挙している
- [ ] `.env.example` がリポジトリルートに存在し、git で track 可能であり（`git check-ignore` が何も出力しない）、**実際のシークレット値を含まない**
- [ ] README がセットアップ手順内で `.env.example` を参照している
- [ ] ソースファイルや既存の `.env*.example` ファイルが変更されていない（`git status`）
- [ ] `plans/README.md` の 011 のステータス行が更新されている

## STOP conditions

以下に該当する場合は停止して報告すること:

- 「Current state」の抜粋のいずれかが実ファイルと一致しない（ドリフト）— 例えば README の env ブロックや `.env.docker.example` が既に更新されている。
- `docs/unimplemented-screens-plan.md` 内に真にまだ未実装のルートを見つけた（監査と矛盾する）— ドキュメントを削除**しない**こと；どのルートかを報告し、代わりに `08-open-questions.md` へ移せるようにする。
- `git check-ignore .env.example` がそれが ignore されることを示す（ホワイトリストが機能していない）— 報告する；force-add しないこと。
- 既存の `.env*` ファイルにコピーしたくなる実際の認証情報が含まれている — 値は絶対にコピーしないこと；空のプレースホルダーを使いその旨を記録する。

## Maintenance notes

- README の env ブロックと `.env.example` を `.env.docker.example` と同期させ続けること；理想的には将来の CI チェックが `process.env.*` の名前をテンプレートと突き合わせて再ドリフトを防ぐ（将来的な DX タスクの候補）。
- レビュアーは README の diff と `.env.example` に誤って貼り付けられたシークレット値がないか（名前/プレースホルダーのみであること）を確認すること。
- Elasticsearch がいつか復活する場合（現在コメントアウト中）、その時に変数を追加すること — 今ではない。
