# Findings 07 — DX/Tooling + Docs（raw・未 vet）

> Explore サブエージェント報告（2026-07-03 / HEAD `f9752c0`）。**Phase 3 の vet 前の生データ**。
> プレイブック（§7 / §8 / Finding format / Prioritization rubric）と recon.md の読了確認済み。除外リスト（ADR-002/005、force-dynamic、OI-9/10/11、C2、E2E ハング、PERF-09）を遵守。
> 秘密値の扱い: 値の再現なし。`.env` は gitignore 済み・未 track を確認 — commit されているのは `*.example` 系のみで、秘密漏えい finding はなし。プロンプトインジェクション様コンテンツなし。

### [DX-01] CI ジョブに依存関係 / Prisma / ビルドキャッシュを追加

- **Evidence**: `.github/workflows/ci.yml` — 6ジョブ（`lint`, `test`, `build`, `integration-tests`, `seed-idempotency`, `visual-baselines`）がそれぞれキャッシュゼロで `bun install --frozen-lockfile` を実行。`grep -rniE "cache" .github/workflows/` はヒットなし。うち5ジョブは加えて `bunx prisma generate` をコールドから再実行。`oven-sh/setup-bun@v2` はキャッシュキーなしで使用され、`~/.bun/install/cache`・Next.js ビルドキャッシュ（`.next/cache`）・Playwright ブラウザの `actions/cache` なし。
- **Impact**: push/PR のたびに全依存グラフ（458KB lockfile、Radix/Next 系 50+ 依存）をジョブごとに再ダウンロード・再リンクし、Prisma を毎回再生成。全 CI 実行での wall-clock と Actions 分の浪費で、コントリビューターのフィードバックループを遅延（PERF-09 の E2E 実行時間とは別問題 — こちらは非 E2E ジョブの install/generate/build キャッシュ）。
- **Effort**: S / **Risk**: LOW（キャッシュは追加的。stale でも最悪クリーンインストールにフォールバック。キーは `bun.lock` ハッシュ + Prisma スキーマハッシュを含めること） / **Confidence**: HIGH
- **Fix sketch**: `hashFiles('bun.lock')` キーの `actions/cache`（または setup-bun のキャッシュオプション）を追加。`build` ジョブにソース+lockfile キーで `.next/cache`。共有 setup composite action で `prisma generate` 出力もキャッシュ/再利用。

### [DX-02] 完全に stale な `docs/unimplemented-screens-plan.md` の退役

- **Evidence**: `docs/unimplemented-screens-plan.md` は約19ルートを「ディレクトリ未作成 / プレースホルダー / ルート未定義」として列挙。`src/app/` 配下の実 `page.tsx` と突合すると、**列挙された全ルートが現存**: `/dashboard/admin/orders`（`src/app/dashboard/admin/orders/page.tsx`、100行）、`/dashboard/admin/coupons`、`/dashboard/seller/stores/[storeUrl]/inventory`、`/dashboard/admin`（41行 — 文書が引用する `<div>Admin DashboardPage</div>` プレースホルダーはもう無い）、`/dashboard/seller/stores/[storeUrl]`、`/profile/messages`・`/profile/settings`、さらに `/about /contact /compare /faq /faqs /track-order /customer-service /returns-exchange /product-support /legal /offers /dispute /report-problem`。**有効なエントリはゼロ**。注: これは recon の Direction ヒント（admin/orders・admin/coupons・seller inventory が「残り候補/要確認」）も無効化 — 3つとも `page.tsx` あり。
- **Impact**: プレイブックは「actively wrong な stale doc は欠落より悪い」とする。本文書はロードマップ/Direction 判断のソースであり（recon が Direction 源として引用）、読者は出荷済み作業をスケジュールしてしまう。埋め込み Gantt の日付（2026-06-08…2026-07-02）も過去。
- **Effort**: S / **Risk**: LOW（削除/アーカイブのみ。ダッシュボード*コンテンツ*の薄さは別途検証してよいが、ルートはもはや未実装ではない） / **Confidence**: HIGH
- **Fix sketch**: 削除するか `docs/archive/` へ「superseded — 全画面 2026-06 実装済み」ヘッダ付きで移動。真に未完の作業（ダッシュボードウィジェットの充実度等）が残るなら `specs/.../08-open-questions.md` へ記載。

### [DX-03] README セットアップの必須環境変数リストを補完

- **Evidence**: README のセットアップブロック `README.md:486-496` は環境変数名9個を記載。ソースから実際に読まれる集合（`grep -o 'process.env.[A-Z_]*' src/`）+ commit 済み `.env.docker.example` との差分で、README 未記載のランタイム変数: `STRIPE_WEBHOOK_SECRET`、`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`、`NEXT_PUBLIC_CLOUDINARY_PRESET_NAME`、`PAYPAL_API_BASE`、`PAYPAL_WEBHOOK_ID`、`IPINFO_TOKEN`、`NEXT_PUBLIC_APP_URL`、Clerk の sign-in/up URL 系。特に `README.md:470` は Cloudinary アカウントを前提条件に挙げながら `NEXT_PUBLIC_CLOUDINARY_*` 2変数が env リストに無く、画像アップロードが静かに設定不全になる。`STRIPE_WEBHOOK_SECRET` の欠落は webhook 署名検証を壊す。（`ELASTICSEARCH_*` は `src/` で読まれるが放棄済み経路 — 実際のオンボーディングギャップではない。）
- **Impact**: README だけに従う新規開発者は部分起動のアプリ（Cloudinary アップロード破損・Stripe webhook 検証不能）を得て、環境変数不足のシグナルもない — 典型的なオンボーディングブロッカー。
- **Effort**: S / **Risk**: LOW（文書のみ。変数**名**のみで値は書かない） / **Confidence**: HIGH
- **Fix sketch**: README の env ブロックをソース参照変数に同期する。
  **単なる「和集合」ではなく、下記の 3 分類で記載すること**（分類しないと、
  放棄予定の変数を新規開発者が律儀に設定しようとして時間を溶かす）:

  | 区分 | 変数 | 扱い |
  |---|---|---|
  | **必須（未設定だと機能が壊れる）** | `STRIPE_WEBHOOK_SECRET`（webhook 署名検証）、`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` / `NEXT_PUBLIC_CLOUDINARY_PRESET_NAME`（画像アップロード）、`PAYPAL_WEBHOOK_ID`、`NEXT_PUBLIC_APP_URL`、Clerk の sign-in/up URL 系 | README に記載し `.env.example` にプレースホルダーを置く |
  | **任意（既定値があり未設定でも動く）** | `PAYPAL_API_BASE`（未設定時 sandbox にフォールバック — `webhooks/paypal/route.ts:6`）、`IPINFO_TOKEN` | 「任意」と明示し、未設定時の既定挙動を 1 行で書く |
  | **放棄予定（設定不要）** | `ELASTICSEARCH_*` | **README には載せない**。`src/` から読まれてはいるが経路自体が放棄済み（`src/lib/elastic-search.ts` はコメントアウト — 既知の制約として `.claude/steering/structure.md` に記載）。載せると「設定すべき変数」と誤読される |

  > 「必須」と「任意」を混ぜて羅列すると、新規開発者はどれを揃えれば起動できるのかが
  > 判断できず、DX-03 が解こうとしているオンボーディングブロッカーが形を変えて残る。
  - 理想は `.env.docker.example` に対する生成/検証で再ドリフトを防止すること
    （分類も含めて機械生成できると望ましい）。

### [DX-04] 非 Docker ローカル開発用の素の `.env.example` を提供

- **Evidence**: ルートには `.env.docker.example` と `.env.test.example` があるが **`.env.example` が無い**。`.gitignore` は `!.env.example` を明示的にホワイトリスト（実在する2つと並んで）しており、存在が期待されているシグナル。README の非 Docker 経路は `bun run dev`（`README.md:502`）と Clerk/Stripe/PayPal/Cloudinary 前提を記載するが、コピー可能なテンプレートは Docker 向け（コンテナホスト名入り）の `cp .env.docker.example .env.docker`（`README.md:477`）のみ。
- **Impact**: bare-metal の `bun run dev` フローを走らせるコントリビューターにはコピーすべき `.env` テンプレートが無く、不完全な README ブロック（DX-03 参照）から手組みするしかない — オンボーディング摩擦の複利。
- **Effort**: S / **Risk**: LOW（新規プレースホルダーファイル。変数名/空値のみで実クレデンシャルは絶対に入れない） / **Confidence**: HIGH
- **Fix sketch**: gitignore 済みホワイトリストの `.env.example` を追加（全必須変数名 + 空/プレースホルダー値、ローカル非コンテナ `bun run dev` フロー用）し、README から参照。

### [DX-05] pre-commit フックなし・フォーマッタが CI で未強制

- **Evidence**: `.husky/` なし、`lint-staged` なし、`package.json` に `prepare`/`pre-commit` スクリプトなし（`grep -iE "husky|lint-staged|prepare|pre-commit"` → ヒットなし）。`.git/hooks` はサンプルのみ。Prettier はインストール済み（`prettier` + `prettier-plugin-tailwindcss`、`prettier.config.js` あり）で README/CLAUDE.md は手動の `bunx prettier --write <file>` を記載するが、**`format`/`format:check` npm スクリプトも Prettier check モードの CI ジョブも無い** — フォーマットは完全に任意。`eslint.config.mjs` は `tailwindcss/classnames-order` を warn で頼っているが、Prettier の tailwind プラグインなら自動修正できるもの。
- **Impact**: フォーマット/リントのドリフトがコミットに載り、（載るとしても）レビューでしか捕捉されない。15警告の lint ベースラインと tailwind 順序警告が残存する一因は、コミット時に何も自動フォーマットしないこと。recon の規約（構造化ログ・`console.log` 禁止等）にも機械的ガードレールなし。
- **Effort**: M / **Risk**: LOW–MED（`format:check` CI ジョブは未フォーマットのツリーで即赤になり得る。一度きりのフォーマットパスと同時に導入して赤ベースラインを回避） / **Confidence**: HIGH
- **Fix sketch**:
  - `format` / `format:check` スクリプト追加、CI `lint` ジョブに Prettier check ステップ、
    任意で軽量な `lint-staged` + git hook（husky または `prepare` スクリプト）で
    ローカル pre-commit 高速フィードバック。
  - **`no-console` ルールを CI で強制する**（本 finding の「規約に機械的ガードレールが無い」
    という Impact に直接効く最小の一手）:
    ```js
    // eslint.config.mjs — src/ 配下のアプリケーションコードに適用
    rules: {
        // console.log 禁止（.claude/steering/tech.md「ログ禁止」規約）。
        // 構造化ログの console.error / console.warn は境界での正規手段なので許可する。
        "no-console": ["error", { allow: ["warn", "error"] }],
    }
    ```
    > **`allow: ["warn", "error"]` が要点**。`.claude/rules/01-engineering-standards.md` は
    > 「`console.error`/`console.warn` で境界ログを出す」ことを**要求**しており、
    > `no-console` を無条件 error にすると規約自身と衝突して大量の
    > `eslint-disable` を誘発する（DX-07 が問題視している disable 21 箇所を増やす）。
    > 禁止対象は `console.log` のみ。
    - **適用範囲の除外が必要**: CLI（`prisma/seed/`）は `console.log` 許容
      （tech.md の明示的な例外）。`scripts/` も同様に扱うか個別判断すること。
    - 導入時は TECHDEBT-06（`src/` UI の残置デバッグ `console.log`）の除去と
      **同時**に行う。先にルールだけ入れると CI が即赤になる（DX-05 の Risk 欄が
      Prettier について指摘しているのと同じ構図）。

### [DX-06] `typecheck` スクリプト / CI 型チェックジョブが無い

- **Evidence**: `bunx tsc --noEmit` は recon 文書化済みのベースライン型ゲート（exit 0）だが、`package.json` に `typecheck` スクリプトなし、`.github/workflows/ci.yml` に専用型チェックジョブなし — `lint` ジョブは ESLint のみ。型エラーはパイプライン最遅の `build` ジョブ（`bun run build`）でしか捕捉されない。
- **Impact**: 型回帰が高速な専用ジョブでなくフル Next ビルド後にしか表面化せず、コントリビューターにはワンワードのローカルコマンド（`bun run typecheck`）が無く生の `bunx tsc --noEmit` を覚える必要がある。strict + `any` 禁止（CLAUDE.md）のリポジトリでは高速な型フィードバックの価値が高い。
- **Effort**: S / **Risk**: LOW（追加的なスクリプト + ジョブ。`tsc --noEmit` ジョブは lint/test と並列実行可能） / **Confidence**: HIGH
- **Fix sketch**: scripts に `"typecheck": "tsc --noEmit"` を追加し、並列の `typecheck` CI ジョブ（同じ Prisma generate 前提つき）で型エラーをビルドと独立に fail-fast。

### [DX-07] zero-warning lint ポリシーへの道筋がない・期限なしのルール降格

- **Evidence**: `package.json` の lint スクリプトは `eslint .` で `--max-warnings` キャップなし — 15警告ベースライン（recon）が無期限に許容され、警告が増えても CI `lint` ジョブは緑のまま。`eslint.config.mjs:18-27` は react-hooks v6 の5ルール（`set-state-in-effect`, `static-components`, `immutability`, `purity`, `globals`）を「一時的に warn に … 既存コードのリファクタリングは別タスクで対応」コメント付きで降格 — 追跡 issue 参照のない期限なし「一時的」状態。`src/` に `eslint-disable` 21箇所（`react-hooks/exhaustive-deps` 12 + tailwindcss order/custom-classname 7 が支配的、`src/components/store/**` の cart-page/checkout-page/product-page/reviews/profile コンテナに集中）。
- **Impact**: 警告数は増える一方 — 新 PR が警告16個目を足すのを何も防がない。「一時的」な
  react-hooks 降格は恒久化リスクがあり、フック正しさ由来のバグクラスが warn に埋もれて
  見逃されうる。**OI-9（SSR の `window` フックバグ）は、この降格ルール群が捕捉し得た
  一例として挙げられる**が、
  > **因果の断定はしない**: 「降格が OI-9 を隠蔽した」と言うには、
  > (a) 降格された 5 ルール（`set-state-in-effect` / `static-components` /
  > `immutability` / `purity` / `globals`）のいずれかが OI-9 の該当コードで
  > **実際に発火すること**、(b) error のままなら**混入前に止められたこと**の
  > 2 点を検証する必要があり、本 raw findings では**未検証**。
  > 実際、SSR 時の `window` 参照を捕捉するのは `globals` 系が候補だが、
  > 発火するかはコード形状に依存する。
  > **検証したい場合**: 該当ルールを一時的に error へ戻して
  > `bun run lint` を実行し、OI-9 の該当箇所が報告されるか確認する（S effort）。
  > 発火するならラチェット導入の説得材料として強い根拠になり、しないなら
  > 本 finding からこの例示を落とす。
  いずれにせよ**ラチェットの必要性は OI-9 の帰属に依存しない**（警告が無期限に
  増えうること自体が問題）ので、この検証は Fix sketch の前提ではない。
- **Effort**: M（ラチェット + 現15件のバーンダウン）/ L（react-hooks 降格の完全解消） / **Risk**: MED（降格ルールの error 復帰や `--max-warnings 0` はバックログ解消まで CI を落とす。即ゼロでなくラチェット — 現数でキャップし漸減 — として導入） / **Confidence**: HIGH
- **Fix sketch**: lint スクリプトに `--max-warnings <baseline>` を今すぐ入れて件数凍結 → 0 へのバーンダウンをタスク化 → `eslint.config.mjs` の各降格に issue リンクと目標期日を付す。

### [DX-08] `prisma db push` ガイダンスの doc 層間矛盾を解消

- **Evidence**: `CLAUDE.md`（開発コマンド節）は `bunx prisma db push` を利用可能な開発コマンドとして記載（「スキーマ直接反映（マイグレーション履歴なし、開発専用）」、直後の注記で軟化）。`.claude/steering/tech.md:331` は `bunx prisma db push` を**禁止事項（してはいけない）表の行**に配置。リポジトリの `safe-migration` skill は db push を "strictly forbidden" と明言。3層で「db push は公認コマンドか」が食い違う。
- **Impact**: 多層 doc システム（CLAUDE.md ↔ steering ↔ skills）はエージェント/人間コントリビューターへの SSOT 契約。同一コマンドが「文書化された開発コマンド」かつ「禁止アンチパターン」であることは契約を毀損し、エージェントがチームの禁止したマイグレーション経路を実行し得る。
- **Effort**: S / **Risk**: LOW（doc 編集のみ） / **Confidence**: MED（矛盾は明白。解消方向 — CLAUDE.md から除去 vs steering 緩和 — はメンテナ判断）
- **Fix sketch**: 立場を1つに — おそらく CLAUDE.md のコマンド一覧から `db push` を除去（または禁止と明示）し、3層すべてを `safe-migration` と整合させる。

### [DX-09] クロスエディタ一貫性のための `.editorconfig` 追加

- **Evidence**: リポジトリルートに `.editorconfig` なし。Prettier 設定は存在するが Prettier/統合フォーマッタを通したファイルにしか効かず、Prettier プラグインを読まないエディタ向けのインデント/charset/final-newline のベースラインが無い。
- **Impact**: 軽微 — Prettier 統合のないエディタのコントリビューターが whitespace/インデントの churn を持ち込み得て、DX-05 の強制欠如では pre-commit で捕捉されない。
- **Effort**: S / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: Prettier 設定をミラーする小さな `.editorconfig`（indent style/size、LF、UTF-8、trailing whitespace 除去、final newline）。

---

**Leverage 順（サブエージェント自己申告）**: DX-02/03/04 が最高レバレッジ（S effort・LOW リスク・HIGH confidence・オンボーディング/正確性への直接効果）→ DX-01/06（強い S effort CI 改善）→ DX-05/07（M effort の構造的ガードレール、MED リスクの導入はラチェットで）→ DX-08/09（低コスト衛生）。recon の除外/既知項目との重複なし。
