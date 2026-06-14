# OI-8 CI フレーク — 完全クローズ（真因確定・解消・modal-provider un-skip 完了）【アーカイブ】

> **Status**: ✅ **完全クローズ（2026-06-14）** — 真因解消（`size.test.ts` の Prisma 接続リーク, `83ef06c`）+ 被害者だった `modal-provider.test.tsx` 9 件の un-skip（`49fa32d`）+ CI push/pull_request 両 event 2 サイクル緑 + `spec-sync-after-test`（1272→1281 passed / skip 12→3）完了。本ファイルは解決済み issue のアーカイブ記録。
> SSOT は [`docs/testing/QA_HANDOFF.md`](../../testing/QA_HANDOFF.md) の OI-8 行（監査証跡）。本ファイルは真因の技術詳細と un-skip 手順の記録。

---

## 1. 結論（先に要点）

OI-8（同名テスト 2〜3 回列挙・**本文すべて空**・ローカル緑/CI 赤・失敗テストがランダムに移動）の**真因**は、
`modal-provider` / `shipping-form` / `review-details` といったテスト本体ではなく、

> **`src/queries/size.test.ts` が `@/lib/db` をモックせず実 Prisma クライアントを `spyOn` していたため、
> CI の stub `DATABASE_URL`（`localhost:5432`）に対しバックグラウンド接続が
> `PrismaClientInitializationError`（P1001）で reject。その非同期 reject が同一ワーカーの
> プロセス境界をまたいでリークし、jest-circus が「その瞬間 current な別ファイルのテスト/フック」に
> `error` イベントとして帰属させていた。**

P1001 エラーの `stack` getter が空文字のため、Jest レポーターが失敗本文を空に整形 → 「本文空」署名。
帰属先がランダムなのは、リーク reject が surface する瞬間にどのテストが走っているかに依存するため。

**修正**: `size.test.ts` に `jest.mock("@/lib/db")` を追加（commit `83ef06c`）。実クライアント生成を断ち、
接続リークを根絶。review-details は CI で push/pull_request 両 event のグリーン + Unit Tests ジョブの
P1001/circus キャプチャ **0 件**を 2 サイクル確認。

---

## 2. なぜ過去の調査で外したか（教訓）

| 過去の仮定 | 実際 |
|------------|------|
| 「modal setOpen の async が原因」(ADR-003 仮説 A) | 別系統。modal-provider は被害者 |
| 「MSW onUnhandledRequest が throw 化」(仮説 B) | 別系統 |
| 「workflow 層（`--maxWorkers=1` / `continue-on-error`）が本筋」 | 対症療法。真因はテスト内の Prisma リーク |
| 「`[FLAKE-DIAG:unhandledRejection]` で捕まるはず」（commit `0736735`） | **沈黙の理由が判明**: 真因は process の `unhandledRejection` ではなく jest-circus の `error` イベント。process リスナーでは捕捉できない |

**決定打**: jest-circus の `handleTestEvent` をフックする一時カスタム jsdom 環境を作り、
失敗イベント（`test_fn_failure` / `test_done(errors>0)` / `error`）の**生エラーオブジェクト**を
`util.inspect(showHidden)` で CI ログへ surface（commit `a93effe`、観測後 `756c6a9` で撤去）。
これで「本文空」の正体が P1001 だと実観測できた。

> **再利用メモ**: 「本文空・ランダム帰属」署名を再び見たら、`process.on` リスナーではなく
> **custom environment + `handleTestEvent`** で生エラーを掴むのが最短。レポーターが空にする失敗は
> circus イベント層でしか正体が見えない。

---

## 3. 影響範囲（OI-8 は単一真因の複数被害者だった）

| ファイル | 状態 | 本修正後 |
|----------|------|----------|
| `review-details.test.tsx` | アクティブ失敗（被害者・Prisma 非依存） | ✅ 解消（CI 2 サイクル緑で確認） |
| `tests/component/store/shipping-form.test.tsx` | 過渡的被害者（現在 skip なし・pass） | ✅ リーク源消失で再発しない見込み |
| `src/providers/modal-provider.test.tsx` | **`describe.skip` で 9 件 skip 中**（被害者・Prisma 非依存） | ⏳ **un-skip 可能（次セッション・下記 §4）** |

決定論的裏付け: stub `DATABASE_URL` でフルユニットスイートを実行し、修正前後で
`PrismaClientInitializationError`(P1001) が **6+ → 0**（Build ジョブのビルド時 Prisma ログは別件・無関係）。

---

## 4. 引き継ぎ: modal-provider 9 件の un-skip 手順（✅ 2026-06-14 完了）

> ✅ **全 Step 完了（2026-06-14）**: Step 1（un-skip `49fa32d`）/ Step 2（ローカル 30x FAIL 0・stub DB P1001 = 0）/
> Step 3（CI push/pull_request 両 event 2 サイクル緑）/ Step 4（`spec-sync-after-test`、1272→1281 / skip 12→3）/
> Step 5（本ファイルを `docs/ci/archive/` へ移動・ADR-003 Status 更新）。以下は実施記録。

**前提**: 真因（size.test.ts の Prisma リーク）は commit `83ef06c` で根絶済み。modal-provider は
Prisma 非依存の被害者なので、リーク源が消えた今は un-skip して安定するはず。

### Step 1 — un-skip
- [`src/providers/modal-provider.test.tsx`](../../../src/providers/modal-provider.test.tsx) の L87 付近
  `describe.skip("ModalProvider", () => {` を `describe("ModalProvider", () => {` に戻す。
- 同ファイル冒頭 L74-86 の「FILE-LEVEL SKIPPED — OI-8」コメントブロックを削除し、
  代わりに「OI-8 真因（size.test.ts Prisma リーク）解消により復活（本ファイル参照）」の 1 行に置換。

### Step 2 — ローカル検証（決定論シグナル）

```bash
# 1) modal-provider 単体ループ（act/flake 兆候の有無）
for i in $(seq 1 30); do bunx jest src/providers/modal-provider.test.tsx --silent || echo "RUN $i FAIL"; done
# 2) stub DB でフルスイートに P1001 が出ないこと（リーク源ゼロの再確認）
! DATABASE_URL='postgresql://stub:stub@localhost:5432/stub' DIRECT_URL='postgresql://stub:stub@localhost:5432/stub' \
  bun run test 2>&1 | grep -qE "P1001|PrismaClientInitialization"   # → リーク無しで exit 0
```

- `test-complete`（lint / tsc / test）緑を確認。

### Step 3 — CI 検証（push/pull_request 両 event）
- push 後、`modal-provider.test.tsx` が PASS かつ「本文空」失敗が出ないことを複数サイクル確認。
- 念のため一時的に §2 の custom-environment 診断を再投入してもよいが、リーク源は消えているため不要の見込み。

### Step 4 — テスト統計の同期（**skip 9→0 で総数が変わる → `spec-sync-after-test` 必須**）
- 期待値: `Skipped 12 → 3`（idempotency 3 のみ残）、`passed 1272 → 1281`（modal-provider 9 復活）、suites の skip も 2→1。
- `spec-sync-after-test` skill を起動し、**SSOT = `QA_HANDOFF.md`** から
  `PROGRESS.md` / `07-testing.md` / `COVERAGE_REPORT.md` / `docs/coverage-dashboard.html`（`bun run coverage:dashboard`）へ伝播。
- カバレッジ: `hooks ◐`（modal-provider skip が理由）→ 実測再評価（✦/◐ はヒートマップ規則に従う）。
- QA_HANDOFF / COVERAGE_REPORT の OI-8 行をクローズ（解消済みアーカイブへ移動）。

### Step 5 — クリーンアップ
- 本ファイル（`docs/ci/archive/unit-tests-run-reactive.md`）の Status を「完全クローズ」に更新済み。
- ADR-003 の OI-8 追加調査セクションに最終結論（Prisma リーク真因・解消）を追記。

---

## 5. 参照

- 修正 commit: `83ef06c`（`fix(test): mock @/lib/db in size.test.ts ...`）
- 診断 commit: `a93effe`（custom env + uncaughtException 計装）/ 撤去: `756c6a9`
- 真因の event-pair 証跡: 失敗 push run `27487047124`（`[FLAKE-DIAG:circus:test_done(errors=3)]` = 3× P1001）
- 関連: [`docs/testing/QA_HANDOFF.md`](../../testing/QA_HANDOFF.md) OI-8 行（SSOT）/
  [`docs/architecture/decisions/003-modal-setopen-sync-for-react19.md`](../../architecture/decisions/003-modal-setopen-sync-for-react19.md)
- skill: `ci-flake-diagnosis`（「コード修正前に真因を実観測」— 本件はその原則の実践例）
