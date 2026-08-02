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
> ただし値自体は本リポジトリで確定しているため、`.env.example` に載せる価値がある。
> **確定の理由は「カスタム認証ページがあるから」ではない**（後述の「訂正」節を参照）——
> 本リポジトリのカスタムページは `/sign-in` / `/sign-up` に解決され、これは **Clerk の既定値
> そのもの**であり、`AFTER_SIGN_IN_URL=/` も既定値。空欄でも認証は壊れない。
> リテラル値でピンする理由は**防御的**なもので、Clerk 側の既定値が将来変わっても認証の経路が
> 黙って変わらないよう、リポジトリ側で契約を固定するためである。
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
# ゲートが構造的に永久失敗する（＝誤検出）。
#
# `-h` ではなく `-n` を使う: 除外を**パス単位**で判定するためファイル名を残す必要がある。
# `--exclude=` は**ベース名**マッチのため、`--exclude="011-…​.md"` は
# `plans/ja/011-…​.md` まで巻き添えで除外し、ja 側に残った旧パス参照を隠してしまう。
# **走査そのものの失敗を PASS に変換しないこと。** grep をパイプへ直結して出力行の
# 有無だけを見る形だと、走査に失敗して 0 行になった状態が「違反なし」= PASS になる。
# ゲートの状態は 2 値ではなく 3 値（合格 / 違反 / **判定不能**）。素の grep を先に
# 変数へ取り、ステータスを見てから絞り込みへ進む。
raw=$(grep -rnoE "[^ )\"'\`]*unimplemented-screens-plan[^ )\"'\`]*" . --include="*.md")
status=$?

# grep の終了ステータスは 0=一致あり / 1=一致なし / **2 以上=走査エラー**。
if [ "$status" -ge 2 ]; then
  echo "ERROR: 走査に失敗した（grep exit $status）。合否は判定不能" >&2
  exit 2
fi

# **exit code だけでは足りない。** 実装ごとに契約が違う（実測 2026-08-01・macOS 26）:
#
#   | 事象 | BSD grep 2.6.0-FreeBSD (/usr/bin/grep) | ugrep 7.5.0 |
#   |---|---|---|
#   | 走査対象が存在しない | **1**（＝「一致なし」と区別できない） | 2 |
#   | 読めないディレクトリ | 2 | 2 |
#   | 不正な正規表現 | 2 | 2 |
#
# 1 行目が問題で、パスを間違えただけのゲートが BSD grep では静かに PASS する。
# そこで**陽性対照**を置く: 本プラン自身は旧トークンを「旧 → archive/ へ移動」の
# 移行例として**必ず含む**（上の但し書きで「残ってよい」と決めた参照）。それが
# `$raw` に無いなら、走査は対象へ届いていない。plan 042 の「空抽出を PASS に
# しないこと」と同じ原則を、走査側に適用したもの。
if ! printf '%s\n' "$raw" | grep -q "011-onboarding-docs-env-and-stale-plan\.md:"; then
  echo "ERROR: 陽性対照（本プラン自身の旧トークン）が 1 件も検出されなかった。" >&2
  echo "  走査がリポジトリルートに届いていない可能性が高い。合否は判定不能" >&2
  exit 2
fi

leftovers=$(
  printf '%s\n' "$raw" \
    | grep -v "/node_modules/" \
    | grep -vE "^(\./)?plans/(ja/)?011-onboarding-docs-env-and-stale-plan\.md:" \
    | grep -vE "^(\./)?plans/audit/" \
    | awk '{ tok = $0; sub(/^[^:]*:[0-9]+:/, "", tok);
             if (index(tok, "archive/unimplemented-screens-plan") == 0) print }'
)
if [ -n "$leftovers" ]; then
  printf '%s\n' "$leftovers"
  echo "FAIL: 旧パスへの生きた参照が残っている"
  exit 1
fi
echo "PASS: 旧パスへの生きた参照なし"
```

→ **ヒット 0 件（＝ exit 0）** なら pass。ヒットが 1 件でもあれば、それは（本プラン・その ja 版・
監査証跡を除いた）**旧パスへの生きた参照**であり、ゲートは **exit 1** を返す。
走査自体が失敗した場合は **exit 2**（判定不能）で、pass とも fail とも扱わない。

> **実測（2026-08-01・4 方向 × 2 実装）**: 違反なし = **exit 0** / 生きた違反あり = **exit 1** /
> 存在しないパスを走査 = **exit 2**（`/usr/bin/grep` = BSD grep 2.6.0-FreeBSD と ugrep 7.5.0 の
> **両方**で 2）。BSD grep はこのケースで grep 自体は **1** を返すため、`status -ge 2` の検査
> だけでは素通りする —— **陽性対照が捕まえている**。陽性対照を外した版では BSD grep で
> `PASS` / exit 0 になることも実測済みで、これが「検索エラーを PASS に変換する」当のケース。
>
> **旧版の `|| true` は撤去した。** 旧版は末尾に `|| true` を置き「合否は exit code ではなく
> 出力行の有無で判断せよ」と注記していたが、それでは**コマンド単体を CI ゲートにできない**
> （常に exit 0 になるため、旧パス参照が残っていても CI は緑になる）。`|| true` が必要だったのは
> 「ヒット 0 件のとき末尾の `grep -v` が exit 1 を返す」ためだが、その問題は結果を変数へ束ねて
> `[ -n "$leftovers" ]` で判定すれば消える。上の形は **成功 = exit 0 / 失敗 = exit 1** を満たし、
> 出力行の有無と exit code が一致する。

**（補助）監査ディレクトリ専用ゲート**: 上のメインゲートは `grep -vE "^(\./)?plans/audit/"` で
`plans/audit/*` を**丸ごと**外すが、前段の但し書きは「監査証跡の参照も新しいアーカイブパスへ
**向け直す**」ことを求めている。ディレクトリごと除外すると、audit 内に残った**旧パスの
生きた参照**（＝アーカイブパスへ向いていない参照）を取りこぼす。

ただし audit 配下では、メインゲートの「生きた参照」定義をそのまま適用できない。監査証跡は
**当時の観測をそのまま引用する**文書であり、「`docs/unimplemented-screens-plan.md` は stale
だった」のような散文・インラインコード中の旧トークンは、**向け直してはならない歴史的記述**
だからである（向け直すと「当時 audit が何を見たか」が改竄される）。そこで audit 用には
「生きた参照」を **Markdown リンク形（`](…)`）に限定**して精緻化し、その形に対してのみ
fail-closed ゲートを掛ける:

```bash
# audit 配下の「リンク形の旧パス参照」のみを対象にする fail-closed ゲート。
# 散文・インラインコード（`docs/unimplemented-screens-plan.md`）中の歴史引用は
# リンクではないため対象外 —— 監査証跡は当時の観測を保存する文書であり、
# 向け直すと記録として成立しなくなる。リンクは「今クリックして辿る参照」なので
# 壊れたままにできない、という線でメインゲートと定義を揃えている。
#
# ① 検索できなかったことを「ヒット 0 件」と取り違えないこと。
#    `audit_links` が空になる理由は「旧パス参照が無い」だけではなく
#    「対象が存在しない / 読めない」でもありうる。後者を PASS に変換すると、
#    ディレクトリ改名や実行位置の取り違えでゲートが**恒久的に緑**になる。
#    **exit code だけでは足りない**: GNU grep は読み取りエラーで 2 を返すが、
#    **BSD grep（macOS 既定）は存在しないパスに対して 1 を返し**「不一致」と
#    区別できない（実測: `/usr/bin/grep -r … plans/does-not-exist` → exit 1）。
#    そこで対象の存在を先に assert し、exit code 検査はその補強として併用する。
[ -d plans/audit ] || {
  echo "FAIL: plans/audit が存在しない（検索できていないので判定不能）"; exit 1;
}

audit_raw=$(grep -rnoE '\]\([^)]*unimplemented-screens-plan[^)]*\)' plans/audit --include="*.md")
status=$?
[ "$status" -le 1 ] || {
  echo "FAIL: 旧パス参照の検索自体が失敗した (grep exit $status)"; exit 1;
}

# ② 除外は**トークンに対して**掛けること。`grep -rno` の出力は `path:line:token` なので、
#    行全体に `grep -vE "(^|/)archive/…"` を掛けると**ファイルのパス側**が条件を満たし、
#    生きた旧パス参照が黙って落ちる（同じ欠陥と実測は plans/011 の補助ゲート参照）。
audit_links=$(printf '%s' "$audit_raw" | awk 'NF { tok = $0; sub(/^[^:]*:[0-9]+:/, "", tok);
    if (tok !~ /(^|\/)archive\/unimplemented-screens-plan/) print }')

if [ -n "$audit_links" ]; then
  printf '%s\n' "$audit_links"
  echo "FAIL: plans/audit にリンク形の旧パス参照が残っている"
  exit 1
fi
echo "PASS: plans/audit にリンク形の旧パス参照なし"
```

> **実測（2026-08-01・四方向）**: 現行 `plans/audit` → `PASS` / exit 0、
> 存在しないディレクトリ → `FAIL: … 存在しない` / exit 1（**旧形は `PASS` / exit 0**）、
> リンク形の旧パス参照を注入 → `FAIL` / exit 1、
> `docs/archive/…` へ再ポイント済みのリンクのみ → `PASS` / exit 0。

**（別掲・advisory）列挙用コマンド**: リンク形以外も含めた全出現を一覧するには次を使う。
これは**ゲートではない**（常に exit 0）。人間が「歴史引用として残置してよいか」を判断する
ための材料であり、CI には接続しない:

```bash
# 常に exit 0。合否ではなく棚卸しのための一覧。
grep -rnoE "[^ )\"'\`]*unimplemented-screens-plan[^ )\"'\`]*" plans/audit --include="*.md" \
  | grep -vE "(^|/)archive/unimplemented-screens-plan" \
  || true
```

> **実測（2026-07-30）**: advisory 側は **3 ファイル 6 箇所**がヒットする
> （`plans/audit/recon.md:146,154` / `plans/audit/findings-07-dx-docs.md:14,16` /
> `plans/audit/VETTED_FINDINGS.md:66` ×2）。6 箇所すべてが**インラインコードまたは見出し中の
> 散文**であり、Markdown リンクは 1 件も無い。したがって上の fail-closed ゲートは現時点で
> **PASS（exit 0）** であり、リンク形の旧参照を 1 件注入すれば **exit 1** になる
> ——合格・不合格の両方向を実行して確認済み。
>
> **旧版の `|| true` 単独形はゲートとして採らない。** 旧版はこの補助スキャンを `|| true` で
> 閉じ「人間が目視で判断する」と注記していたが、それは**メインゲートと同じ fail-open の穴**を
> audit 配下にだけ残すことになる（Step 1 冒頭で `|| true` を撤去した理由と同一）。
> 「機械判定できる部分（リンク形）はゲートにし、判定できない部分（歴史引用）は
> advisory として別掲する」形に分離すれば、両者を取り違えずに済む。
>
> **除外はベース名ではなくパスで行うこと。** `grep --exclude=` は**ベース名**マッチのため、
> 旧版の `--exclude="011-onboarding-docs-env-and-stale-plan.md"` は `plans/011-…​.md` と
> `plans/ja/011-…​.md` の**両方**を落としていた。ja 版は翻訳であって監査証跡ではないので、
> ja 側に旧パス参照が残っていても永久に報告されない。`--exclude-dir="audit"` も同様に
> ツリー内の**任意の** `audit` ディレクトリを落とす。`-n` を保ってパス前方一致
> （`^(\./)?plans/ja/011-…`, `^(\./)?plans/audit/`）で弾けば、除外の意図がそのまま式になる。
>
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
# 下記 3 つは Clerk の既定値と同一だが、既定値の変更に依存しないよう明示的にピンする。
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

> **分類の軸は「シークレット / 非シークレット」であり、「任意 / 必須」ではない**（両者を混同しないこと）。
> シークレット・環境依存値は空欄、非シークレット設定はリテラル値を持つ（上記 `PAYPAL_API_BASE` 等）。
>
> **訂正: Clerk の URL 3 変数は「必須」ではなく「任意」。** EN 版の旧記述は「カスタム
> `src/app/(auth)/` ページがあるため既定値では動かず、空欄にすると認証が壊れる」を literal 値の
> 根拠にしていたが、**これは事実誤認**であり、env ブロック自身の「任意 (未設定なら Clerk の既定値)」
> というコメントとも矛盾していた。本リポジトリのカスタムページは `/sign-in` / `/sign-up`
> （`src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` / `…/sign-up/[[...sign-up]]/page.tsx`）に解決され、
> これは **Clerk の既定値そのもの**。`AFTER_SIGN_IN_URL=/` も既定値。空欄でも認証は壊れない。
> ピンする本当の理由は**防御的**なもの — Clerk 側の既定値が将来変わっても認証の経路が
> 黙って変わらないよう、リポジトリ側で契約を固定する。
>
> **本ファイル上流の「Clerk の URL 変数 — 扱いを 1 つに統一すること」§ も同じ誤認
> （「カスタム認証ページを持つため値は任意ではなく確定」）を含んでいたため、同時に訂正済み
> （2026-07-28）。** 訂正はこの 2 箇所で完結しており、片方だけを読んでも矛盾しない。

**検証**: README ブロックを、**本ステップが使えと指示しているのと同じ superset** と突き合わせる —
すなわち `src/` の `process.env` 参照と `.env.docker.example` の変数名の**和集合**。

`process.env` の走査だけでは不十分であり、その穴は仮定の話ではない。Clerk と Prisma は
ライブラリ内部で設定を読むため、`CLERK_SECRET_KEY` / `DATABASE_URL` / `DIRECT_URL` は
`src/` に `process.env.*` として現れない。旧走査（13 変数）では、**アプリが起動すらできない
この 3 変数を README から落としても** ゲートは PASS を出す。

> **実行シェルは bash（または zsh）必須。`sh script.sh` で走らせないこと。**
> 下のゲートは `comm -23 <(…) <(…)` の**プロセス置換**を使う。これは POSIX sh には無い
> bash/zsh 拡張であり、`[ -n … ]` 等の POSIX 風の書き方が混在しているため「sh でも動く」と
> 誤読されやすい。実際には**構文エラーで即死**する（実測 2026-07-31）:
>
> ```
> $ dash -c 'comm -23 <(printf "A\n") <(printf "B\n")'
> dash: 1: Syntax error: "(" unexpected
> $ sh   -c 'comm -23 <(printf "A\n") <(printf "B\n")'      # macOS /bin/sh = bash --posix
> sh: -c: line 0: syntax error near unexpected token `('
> $ bash -c 'comm -23 <(printf "A\n") <(printf "B\n")'      # → A（PASS）
> ```
>
> 構文エラーは**ゲート本体が走る前**に起きるため、CI で `sh` を使うと「変数の欠落を
> 検出しなかった」のではなく「検査そのものが実行されなかった」失敗になる。フェンスの
> ```` ```bash ```` 表記は shell 要求の宣言ではないので、スクリプト化する場合は
> `#!/usr/bin/env bash` を先頭に置き、CI からは `bash script.sh` で呼ぶこと。

```bash
#!/usr/bin/env bash
# 期待集合 = (src/ + ルート設定の process.env 参照) ∪ (.env.docker.example の変数名)
#
# grep のルートに next.config.mjs を含める: HSTS_* はリポジトリルートの設定ファイルで
# 読まれるため `src/` だけを見ると取りこぼす（今は除外対象だが、将来ルート設定に足された
# 変数が黙って母数から漏れるのを防ぐ）。
# 母数の入力が欠けていたら**明示的に落とす**。`grep` が対象不在で空を返しても
# `expected` は空集合になるだけで、後段の `comm -23` は「missing なし」を返し
# **PASS に化ける**（母数が空なら差集合も空）。しかも BSD grep（macOS 既定）は
# 存在しないパスに対して 1 を返し「不一致」と区別できないため、exit code 検査だけでは
# 足りない。入力ファイル / ディレクトリの存在を先に assert する。
for required in src next.config.mjs .env.docker.example README.md; do
  [ -e "$required" ] || {
    echo "FAIL: $required が無い（期待集合を組み立てられないので判定不能）"; exit 1;
  }
done

expected=$(
  {
    grep -rho 'process\.env\.[A-Z_][A-Z0-9_]*' src/ next.config.mjs | sed 's/process\.env\.//'
    grep -oE '^[A-Z_][A-Z0-9_]*=' .env.docker.example | tr -d '='
  } | sort -u | grep -vE '^(ELASTICSEARCH_[A-Z_]*|NODE_ENV|VERCEL_ENV|E2E_BASE_URL|SONAR_TOKEN|SONAR_HOST_URL|HSTS_[A-Z_]*)$'
)

# 空の期待集合は「環境変数を 1 つも使っていない」ではなく「抽出に失敗した」。
# 差集合が空 = 合格、という後段の論理が母数の空で自明に成立してしまうため、
# ここで打ち切る。
[ -n "$expected" ] || {
  echo "FAIL: 期待集合が空（process.env 参照を 1 件も抽出できていない）"; exit 1;
}

# README の env ブロックが列挙する変数名。
#
# ⚠️ `sed -n '/^```env$/,/^```$/p' README.md` を README 全体に掛けないこと。
#    それは README 内の**すべての** ```env フェンスを連結する。現在は「必要な環境変数」節に
#    1 個しか無いので偶然一致するが、Docker 用ブロック等が増えた瞬間、この検査の主張が
#    「その節との完全一致」から「全ブロックの和集合との一致」へ**黙って変質**する
#    （検査は緑のまま意味だけが変わるので気づけない）。
#    対策は 2 段構え: (1) 節見出しで範囲を切ってから拾う (2) その範囲内のフェンスが
#    ちょうど 1 個であることも assert する。
section=$(awk '/^### 必要な環境変数$/{f=1; next} f && /^#{1,3} /{exit} f' README.md)

fence_count=$(printf '%s\n' "$section" | grep -c '^```env$')
if [ "$fence_count" -ne 1 ]; then
  printf 'FAIL: 「必要な環境変数」節の ```env フェンスが %s 個（1 個であることが前提）\n' "$fence_count"
  exit 1
fi

# **終了フェンスも検証すること。** 開始フェンスの個数だけを見ても、閉じが無ければ
# 下の `sed -n '/^```env$/,/^```$/p'` は範囲の終端に出会えず**節の末尾まで**拾う。
# 抽出対象が黙って広がるのに検査は緑のままなので、開始側と同じ理由で assert する。
#
# **数えるのは「```env の後ろに閉じがあるか」であって、節内の閉じフェンスの総数ではない**
# （2026-08-02 修正）。旧形の `grep -c '^```$'` は節内の**あらゆる**閉じフェンスを数えるため、
# `env` ブロックより**手前**にある別のコードブロックの閉じ 1 個だけで `-lt 1` を満たし、
# 肝心の env ブロックが未閉鎖でも通過していた。位置関係を見る awk へ置き換える。
if ! printf '%s\n' "$section" | awk '/^```env$/{f=1; next} f && /^```$/{found=1; exit} END{exit !found}'; then
  echo 'FAIL: 「必要な環境変数」節の ```env フェンスが閉じていない'
  exit 1
fi

actual=$(printf '%s\n' "$section" | sed -n '/^```env$/,/^```$/p' \
           | grep -oE '^[A-Z_][A-Z0-9_]*=' | tr -d '=' | sort -u)

missing=$(comm -23 <(printf '%s\n' "$expected") <(printf '%s\n' "$actual"))
if [ -n "$missing" ]; then
  printf 'FAIL: missing from README env block:\n%s\n' "$missing"
  exit 1
fi

# 逆向きも見る: README にしか無い変数（= 期待集合の外）
# 片方向だけだと「典型的なコピペで増えた変数」「上の除外表に載せるべき変数」
# 「リネーム後の旧名」が README に残り続けても PASS してしまう。
extra=$(comm -13 <(printf '%s\n' "$expected") <(printf '%s\n' "$actual"))
if [ -n "$extra" ]; then
  printf 'FAIL: not in the expected superset (remove, or add to the exclusion table with a reason):\n%s\n' "$extra"
  exit 1
fi
echo "PASS: README env block matches the superset exactly"
```

**除外は明示的に列挙し、理由を持たせること**（暗黙に母数から漏れるのが元の欠陥だったため）:

| 除外 | 理由 |
|---|---|
| `ELASTICSEARCH_*` | 放棄済みの経路（`src/lib/elastic-search.ts` はコメントアウト） |
| `NODE_ENV` / `VERCEL_ENV` | ランタイム／プラットフォームが供給する。運用者が設定するものではない |
| `E2E_BASE_URL` | E2E 実行専用。`docs/testing/` 側で扱う |
| `SONAR_TOKEN` / `SONAR_HOST_URL` | ローカル静的解析（`docker-compose.sonar.yml` / ADR-005）。アプリのランタイム変数ではない |
| `HSTS_*` | 本番ドメイン所有者向けの opt-in（plan 061）。ローカル開発の README ブロックには意図的に載せない |

> **実測（2026-08-01・前提検査の両方向）**: 現行 README → `PASS`（`expected` 19 件）/ exit 0、
> 「必要な環境変数」節の終了フェンスを削除した複製 → `FAIL: … 閉じていない` / exit 1。
> **旧形は 2 本目でも PASS していた** —— 開始フェンスは 1 個のままなので個数検査を通り、
> `sed` の範囲が節末尾まで暗黙に広がっていた。

**実測（2026-07-26）**: この `expected` は Step 2 の目標ブロックが列挙する **19 変数と完全に一致**する
（`diff` で差分ゼロ）。すなわちゲートの母数と Step 2 の指示が同一の集合を指しており、
「指示は superset・検証は部分集合」というズレは解消されている。
本ステップ実行前の現 README（9 変数）に対しては当然 **FAIL** し、それがこのゲートの Red 状態である。

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
