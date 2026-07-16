# Findings 07 — DX/Tooling + Docs（raw・未 vet）

> 原本: [../../audit/findings-07-dx-docs.md](../../audit/findings-07-dx-docs.md)

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
- **Fix sketch**: README の env ブロックをソース参照変数の和集合（放棄済み Elasticsearch を除く）に同期し、public / server-only でグループ化。理想は `.env.docker.example` に対する生成/検証で再ドリフトを防止。

### [DX-04] 非 Docker ローカル開発用の素の `.env.example` を提供

- **Evidence**: ルートには `.env.docker.example` と `.env.test.example` があるが **`.env.example` が無い**。`.gitignore` は `!.env.example` を明示的にホワイトリスト（実在する2つと並んで）しており、存在が期待されているシグナル。README の非 Docker 経路は `bun run dev`（`README.md:502`）と Clerk/Stripe/PayPal/Cloudinary 前提を記載するが、コピー可能なテンプレートは Docker 向け（コンテナホスト名入り）の `cp .env.docker.example .env.docker`（`README.md:477`）のみ。
- **Impact**: bare-metal の `bun run dev` フローを走らせるコントリビューターにはコピーすべき `.env` テンプレートが無く、不完全な README ブロック（DX-03 参照）から手組みするしかない — オンボーディング摩擦の複利。
- **Effort**: S / **Risk**: LOW（新規プレースホルダーファイル。変数名/空値のみで実クレデンシャルは絶対に入れない） / **Confidence**: HIGH
- **Fix sketch**: gitignore 済みホワイトリストの `.env.example` を追加（全必須変数名 + 空/プレースホルダー値、ローカル非コンテナ `bun run dev` フロー用）し、README から参照。

### [DX-05] pre-commit フックなし・フォーマッタが CI で未強制

- **Evidence**: `.husky/` なし、`lint-staged` なし、`package.json` に `prepare`/`pre-commit` スクリプトなし（`grep -iE "husky|lint-staged|prepare|pre-commit"` → ヒットなし）。`.git/hooks` はサンプルのみ。Prettier はインストール済み（`prettier` + `prettier-plugin-tailwindcss`、`prettier.config.js` あり）で README/CLAUDE.md は手動の `bunx prettier --write <file>` を記載するが、**`format`/`format:check` npm スクリプトも Prettier check モードの CI ジョブも無い** — フォーマットは完全に任意。`eslint.config.mjs` は `tailwindcss/classnames-order` を warn で頼っているが、Prettier の tailwind プラグインなら自動修正できるもの。
- **Impact**: フォーマット/リントのドリフトがコミットに載り、（載るとしても）レビューでしか捕捉されない。15警告の lint ベースラインと tailwind 順序警告が残存する一因は、コミット時に何も自動フォーマットしないこと。recon の規約（構造化ログ・`console.log` 禁止等）にも機械的ガードレールなし。
- **Effort**: M / **Risk**: LOW–MED（`format:check` CI ジョブは未フォーマットのツリーで即赤になり得る。一度きりのフォーマットパスと同時に導入して赤ベースラインを回避） / **Confidence**: HIGH
- **Fix sketch**: `format`/`format:check` スクリプト追加、CI `lint` ジョブに Prettier check ステップ、任意で軽量な `lint-staged` + git hook（husky または `prepare` スクリプト）でローカル pre-commit 高速フィードバック。

### [DX-06] `typecheck` スクリプト / CI 型チェックジョブが無い

- **Evidence**: `bunx tsc --noEmit` は recon 文書化済みのベースライン型ゲート（exit 0）だが、`package.json` に `typecheck` スクリプトなし、`.github/workflows/ci.yml` に専用型チェックジョブなし — `lint` ジョブは ESLint のみ。型エラーはパイプライン最遅の `build` ジョブ（`bun run build`）でしか捕捉されない。
- **Impact**: 型回帰が高速な専用ジョブでなくフル Next ビルド後にしか表面化せず、コントリビューターにはワンワードのローカルコマンド（`bun run typecheck`）が無く生の `bunx tsc --noEmit` を覚える必要がある。strict + `any` 禁止（CLAUDE.md）のリポジトリでは高速な型フィードバックの価値が高い。
- **Effort**: S / **Risk**: LOW（追加的なスクリプト + ジョブ。`tsc --noEmit` ジョブは lint/test と並列実行可能） / **Confidence**: HIGH
- **Fix sketch**: scripts に `"typecheck": "tsc --noEmit"` を追加し、並列の `typecheck` CI ジョブ（同じ Prisma generate 前提つき）で型エラーをビルドと独立に fail-fast。

### [DX-07] zero-warning lint ポリシーへの道筋がない・期限なしのルール降格

- **Evidence**: `package.json` の lint スクリプトは `eslint .` で `--max-warnings` キャップなし — 15警告ベースライン（recon）が無期限に許容され、警告が増えても CI `lint` ジョブは緑のまま。`eslint.config.mjs:18-27` は react-hooks v6 の5ルール（`set-state-in-effect`, `static-components`, `immutability`, `purity`, `globals`）を「一時的に warn に … 既存コードのリファクタリングは別タスクで対応」コメント付きで降格 — 追跡 issue 参照のない期限なし「一時的」状態。`src/` に `eslint-disable` 21箇所（`react-hooks/exhaustive-deps` 12 + tailwindcss order/custom-classname 7 が支配的、`src/components/store/**` の cart-page/checkout-page/product-page/reviews/profile コンテナに集中）。
- **Impact**: 警告数は増える一方 — 新 PR が警告16個目を足すのを何も防がない。「一時的」な react-hooks 降格は恒久化リスクがあり、まさにこのルール群が捕まえるはずのフック正しさ由来のバグクラス（OI-9 の SSR `window` フックバグが該当）を隠蔽。
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
