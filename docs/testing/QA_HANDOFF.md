# QA & Test Implementation Handoff（次回セッションへの引き継ぎ）

> **最終更新**: 2026-08-09 / **HEAD**: `bc663893`（**plan 037 の完了**。`tests/integration/shipping-address-default.test.ts` を新設し Integration を **53 → 57 / スイート 6 → 7**（+4）。`src/queries/user.ts` は 1 行も変更していない。checkout の配送先自動選択は `addresses.find((a) => a.default)`（`address.list.tsx`）で**最初の default を採る**ため、「1 ユーザーにつき `default: true` は最大 1 件」が壊れると**配送先の自動選択が行の並び順に依存する非決定**になる（意図しない住所への配送リスク）。この行状態の変化はモック unit では観測できない。固定したのは (1) **更新経路は正常** —— 既存住所を default に更新すると他住所の default が実 DB で解除され `count === 1` に収まる、(2) **新規経路は解除がスキップされ 2 件併存する** —— 実装は `findUnique(address.id)` が行を返したときにしか `updateMany` を撃たないため、新規 id では条件が偽になる。**これは既知バグ TESTS-21 の characterization であって正しい期待値ではない**（テスト本文に `TODO(characterization)` タグ・TESTS-21 参照・正しい不変条件・「修正時に 1 へ反転」の 4 点をコメントで明記済み。このタグが無いと後任が `=== 2` を満たすべき契約と誤読し、バグ修正を「テストが壊れた」として差し戻す事故が起きる）、(3) **IDOR 防御の実体** —— 他ユーザーの住所 id を渡すと所有権 `findFirst` が null になり、同一 id での create が **P2002** で reject される。silent overwrite にはならず被害者の `userId` / `firstName` も不変、(4) 未認証の拒否と行数不変。**識別力は実測で確認済み**（シナリオ 1 の解除期待と 3 の被害者 `userId` を崩すとその 2 件だけが赤くなる）。**STOP 条件は非該当**: シナリオ 2 の実測は **2**（ギャップは未修正のまま）、シナリオ 3 は P2002 で reject（create 成功による行の乗っ取りは起きていない）。**Drift check は引っかかったが STOP には該当しなかった** —— `user.ts` は baseline `4ec6b5b` から **+856 / −645 行**動いていたが、プランが抜粋していた `upsertShippingAddress` の**形状**（`findUnique` → `if (addressDB)` の `updateMany` → 所有権 `findFirst` → update / create の分岐）は健在で、新規経路の解除スキップもそのまま残っていた（plan 027 が確立した扱いに倣う）。直前: `7986d9fb`（**plan 036 の完了**。`tests/integration/product-deletion.test.ts` を新設し Integration を **49 → 53 / スイート 5 → 6**（+4）。`src/queries/product.ts` と `prisma/schema.prisma` はいずれも 1 行も変更していない。`deleteProduct` は `db.product.delete` の**ハード削除**で、「何が連鎖して消え、何が削除を阻止するか」は FK 定義でしか決まらないため、`db.product.delete` をモックする unit テストでは**原理的に検証できない**境界だった。固定したのは (1) **CASCADE 9 種の全件消滅** —— ProductVariant / Size / ProductVariantImage / Color / Spec〔productId 紐付け・variantId 紐付けの**両経路**で 2 行〕/ Question / Wishlist / FreeShipping / FreeShippingCountry。最後の 1 つは Product の**孫**（Product → FreeShipping → FreeShippingCountry）で、1 段目だけ見ると多段連鎖の回帰を取り逃すため孫まで assert している、(2) **RESTRICT** —— `Review.productId` は `onDelete` 未指定＝ Prisma 既定の Restrict なので、レビューが 1 件でも付いた商品は削除できず **P2003** が投げられる（セラーのダッシュボードに 500 として露出する**現挙動の characterization**）、(3) **原子性** —— RESTRICT で失敗したときに子テーブルが 1 件も欠けないこと（DB は tx 内で子の CASCADE を実行してから RESTRICT に到達しうるため、商品と variant だけ数えても「部分的に子だけ消えていない」は示せない）、(4) 所有権ガード（IDOR）と not-found の副作用なし。**削除前の件数を `>= 1` ではなく厳密な `toEqual`（spec のみ 2・他は 1）で固定している** —— 下限で緩めると Arrange の取りこぼしを「0 件のものを数えて 0 件だった」と誤読し、CASCADE の検証そのものが空振りになるため。**識別力は実測で確認済み**（`spec: 2 → 1` と `P2003 → P2025` に崩すとその 2 件だけが赤くなる）。**STOP 条件 3 点はいずれも非該当**: シナリオ 2 の削除は成功せず、シナリオ 1 の子テーブルは全て 0、`grep -nE "onDelete" prisma/schema.prisma` とプランの CASCADE 表も一致した。直前: `6514e0c6`（**plan 033 の完了**。`tests/integration/search-products.test.ts` を新設し Integration を **40 → 49 / スイート 4 → 5**（+9）。`src/` は 1 行も変更していない。固定したのは `/api/search-products` が `$queryRaw` で発行する **raw SQL そのもの** —— unit テストは `@/lib/db` を全モックしているため、この SQL 文字列はユニット/統合いずれでも一度も実行されていなかった。実 PostgreSQL で押さえたのは (1) `'simple'` トークナイザーが小文字化すること（"Alpha" が `alpha` でヒット）、(2) name / description いずれのヒットも拾うこと、(3) `ts_rank` の降順ソート（出現頻度の高い行が先頭・`relevance` が number で狭義降順）、(4) `plainto_tsquery` の **AND 意味論**（"beta gadget" は両語を持つ行のみ）、(5) 空白トリム（空文字列）と **`q` パラメータ欠落（`null`）を独立した 2 分岐**として、(6) `Prisma.sql` のパラメータ化（`'; DROP TABLE "Product"; --` が 200 を返し `product.count()` が不変）、(7) 従属で `subCategory.ts` の `ORDER BY RANDOM()` raw SQL が実 DB で成立し limit 件返すこと。**識別力は実測で確認済み** —— シナリオ 3 の期待順序と 6 の件数期待を一時的に崩すと**その 2 件だけが赤くなる**ことを確認してから戻している（rule 02 の Red 規律を、本体を変更できないテスト追加作業へ適用する形）。**実行環境の注意**: plan 032 と同じく本ファイルのみ docblock で `testEnvironment: node` に上書きしている（jsdom には Fetch API の `Request` / `Response` が無く Route Handler を直接呼べない。`jest.integration.config.js` は無変更）。**この SQL は式インデックスを持たない**ため、将来 GIN 式インデックスを入れる際は本テストが「式とインデックス定義のズレ」の回帰検知になる（式が 1 文字違うとインデックスが使われない）。直前: `0089f4a4`（**Stripe webhook の非 USD 拒否分岐をユニット層でカバー**。`a4d01b27`（非 USD イベントを 400 で拒否する実装）が追加した分岐は `tests/integration/webhook-payment.test.ts` の Scenario S8 で検証済みだったが、**`jest.config.js` の `testPathIgnorePatterns` が `tests/integration/` を除外しているため `coverage/lcov.info` に現れず**、SonarCloud PR #169 の **Coverage on New Code が 70%**（`src/app/api/webhooks/stripe/route.ts` に未カバー 2 行 / 未カバー条件 1）になっていた。DB モックのユニット層で「400 を返し `$transaction` / `paymentDetails.upsert` / `order.update` が一切呼ばれない」まで固定して lcov に載せた（**+1 テスト / スイート不変**、当該ファイルの Lines 87.5%→90.62%）。**恒久的な教訓**: 統合テストだけで守った分岐は Sonar の New Code カバレッジには算入されない —— 新規分岐は必ずユニット層にも 1 本置くこと。直前: `c4a6fb41`（**plan 032 由来 finding の本体修正**。webhook 2 経路の `PaymentDetails.amount` を `Order.total`（ドル建て）に統一し、`update` 分岐にも `amount` / `currency` を追加。テスト数は不変で S1 / P4 の期待値のみ反転〔`607c2b88`〕。詳細は下記 plan 032 記録の「→ 修正内容」を参照。直前: `9e1682b7`（**plan 032 の完了**。`tests/integration/webhook-payment.test.ts` を新設し Integration を **28 → 39 / スイート 3 → 4**（+11・Stripe 7 + PayPal 4）。`src/app/api/webhooks/**` は 1 行も変更していない。固定したのは (1) 初回イベントでの行作成（当時は Stripe が event の **cents** を、PayPal が **`Order.total`（ドル建て）**を `amount` に格納する**経路ごとに異なる格納規則**だった —— この差自体が単位バグで、`c4a6fb41` で両経路とも `Order.total` に統一済み）、(2) 再送で行が 1 本に保たれること —— **逐次に加えて並行ディスパッチ**（バリアで 2 本を揃えて解放 + `connection_limit >= 2` を明示 `expect` + **両配送が 2xx** であることも assert。`count === 1` だけでは片方が 500 で落ちても緑になり「1 本が失敗した」状態を見逃す。冪等性の主張は「両方成功 **かつ** 副作用 1 回」の連言）、(3) `succeeded → charge.refunded` の遷移が同じ行を更新（全額 → `Refunded` / 部分 → `PartiallyRefunded`）、(4) Order 不在は 404 で何も書かない、(5) **`$transaction` の原子性** —— `order.update` が書く `paymentMethod='Stripe'` だけを拒む CHECK 制約を一時的に張り「upsert 成功 → update 失敗 → 全ロールバック（500 / `count === 0`）」を固定。制約を落とした**後**に対照配送（同じイベントで `count === 1`）を置き、「ロールバックされた」と「そもそも 1 番目も書かれなかった」を区別できるようにしている。**🆕 新規 finding（→ `c4a6fb41`・2026-08-07 で修正済み）**: プロバイダー切替（Stripe → PayPal）で `PaymentDetails` は 1 行に保たれ `paymentMethod` / `paymentIntentId` / `status` は更新されるが、**`amount` と `currency` は更新されない** —— 両 route の `upsert` は `update` 分岐にこの 2 列を持たず `create` 分岐にしかないため、切替後の行は「`paymentMethod: PayPal` なのに `amount` は Stripe のセント値」という**単位混在**で残る（CORRECTNESS-05 と同じ単位問題の族）。Scenario P4 は現挙動をそのまま固定してあり、修正が入れば正しく赤くなる。**→ 修正内容**: 両 route の `update` 分岐に `amount` / `currency` を追加し、あわせて **Stripe webhook が event の cents を保存していた単位バグ本体**も是正（`order.total` 保存へ統一。CORRECTNESS-05 は同期パスしか直っていなかった）。S1 / P4 の characterization は解除して期待値を反転済み（`607c2b88`）。**テスト数は不変**（11/11 pass）。既存行の backfill は [plan 063](../../plans/063-backfill-stripe-payment-amount.md) が担当（カットオーバー境界は `e63474b6` ではなく `c4a6fb41`）。**実行環境の注意**: 本ファイルのみ docblock で `testEnvironment: node` に上書きしている（jsdom には Fetch API の `Request` / `Response` が無く Route Handler を直接呼べない。`jest.integration.config.js` は無変更）。直前: `61eacfb1`（**plan 031 の完了**。`tests/integration/order-lifecycle.test.ts` を新設し Integration を **20 → 28 / スイート 2 → 3**（+8）。`src/queries/order.ts` は 1 行も変更していない。固定したのは (1) Cancelled / Refunded 遷移の親子連動（親 `PaymentStatus` は "Cancelled"〔l 2 つ〕・子 `OrderStatus` は "Canceled"〔l 1 つ〕というスペル差も含む）と在庫が減算前まで戻ること、(2) **二重キャンセルの冪等性** —— 逐次 2 回でも復元は 1 回ぶんのみ、`Cancelled → Refunded` の再遷移も条件付き `updateMany` の `where` に弾かれる、(3) 並行ディスパッチ版（バリアで 2 本を揃えてから解放 + `connection_limit >= 2` を明示 `expect`）、(4) Paid 遷移は子連動も復元もしない、(5) `updateOrderGroupStatusAsAdmin` はキャンセルしたグループの在庫のみ復元し親は混在→`Processing` / 全 Canceled→`Canceled` へ集約、(6) 非 ADMIN は両 admin 関数とも拒否され副作用ゼロ。**⚠️ 在庫整合を「検証済み」と説明する場面では `updateOrderPaymentStatus`（CAS 済み）と `updateOrderGroupStatusAsAdmin`（`findUnique` → 分岐 → `update` の read-then-act・**並行二重復元は未解決**）を必ず区別すること** —— 本プランが並行安全性を固定したのは前者のみで、後者の本体修正（条件付き `updateMany` への統一・前例 `d0005bb`）は [`plans/README.md`](../../plans/README.md) の Deferred に残っている。**⚠️ 並行ケースが主張できるのは「並行ディスパッチの回帰テスト」までで、DB 上でトランザクションが重なったことの証明ではない**（バリアと `connection_limit` が塞ぐのは「重ならなかった場合に緑になる」構成上の穴）。**実装上の落とし穴 1 点**: `OrderStatus` / `PaymentStatus` は `@prisma/client` と `src/lib/types.ts` の**両方に同名で存在**し、値が同一なので Jest は緑のまま `tsc --noEmit` だけが落ちる。SUT (`order.ts`) と同じ `@/lib/types` から取ること。直前: `b0e488b5`（**plan 027 の完了**。Integration を **17 → 20**（`order-placement.test.ts` 6 → 9・スイート数不変）。`src/` は 1 行も変更していない。Scenario 7 = 在庫の実減算量（10 − 4 = 6）、Scenario 8 = **オーバーセルロールバック**、Scenario 9 = **PLATFORM クーポンの端数吸収**。Scenario 8 は `getDeliveryDetailsForStoreByCountry`（`placeOrder` が `$transaction` の**外**で呼ぶ）を seam にして、カート検証通過後・在庫減算前に在庫を 5 → 2 へ横取りし、条件付き `updateMany` の `count === 0` 経路を決定論的に踏ませる（**割り込みを外すとシナリオが落ちることを実測で確認済み** = 空振りテストではない）。ロールバックは Order/OrderGroup/OrderItem すべて 0 件・在庫 2 のまま・カート行も復元、の 3 点で固定。**プラン本文からの数値の逸脱 1 点**: プランは「商品小計 $100.00 → PLATFORM 10% = $10.00」としていたが、実装の割引基数 `cartTotalPrice` は `item.totalPrice`（**送料込み**）の合計なので実測は $120.00 → **$12.00**（既存 Scenario 4 の 110→99 も送料込みで割り引いており実装と整合）。**併せて判明**: 割引率は Int・除数は固定 100 で `Prisma.Decimal` の除算が必ず有限小数になるため、**残差吸収は素朴な各グループ 10% と数学的に一致する**（端数吸収分岐は丸め順序をブレさせないための防御であって数値的な別経路ではない）。したがって Scenario 9 の識別力の本体は「`storeId: null` のクーポンが全グループに適用される」= PLATFORM 分岐の一意な証明と、割引合計のセント一致にある。直前: `c3699b9c`（**plan 026 の完了**。`src/queries/paypal.test.ts` を 40→**56**（**+16**・スイート不変）、`paypal.ts` の Branches を 72.05%（98/136）→ **91.91%**、Statements / Lines / Functions は **100%** へ。**プラン本文の baseline（17 テスト / Branches 28.6%）は plan 059 の capture 検証追加ですでに陳腐化しており、Drift check に実際に引っかかった** —— ケース表は活かしつつ数値目標を実測から再導出した。currentUser / order 取得の catch は共通ヘルパー `requirePayPalUser` / `findOwnedPayPalOrder`（`paypal.ts:127-194`）へ抽出済みで両関数はログ prefix だけが異なるため、**分岐本体は createPayPalPayment 側で通し、capture 側は prefix が切り替わることだけを 1 ケースずつ確認**する（機械的な二重化はしない）。追加は catch 8 + 外側 catch 6（非 OK 応答・非 Error reject・PII 非漏洩）+ 不正応答の防御 2（`purchase_units` / `captures` 欠損時に TypeError へ化けず拒否メッセージへ収束すること。ケース表には無いが 90% 到達に必要な optional-chaining 分岐）。**characterization テストであり、現状の 3 引数ログ形式をそのまま assert している**（tech.md の 2 引数規約への準拠を証明するものではない。本体は 1 行も変更していない）。直前: `70803930`（**plan 029 の完了**。`src/queries/profile.test.ts` を 34→**63** に拡張し（**+29**・スイート不変）、`profile.ts` の Branches を 67.81%（59/87）→ **100%（87/87）** へ。未カバーだったのは 5 関数すべての「currentUser catch」「DB catch」× Error / 非 Error の計 **20 分岐**と、`getUserOrders` / `getUserPayments` / `getUserReviews` の期間フィルタ **3 期間 × 3 関数**。catch 側は「内部エラー詳細を漏らさず関数ごとの汎用メッセージへ縮退する」契約と `console.error` の引数形状（Error なら message + stack の 3 引数 / 非 Error なら生値の 2 引数）を固定。期間フィルタ側は、**既存テストが `gte: expect.any(Date)` までしか見ておらず 3 期間を区別できていなかった**ため、固定時刻を敷いて `subMonths` / `subYears` の実値と突き合わせる形にした（`jest.useFakeTimers({ now })` で実装側の `new Date()` と期待値生成を同一時刻に固定するので TZ 依存もない）。直前: `68f636d5`（**plans 043 / 028 の完了**。043 = VRT ベースライン 3 枚の再撮影〔`2d7ac110` / `15cbca83`〕。cart 2 枚はプラン想定どおりの陳腐化（旧ベースラインは dev サーバー時代の 720px でフッター未描画・Next dev インジケータ写り込み。+351px の増分はフッター描画で、崩れ無しを目視確認）。**checkout はベースライン陳腐化ではなかった** —— Clerk が client-only のため撮影時に本文が空で、`toHaveScreenshot` の安定判定（100ms 間隔 2 枚の一致）が**空画面を「安定」と誤認**していた（3 試行ともバイト同一 150420B ＝ フレークではない）。そのまま固定すると差分検出器にならずマシン速度が変われば恒常 red にもなるため、オペレーター承認のうえ spec に描画完了アンカー（`.cl-signIn-root` + 識別子入力欄の可視）を追加した（当初は `input[name="password"]` を待っていたが、ベースラインは `<SignIn />` の初期表示でパスワード欄が写らないため `62b915a4` で `input[name="identifier"]` へ是正）（プラン本文では spec は Out of scope）。**3 ブラウザフルラン 83 passed / 0 failed / 3 flaky / 37 skipped / 7.4m** で failed ゼロを達成。flaky 3 件（payment-error@chromium / platform-coupon@firefox / layout-chrome@webkit）は VRT 無関係の別事案として残る。028 = `src/queries/country.test.ts` 新設〔`68f636d5`〕で `src/queries/` 20 モジュール中唯一テスト不在だった country.ts を閉じ、CLAUDE.md「Jest ユニットテストの対象は全サーバーアクション」の不変条件を回復（**+4 テスト / +1 スイート**、country.ts 単体 Lines/Branches 100%）。直前: `d939b697`（**plans 044 / 042 の完了**。044 = `globalTimeout` を 1200s→3600s へ引き上げ〔`d7ffbb88`〕。他 Step（ポート隔離 :3100 + `E2E_NO_REUSE`）は `eeb9422b` / `fdc0ee9f` で実装済み。042 = plan 047 が特定した「サインイン後の networkidle 待ちで後続 `goto` がハングする」問題の**除去漏れ 1 箇所**（`stock-decrement.spec.ts`）を除去し Step 5–6 を達成〔`d939b697`〕。**chromium 認証バッチ 9 passed / 0 failed（1.9m）**、**3 ブラウザフルラン 83 passed / 3 failed / 37 skipped / flaky 0 / 5.8m** —— failed 3 件は visual ベースライン陳腐化のみ（plan 043 担当）で認証系はゼロ。フルラン所要は 25.5m→5.8m。これにより **plans 047〜050 / 052 / 053 / 055 の hard dependency が解除**された。直前: `ec32b174`（**plan 047 の実行**。住所未選択チェックアウトエラーの un-skip〔`0c5540c0`〕+ 注文詳細ページの金額明細検証〔`87f6ce05`〕+ 支払い領域の testid 〔`edef9711`〕+ **サインイン後ナビゲーションハングの根本原因除去**〔`ec32b174`〕。**042 が「原因不明の別事案」として残した間欠ハングの正体は `waitForPostSignInSettle`（サインイン後の networkidle 待ち）だった** —— これを通すと後続の商品ページ `goto` がリクエストを発行しないままハングし、per-goto 予算 × リトライを丸ごと消費する（実測: platform-coupon が 3 回連続 2 分 timeout。同時刻にシェルから同 URL を curl すると 0.5〜1.5s で 200 が返りサーバー側は健全、トレースにも当該リクエストが 1 件も現れない）。settle を外すと同一フローが 9〜11s で完走する（settle を使わない `a11y/checkout.spec.ts` が唯一安定していた理由でもある）。`gotoStable` は**残す** —— Firefox はサインイン後のソフトリダイレクトが goto に割り込んで `NS_BINDING_ABORTED` を投げるため、素の goto では 3 ブラウザ実測で flaky になる。**3 ブラウザ実測: 9 passed / 6 skipped / 0 failed / flaky 0**。直前: `5f2143b3`（**plan 042 + plan 051 の実行**。042 = E2E signIn ヘルパーの Clerk UI ドリフト修復〔`235754b8`〕+ 壊れた locator の 4 spec 置換〔`5f635485` / `a5816c0c`〕+ フッター SVG の実 WCAG 違反是正〔`c25a8768`〕。**サインイン起因の失敗はゼロになった**（chromium バッチ 7 passed / a11y 4 spec 全 green）。ただし stock-decrement / platform-coupon は**サインイン成立後**の商品ページ `goto` が 30s×3 でタイムアウトして落ちる —— これは `scripts/e2e/run-local.sh` のヘッダーが記録済みの「重い注文フローの間欠 120s ハング（実行ごとに落ちるテストが移動する）」と一致する**別事案**で、plan 042 の STOP 条件「locator 以外の失敗モード」に該当するため 042 は**部分完了**扱い。051 = 国選択セレクタの cookie 往復 E2E を新規追加〔`5f2143b3`〕。直前: `b799efee`（CodeRabbit ローカルレビュー 19 コメントの精査対応・**第 12 弾** — 全 19 件を実測でリポジトリに突き合わせ、**確認済み 19 / 誤検知 0**〔生成器 1 / 統計同期 2 / ドキュメント 16〕。**生成器 1 件**（Red → Green を 2 対・別コミットで実測）: `scan-tests.ts` が**文字列リテラル・テンプレート・コメントの中身をコードと同じに扱っていた**。走査対象コードをフィクスチャ文字列として持つファイルが実件数の数倍に膨らみ、**`scan-tests.test.ts` 自身が実行時 21 件に対しダッシュボード 81 件**という自己矛盾を起こしていた（`hasSkip` も同じ理由で false positive）。`findMaskedSpans` で非コード範囲を列挙し一致位置で捨てる形へ〔`6e12e3fe`/`50b1814a`・`239a24cb`/`b799efee`〕。ダッシュボードは `scan-tests.test.ts` **81→24**・`size.test.ts` **9→8**（後者は `:144` の**コメントアウトされた** `it(`）で是正。**統計同期 2 件**: 11 巡目の内訳のうち `webhooks/route.test.ts` は **20→21 ではなく 19→20**（差分 +1 は正しく絶対値だけ過大）、`scan-tests.test.ts` の 17→21 は実行時としては正しいがダッシュボード 81 と割れていた。**issues が減らない構造的原因**も併せて記録 → `plans/ADVISOR_STATE.md`。直前: `6c101005`（CodeRabbit ローカルレビュー 31 コメントの精査対応・第 11 弾 — 全 31 件を実測でリポジトリに突き合わせ、**確認済み 31 / 誤検知 0**〔実コード 2 / 生成器 1 / 統計同期 4 / ドキュメント 24〕。**実コード 2 件**（いずれも Red → Green を別コミットで実測）: (1) `webhooks/route.ts` の `user.deleted` が `rawUserId.trim() === ""` で**検証しながら未 trim の値**を絞り込みキーに束縛していた。`"  user_x  "` は検証を通過し、trim 後なら一致するユーザーの SupportTicket PII 秘匿と削除が **0 件ヒットのまま 200**で完了する（GDPR 消去が黙って空振りする）。検証した値と同じ値を使う形へ〔**+1**・`5c1ec584`/`0f79be70`〕/ (2) `paypal.ts` の capture 相関検証が `purchase_units[0].custom_id ?? capture?.custom_id` で束ねられており、**`??` が最初の非 nullish で短絡**するため外側が `orderId` と一致すると capture 側の `custom_id` は**一度も検査されない**。capture オブジェクトこそ実際の資金移動を表すため、外側だけ自注文に相関し内側が別注文を指す応答が Paid 確定まで到達しうる。直上コメントの「両方を許容する」は「どちらの位置に載っていてもよい」の意図であり「先に見つかった方だけ見る」ではないので、**存在する custom_id の全一致**を要求する形へ（両方欠落時の拒否・throw 位置・throw 文言は不変。位置差の吸収は別テストで維持を固定）〔**+2**・`c8e0327b`/`0d82f790`〕。**生成器 1 件**: `scan-tests.ts` が `it.each(<識別子>)` を 0 件と数え、`order-settlement.test.ts` が静的 6 / 実行時 14 と **8 件乖離**していた。同一ファイル const と `@/`・相対パスの**単一ホップ** import を解決する分岐を追加（多段 re-export・動的生成は追わず 0 のまま = 過大計上しない fail-safe）〔**+4**・`49627a59`/`6c101005`〕。**docs 24 件**は plans/audit の整合修正。直前: `98f309f2`（SonarCloud 重複解消リファクタ + 負の配送料バグ修正 — PR #164 の Quality Gate が `new_duplicated_lines_density` **3.9% > 3%** の 1 条件だけで ERROR になっていた（`new_coverage` 86.1% ほか 5 条件は OK。失敗しているのは SonarCloud アプリが直接送る Check であり、ワークフローの `continue-on-error: true` の管轄外なのでコードを直す以外に緑にできない）。Sonar API から重複ブロックの実レンジを取得し 3 クラスタに整理: **A** `user.ts` 内部 96 行〔`db.product.findUnique` の include + 3 条件検証が 4 重複、割引単価、`getShippingDetails` + 配送料 switch + 戻り値の組み立て〕/ **B** `stripe.ts:334-358` ↔ `paypal.ts:482-506` 25 行×2〔P2025 後の再読 settled 判定・差分はログ prefix のみ〕/ **C** `paypal.ts:108-160` ↔ `226-278` 53 行×2〔`currentUser()` + 所有権付き `order.findUnique` の前段・差分はログ prefix のみ〕。**A/C は同一ファイル内のモジュールプライベートヘルパーとして抽出**（`"use server"` が要求するのは export が async であることだけで、非 export の宣言は既存の `ORDER_TRANSACTION_OPTIONS` / `notSettled` と同じくファイル内に置ける）。`src/lib/` へ出さないのは、`user.test.ts` の `jest.mock("./product")` 構成をそのまま流用でき、かつ新規ファイルの未カバー行で `new_coverage` を薄めないため。**B のみファイル跨ぎのため `src/lib/order-settlement.ts` を新設**（`payment-status.ts` と同じ理由・同じ配置）。抽出時に守った契約: 2 種類の not-found メッセージ〔詳細版 / 簡易版〕を統一しない、PayPal の `"Order not found"`（ピリオド無し）と Stripe の `"Order not found."`（有り）を統一しない、`error.message ===` の文字列比較、`where: { id, userId }` の形、ログ文字列のバイト一致。**さらに重複コード内の既存バグを 1 件修正**: ITEM 方式の配送料が `validQuantity === 1 ? fee : fee + extra * (validQuantity - 1)` で個数をクランプしておらず、在庫切れ（または改ざん payload の `quantity: 0`）で `validQuantity === 0` になると `(0 - 1) = -1` で **`fee - extra` = 負の配送料**が算出され、`saveUserCart` では `CartItem.shippingFee` / `Cart.total` へ、`placeOrder` では `OrderItem.shippingFee` と `OrderGroup` / `Order` 合計へ伝播していた。`product.ts` の `getProductShippingFee` はこの経路を `Math.max(0, quantity - 1)` で丸めており、**「重複を消すために既存ユーティリティへ寄せる」と金額計算の挙動が変わる**ため寄せずにインラインを逐語抽出し、集約後の 1 箇所を Red → Green で修正した〔`14d8bbab`（Red・実測 `shippingFee: "7"`）→ `98f309f2`（Green・`10`）〕。修正後は `updateCheckoutProductWithLatest` を含む 3 経路の配送料計算式が一致する。**+16**（`order-settlement.test.ts` 新規 14〔確定/未確定ステータス・注文不在・`userId` で絞らないクエリ形状に加え、**抽出前は stripe/paypal 双方でテストが 1 件も無かった** `catch (reReadError)` 分岐を Error / 非 Error の両方で駆動。新規ファイルのカバレッジは statements/branches/functions/lines すべて 100%〕+ `user.test.ts` 2〔saveUserCart / placeOrder の在庫 0 特性テスト〕）。**スイート +1**。全 9 コミットを 1 論理単位ずつに分割し、各コミット時点で `bunx tsc --noEmit` / `bun run lint` / 対象 Jest が緑であることを確認。フル検証: unit 1819 pass / integration 17 pass（testcontainers 実 DB）/ `bun run build` 成功。直前: CodeRabbit ローカルレビュー 22 コメントの精査対応（第 10 弾 — 全 22 件を実測でリポジトリに突き合わせ、**確認済み 21 / 誤検知 1**〔実コード 2 / コード内 docs 1 / ドキュメント 18 / 統計同期 3、誤検知 1〕。**実コード 2 件**（いずれも Red → Green を別コミットで実測）: (1) `fetchPayPal` が `Response` を返し `finally` の `clearTimeout` が**ヘッダ受信時点**で走っていたため、3 箇所の呼び出し側の `await response.json()` / `.text()` が**タイムアウト予算の外**にあった。本文が滞留すると server action が無期限に待つ。ヘルパー内で `text()` まで読み切ってから解放し `{ ok, status, body }` を返す形へ（**呼び出し側が予算外の読み取りを書けなくなる**）〔**+1**・`bf725e39`/`9f614860`〕/ (2) `placeOrder` の `$transaction` が Prisma 既定の maxWait 2s / timeout 5s に委ねられていた。住所行の `SELECT … FOR UPDATE` を保持する時間の上限＝並行チェックアウトの待ち時間の上限でもあるため、`ORDER_TRANSACTION_OPTIONS`（maxWait 5s / timeout 20s）で明示〔**+1**・`9ebbe104`/`af786cb5`〕。**誤検知 1 件は修正せず記録** —— `webhooks/route.test.ts:341-344` の「`supportTicket` / `user` が二重宣言で `Duplicate identifier`」は、実ファイルでは各 1 回のみ（`grep -c` = 1）で `bunx tsc --noEmit --pretty false` も **exit 0 / 出力 0 行**。提示された diff の削除行は存在せず、適用すれば `route.ts:137-149` が使う正しい型宣言を壊す。**docs 19 件**: 実行可能ゲート 4 件〔004 の js-cookie が**宣言レンジ**にしか当たらず `sort` で fail open だった件、042 の必須 `expect(passwordInput).toBeVisible()` が**存在検査されていなかった**件、044 のゲートが `reuseExistingServer` の**極性**を見ず `!!` 反転でも合格し実行行検出がコメントにも当たる件、ja/009 の構造ゲートが 1 行化でコメント/デッドコードも合格させる件 — **4 件とも合格側 exit 0 / 違反注入側 exit 1 を実測**〕/ 自己矛盾 4 件〔003 en·ja の TOCTOU「RESOLVED」と末尾の実 DB 未検証、021 の (B)×(P3)〔B は記録が主処理の**後**なのでロールバック対象が無い — 表から削除し P1 へ吸収〕、050 の禁止した `response?.status()` が処方として残存、057 の `DONE (1 criterion pending)`〕/ 参照先ドリフト 3 件〔013 の browse URL がパス形とクエリ形で割れ（実装は searchParams 単一ルート）+ `findFirst`→**`findUnique`** 誤記、041 の coupon.ts 行参照が全面的に 50〜100 行ずれ、findings-06 の Next 現行版 `~16.2.12` が README へ未伝播〕/ 契約の穴 2 件〔029 の `process.env.TZ` 復元漏れ、063 の**件数一致では行集合の同一性を保証できない**〔digest 突合を追加〕〕/ 現況の分解 1 件〔findings-13 TESTS-02 を決済経路ごとに — Stripe は `$transaction`+CAS で**解消済み**、PayPal は `:399`/`:441` が**別書き込みのまま**〕/ 完了形の誤記 1 件〔044 の `E2E_NO_REUSE` は config にも run-local.sh にも**存在しない**のに「閉じてある」と断言〕/ SSOT 統一 1 件〔D2 コストが render-html.ts=S / 他 2 台帳=M で割れ〕/ 本ラウンドの統計同期 3 件）。直前: CodeRabbit レビュー 15 コメントの精査対応（第 9 弾 — 全 15 件を実測でリポジトリに突き合わせ、**確認済み 14 / 誤検知 1**〔実コード 2 / ドキュメント 13〕。**実コード 2 件**（いずれも Red → Green を別コミットで実測）: (1) `capturePayPalPayment` が retrieve と capture で**単一の 10s タイマー / AbortController を共有**しており、retrieve が 9.9s かかると capture は残 0.1s で abort され得た。さらに `clearTimeout` が capture 後にしか無く、検証不一致の throw 経路ではタイマーが未解放だった。各 fetch を「controller 生成 → fetch → `finally` で `clearTimeout`」のヘルパーに閉じ込め、**どの経路で throw しても解放される**形へ〔**+2**・`ee61b9bb`/`5ac6022b`〕/ (2) `placeOrder` の住所所有権チェックが `tx.shippingAddress.findFirst`（素の SELECT）で**行ロックを取らず**、コード内コメント自身が「閉じきってはいない」と認めていた。`$queryRaw` + `SELECT … FOR UPDATE` へ置換し、`userId` 付け替えの `FOR NO KEY UPDATE` と競合させて Read Committed 下でも並行付け替えを commit までブロック。ロック取得後の述語再評価（EvalPlanQual）により、先に付け替えが commit していた場合は行が脱落して throw する〔テスト数不変・**書き換え**・`4600451c`/`f77dafd8`〕。**docs 13 件**: 実行可能ゲート 2 件〔004 の js-cookie 検証が**宣言レンジ**にしか当たらず解決済みエントリを構造的に取りこぼしていた件、ja/011 の env ゲートがプロセス置換のため `sh` では**検査本体が走る前に構文エラー**で落ちる件 — 実行シェル要求を明記〕/ 追跡先の実体化 1 件〔031 が「README の deferred に残す」と宣言しながら README に該当記載 0 件だった `updateOrderGroupStatusAsAdmin` の並行二重復元を実際に起票。placeOrder の実 DB 並行検証も同時に deferred 化〕/ 自己矛盾 4 件〔003 の TOCTOU 解決状態、057 Step 1 の旧バージョン抽出コマンド、061 の「five headers」と環境別 4/4・5/5 ゲート、063 の完了条件と Step 5 の二条件判定〕/ 参照先誤り 1 件〔059 の `isSettledPaymentStatus` は `src/lib/payment-status.ts`〕/ 根拠追記 2 件〔ja/002 の enum 代入可否を型定義 + `tsc --noEmit` exit 0 で裏付け、004 の検証日時を全 3 箇所で統一〕/ 表記統一 1 件〔findings-13 の SHA 略記を台帳と同じ 7 桁へ。**指摘の前提「誤った SHA」は誤検知**で、同一コミットの 8 桁略記だった〕/ 履歴遡及 1 件〔PROGRESS.md が第 4 弾で終端していたため第 5〜8 弾を backfill〕/ 本ラウンドの統計同期 1 件）。直前: `1201b907`（CodeRabbit レビュー 20 コメントの精査対応・第 8 弾 — 全 20 件を実測でリポジトリに突き合わせ、**確認済み 20 / 誤検知 0**〔実コード 3 / ドキュメント 17〕。**実コード 3 件**（いずれも Red → Green を別コミットで実測）: (1) `db-retry.ts` の `baseDelayMs` が**有限の巨大値を素通し**しており、`2 ** 48` 以上で `randomInt` が catch の内側から `ERR_OUT_OF_RANGE` を投げ、**投げ返すはずの P2034 が化けて**下流の `isSerializationFailure` 判定が空振りしていた（第 7 弾で閉じた `ERR_INVALID_ARG_TYPE` と同一欠陥クラスの残存）。`MAX_BASE_DELAY_MS = 60_000` の上限クランプで閉塞〔`it.each` 2 行 + 1 = **+3**・`82b38c02`/`8159bb2c`〕/ (2) `stripe.ts` の canceled 後の再作成キーが `randomUUID()` 由来で**呼び出しごとに別キー**になり、**canceled を観測した後だけ二重送信防御が消えて**いた（`4111e0ad` が閉じたはずの経路の裏口）。**観測した canceled intent の id** を鍵に導出し上限 3 回のループへ変更〔**+2**・`5aa5f6f8`/`f9d7a50f`〕/ (3) `capturePayPalPayment` が capture を**先に**叩き `custom_id` / `amount` / `currency` を**課金後**に検証していた（検証で throw しても金は既に動いている）。settled ガード直後・capture 前に `GET /v2/checkout/orders/{id}` を挿入して相関・金額・通貨を検証。既存の capture 後検証は**二重防御として残す**〔**+4**・`7138512c`/`71104354`〕。**docs 17 件**: 実行可能ゲート 3 件〔004 の js-cookie 検証が `@clerk/shared` の**宣言レンジ**にしか当たらず 0 件でも `sort` が exit 0 を返す fail open だった件、042 の散文だけが `&&` 形を推奨し同ファイルの否定注記と矛盾していた件、ja/011 の audit スキャンが `\|\| true` で常に exit 0 だった件 — **3 件とも合格側 exit 0 / 違反注入側 exit 1 を実行して確認**〕/ 完了ゲート昇格 3 件〔013 の旧→新 URL 対応表を親内一意でも必須化、020 の checkout 再検証・再計算 3 契約、022 の `evaluationAt` と認可スナップショット〕/ 自己矛盾 5 件〔021 の (A)×(P1) を「条件付き成立」へ、029 の期間境界 TZ 契約〔実測: `America/New_York` では `subMonths(2026-07-01T00:00:00Z, 6)` = `2025-12-31T01:00:00Z`〕、032 の一時制約 ADD 直前 `DROP IF EXISTS`、041 の admin 経路 P2002 変換も独立検証、063 の未解決 zero-total リストを Step 3 の承認成果物へ〕/ 根拠精度 2 件〔003 en·ja の住所 TOCTOU を **RESOLVED → 緩和済み（窓を最小化）** へ格下げ — `tx.shippingAddress.findFirst` は素の SELECT で行ロックを取らず、削除は FK の `FOR KEY SHARE` が閉じるが `userId` 付け替えは `FOR NO KEY UPDATE` で競合しないため窓が残る。027 のモック配置を「規約違反」ではなく「規約の適用外」として実測根拠付きで明文化〕/ 数値是正 2 件〔ALB の `routing.http.xff_client_port.enabled`、`coupon.ts` の 10 export 中 7 適用・未適用 3〕/ 本ラウンドの統計同期 2 件）。直前: `8622d77a`（第 7 弾 — 全 20 件を実測でリポジトリに突き合わせ、**確認済み 20 / 誤検知 0**。**実コード 6 件**: (1) `src/app/api/webhooks/route.ts` の `user.deleted` が `(evt.data as { id: string }).id` を無検証キャストしており、Clerk の `DeletedObjectJSON.id` が optional なため `undefined` 時に `updateMany({ where: { userId: undefined } })` = **全 SupportTicket の PII 上書き**、`deleteMany({ where: { id: undefined } })` = **全 User 削除**へ退化していた。tx の前で早期 400 に閉塞〔`it.each` 4 行 = +4・`4e4534d1`/`87a766df`〕/ (2) `retryOnSerializationFailure` の `maxAttempts` が `?? DEFAULT` で `0` / `NaN` を弾けず、ループが 1 周も回らず `throw undefined` になり下流の `instanceof Error` 型ガードが全崩れしていたのを下限 1 でクランプ〔+5・`333c5e26`/`cd6cc148`〕/ (3) `toggleCouponActive` の `'Coupon not found.'` が `isDomainError` の `domainMessages` に無く汎用文言で上書きされていた〔既存 `toThrow("Coupon not found.")` は部分一致で空振り。完全一致アンカー化 +1・`f36716a2`/`4c0d2bbc`〕/ (4) admin クーポン編集モーダルの `getCouponAsAdmin` reject が未処理で、seller 版には既にある try/catch + destructive toast + `setClose()` が admin 版だけ未適用だった〔+5・`563488b3`/`31b3f269`〕/ (5) `E2E_USE_DEV` の判定が spec と `playwright.config.ts` の両方で真偽値判定のままだったのを `isEnabled`（`trim()==="1"`）へ統一〔破壊的: `=true` / `=0` は以降 dev 起動として効かない・`7d6347df`/`37e1603b`〕/ (6) `scan-tests.ts` の `BLOCK_PATTERN` が本体内の**注釈形** `test.skip(cond, reason)` も 1 ケースとして計上し、E2E 静的値が注釈形 16 件ぶん過大だった〔宣言形／注釈形を第 1 引数の文字列リテラル有無で判定・+2・`83673910`/`88f4eee5`〕。**docs 13 件**は specs/plans/audit の整合修正〔CAS の P2025 と直列化異常の P2034 の分離、COVERAGE_REPORT 履歴の日付逆順、003 の CORRECTNESS-05 をコード完了 + backfill 残件へ分離、005 の空振り `rehydrate()` と 006 の無条件ガード解除に**スニペット直上の阻止マーカー**を設置、021 の Q4 を実行モデル × 永続化方式の 2 軸へ分離、023 / ja/009 の不在ゲートが `&&` 短絡で**合格時に exit 1** を返していた件、ja/009 のゲート正規表現が日本語で**正しい実装に対し偽 FAIL** だった件、060 の id 意味論確定、plan 063 起票の台帳反映 2 件、findings-06 の 057 保留 criterion、findings-13 の PayPal CAS と Stripe 金額単位の混同〕。**+1 起票**: `applyCoupon` が `isDomainError` 未適用で domain error 6 種を上書きする件を `08-open-questions.md` に記録〔コード変更は別プラン〕）。直前: `502be0ee`（CodeRabbit レビュー 17 コメントの精査対応 — 全 17 件を実測でリポジトリに突き合わせ、**確認済み 17 / 誤検知 0**。実コード 3 件: `coupon.ts` の `get`/`delete` 系 5 関数で `Please provide coupon ID.` の意図的 throw が catch に上書きされていた欠陥を既存 `isDomainError` の素通しで閉塞〔既存 5 アサーションが部分一致のため欠陥を検出できておらず、完全一致アンカーへ変更・`8a648282`/`2cc7368d`〕/ seller クーポン編集モーダルの `getCoupon` reject が未処理でユーザー通知もモーダル終了も無かった欠陥を try/catch + destructive トースト + `setClose()` で閉塞〔新規スイート +7・`e1a8b710`/`8df613c1`〕/ `scan-tests.ts` の `EACH_PATTERN` が `it.skip.each` / `test.only.each` を拾わずテーブル行数を丸ごと欠測していた欠陥を修飾子列挙で修正〔fixture 5 件中 4 件が不可視・回帰 +1・`73d68b57`/`15ff8eb2`。リポジトリ内に該当構文は 0 件のため集計値は不変〕。docs 11 件は plan/audit の整合修正〔018 の RMA 冪等キーと複数 OrderItem の矛盾・壊れた括弧構造、021 の送信/記録失敗の未分離により Q4 の選択肢が全滅していた件、042 の静的ゲートが折り返しシグネチャで空抽出→vacuous PASS していた件、063 の承認件数突合が実行不能だった件と zero-total 注文の NULL ratio が補正も検出もされない件、findings-06 の解決済みと撤回済みスケッチの同居、findings-18 の jodit のdirect/transitive 混同、009 の検証ゲートとリテラル 200 の不一致、011 の Clerk URL 変数の未訂正、ja/README の plan 063 未反映〕）。直前: `8637bca5`（CodeRabbit レビュー 19 コメントの精査対応 — 見出しのみ判明していた 19 件を実測で検証し、**確認済み 18 / 誤検知 1** に仕分け。実コード 2 件: `upsertCoupon` / `upsertCouponAsAdmin` の入力検証・重複コードエラーが catch の `Error occurred while ... : ${message}` で上書きされフォームに返せていなかった欠陥を、既存 `isGuardError` と同型の `isDomainError` 素通しで閉塞〔回帰 +4・`76a96296`/`fba1cf46`〕/ `scan-tests.ts` の `BLOCK_PATTERN` が `test.skip(` を拾わず E2E ケース数を 23 と報告し SSOT の 37 と 14 件乖離していた欠陥を修正〔回帰 +3・`ff9f5c28`/`8637bca5`〕。**誤検知 1 件は修正せず記録** — 「`byDomain` に `api-routes` が無くドメイン合計 187」は実測と不一致で、直近 5 バージョンすべてに `api-routes:6` が存在し合計 193 = `totalTestFiles`。指摘値 187 はちょうど `193 - 6`。docs 側の内訳は続くコミットで反映）。直前: `7d063a10`（CodeRabbit レビュー 46 コメントの精査対応 — 実コード 3 件: App Router の route.ts から named export `REDACTED_PII` を `src/lib/pii.ts` へ退避〔route の型検証に引っかかる形・`bfcf52ba`〕/ Stripe 冪等キーが canceled 済み intent を返し続け、当該注文がその金額で恒久的に決済不能になる経路を閉塞〔canceled 観測時のみ別キーで再作成・回帰 +2・`4111e0ad`/`96856785`〕/ `place-order.test.tsx` の `mockImplementation` throw が後続テストへ漏れるのを `mockReset()` で遮断〔`7fe521e5`〕。docs 12 件は plan/audit の整合修正〔検証コマンドのスコープ・POSIX 互換化、latch による並行性の過大主張、findings-18 の値割れ 4 件、Round 13 の計画範囲と 057 の完了状態、ALB の XFF append 前提〕。**未対応**: `next` 16.2.11 bump はネットワーク不可の環境のため保留、「未来日付」系 10 件は 2026-07-26 を超える日付が実在せず偽陽性と判定し変更なし）。直前: `b23c1676`（CodeRabbit レビュー 24 件の残 8 件対応 — 本文が無く保留していた「E: 判断不能」区分を全件確定。実コード 2 件: HSTS の付与判定を環境名から**配信先シグナル**へ移行し、`NODE_ENV=production` だけの self-host staging へ 2 年 max-age が記録されるのを閉塞〔`HSTS_ENABLED` 導入・E2E ゲートも同期・`a1f00f79`/`dcc41fe6`〕/ `useCartStore` の persist ラウンドトリップ検証 +3〔plan 005 の「リロード後に復元される」未検証ギャップを閉塞。元バグ再注入で非空振りを確認・`4531d574`〕。他 6 件は plan/audit doc の整合修正〔011 の env ゲートが superset ではなく 13 変数しか見ておらず `CLERK_SECRET_KEY`/`DATABASE_URL` 欠落を検出できなかった件、015 の ts_rank seek 述語が PostgreSQL で実行不能だった件、021 のベンダー固定と重複配信の絶対保証、027 の jest.mock factory 巻き上げ、findings-06 の現行値と履歴の混在〕）。直前: 2026-07-26 CodeRabbit レビュー 24 件対応 — plan/docs/specs の整合修正 22 件〔検証コマンドの誤検出・並行性証明の不備・撤回済み記述の残存・監査台帳の値割れ等〕に加え、実コード 2 件: `CouponFormSchema.discount` へ `.int()` を追加し小数が Int 列へ到達するのを閉塞〔回帰 +2・`11d68f89`/`6d0cd9dc`〕/ HSTS の `includeSubDomains; preload` を環境名判定から明示 opt-in（`HSTS_INCLUDE_SUBDOMAINS` / `HSTS_PRELOAD`）へ分離し、self-host staging 等での非可逆な preload 誤発火を防止〔`10b3fd1f`/`66ed444f`〕）。直前: 2026-07-24 CodeRabbit ローカルレビュー対応 — plan/audit doc 21 件の整合修正に加え、実コード 3 件のセキュリティ修正〔HSTS を本番ドメイン限定化（Vercel preview 毒回避）`2960381` / `placeOrder` の住所所有権 TOCTOU を tx 内再検証で閉塞 `b95f847` / `user.deleted` webhook で SupportTicket PII を削除前に秘匿化（GDPR 消去）`7e3e507`〕・回帰テスト +2）。直前: 2026-07-18 CodeRabbit 指摘対応 Phase 1 完了 — Stripe PaymentIntent の冪等キー付与 [`ae585a7`] / 決済状態更新の CAS 化（webhook との退行レース解消）[`c77cdd7`] / `saveUserCart` の P2034 再試行 [`d8108b5`/`e5903c8`] / `emptyCart()` 失敗時の注文遷移継続 [`f4aba5f`] / 空 `it.each([])` の計数是正 [`b5eb8d1`]）。直前: improve Round 13 P2 プラン完了 — plan 061: レスポンス強化ヘッダ 5 種を全ルートへ付与 + E2E 厳密値ガード [`4e2c4fa`/`afd22b3`] / plan 062: `index-products` の生 `error.message` 漏洩停止 + `error: any` 撤去 [`5ef0dfe`/`492e9ac`]）。その前: Round 13 P1 全 4 プラン完了 — plan 057: `next` を ~16.2.10 へ bump [`10e35f3`] / plan 058: `getCoupon` IDOR read 修正 [`15c9a96`] / plan 059: PayPal capture の金額/相関/通貨検証 + settled ガード [`6a31da1`] / plan 060: クーポン mutation のサーバー側 Zod 検証 — discount>99 → 負値 total 防止 [`c67b833`]

---

## 現在の実装状態サマリ

### テスト統計（Jest は 2026-08-08 実測・E2E は 2026-08-04 フルラン実測。lcov カバレッジは 2026-08-04 実測）

> **記載ルール（2026-07-10 整理）**: このテーブルは**最新値のみ**を保持する。増減の経緯・
> 機能実装の詳細ナラティブは [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) が
> アーカイブ先（日付・コミット付きで全件記録済み）。本テーブルのセルに履歴長文を追記しないこと。

| 指標 | 値 |
|------|-----|
| Jest テスト総数 (unit/component) | **1891** passed / 1894 total / **178 スイート**（177 passed + 1 skipped suite）。2026-08-08 実測（`bun run test`。SonarCloud PR #169 の New Code カバレッジ 70% を受けて `src/app/api/webhooks/stripe/route.test.ts` に非 USD 拒否のケースを追加し **+1**・スイート不変）。直前は 1890 passed / 1893 total・2026-08-04 実測（plan 028 で `src/queries/country.test.ts` を新設し +4 テスト / +1 スイート、plan 029 で `profile.test.ts` を 34→63 に拡張し +29、plan 026 で `paypal.test.ts` を 40→56 に拡張し +16。029/026 はスイート数不変）。増減の経緯・実測履歴は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) |
| カバレッジ全体（lcov 2026-08-04 実測・plans 028/029/026 後） | Statements **67.71%** (5862/8657) / Branches **48.00%** (2498/5204) / Functions **55.48%** (921/1660) / Lines **66.79%** (5279/7903)（前回 66.8 / 46.86 / 55.39 / 65.81 — Statements +0.91 / Branches +1.14 / Functions +0.09 / Lines +0.98。内訳は plan 029（`profile.ts` Branches 67.81%→**100%**）と plan 026（`paypal.ts` Branches 72.05%→**91.91%**・Statements/Lines/Functions **100%**）が大半で、plan 028 の country.ts は 19 行の小モジュールなので寄与は小さい。Functions がほぼ動かないのは 3 プランとも既存関数の分岐を埋める作業で新規関数を増やさないため） |
| Jest Integration テスト総数 | **57** / **7 スイート**（`cart-checkout.test.ts` 11 + `order-placement.test.ts` **9** + `order-lifecycle.test.ts` **8** + `webhook-payment.test.ts` **12** + `search-products.test.ts` **9** + `product-deletion.test.ts` **4** + `shipping-address-default.test.ts` **4**）。`bun run test:integration`（testcontainers + 専用 config）で実行、`bun run test` の集計外。**2026-08-09 実測: 57/57 pass**（plan 037 で `shipping-address-default.test.ts` を新設し **+4 / スイート +1**。default フラグの不変条件 —— 更新経路は解除が効くが**新規経路はスキップされ 2 件併存する既知バグ TESTS-21 の characterization**〔`TODO(characterization)` タグ付き・修正時に 1 へ反転〕・他ユーザー住所 id の上書きが P2002 で reject される IDOR 防御の実体）。**同日 53/53 pass**（plan 036 で `product-deletion.test.ts` を新設し **+4 / スイート +1**。`deleteProduct` の FK セマンティクス —— CASCADE 9 種の全件消滅〔孫の FreeShippingCountry を含む〕・Review による **RESTRICT（P2003）** の characterization・失敗時に子が 1 件も欠けない原子性・所有権ガードの副作用なし）。**同日 49/49 pass**（plan 033 で `search-products.test.ts` を新設し **+9 / スイート +1**。tsvector 全文検索の raw SQL を実 DB で初めて実行 —— トークナイザーの小文字化・`ts_rank` 降順・`plainto_tsquery` の AND 意味論・空白トリムと `q` 欠落の 2 分岐・パラメータ化の安全性・従属の `ORDER BY RANDOM()`。**本ファイルのみ docblock で `testEnvironment: node`**〔plan 032 と同じ理由〕）。**2026-08-08 計上: 40**（`a4d01b27` が `webhook-payment.test.ts` に非 USD 拒否の Scenario S8 を追加し **+1 / スイート不変**。Stripe 8 + PayPal 4。ダッシュボードの静的走査と一致。**フルラン実測は 2026-08-04 の 39/39 pass が最新**で、S8 追加後の実行実測はまだ取っていない）。**2026-08-04 実測: 39/39 pass**（plan 032 で `webhook-payment.test.ts` を新設し **+11 / スイート +1**。Stripe 7 + PayPal 4。**本ファイルのみ docblock で `testEnvironment: node` に上書き**している —— jsdom には Fetch API の `Request` / `Response` が無く Route Handler を直接呼べないため。config は無変更）。**同日 28/28 pass**（plan 031 で `order-lifecycle.test.ts` を新設し **+8 / スイート +1**。キャンセル・返金の親子連動と在庫復元、二重キャンセルの冪等性〔逐次 + 並行ディスパッチ〕、group 単位キャンセルの親集約、両 admin 関数の認可ガード。**`updateOrderPaymentStatus`（CAS 済み）と `updateOrderGroupStatusAsAdmin`（read-then-act・未対応）は区別すること** —— 並行安全性を固定しているのは前者のみ）。**同日 20/20 pass / 4.054s**（plan 027 で order-placement に Scenario 7 = 在庫の実減算量 / Scenario 8 = オーバーセルロールバック / Scenario 9 = PLATFORM クーポン端数吸収 の 3 本を追加。直前は 17 / order-placement 6）。**2026-07-11 実測: 17/17 pass / 4.779s**（Round 4 時点の「Docker 停止により未実測」を解消）。**同日 Round 6 冒頭に 17/17 pass / 4.008s、Round 7 冒頭に 17/17 pass / 4.473s を再実測**（いずれもソース無変更の確認込み）。**2026-07-17: ダッシュボードの `integration × queries` が 14 と表示され本行の 17 と乖離していた問題を解消**（`scan-tests.ts` が `it.each` を 0 件と数えていた静的走査の欠陥。`c1be6d7` で展開対応し 14→17 で一致） |
| Jest スナップショット | **127**（`tests/component/ui/__snapshots__/`・49/49 shadcn/ui プリミティブカバー） |
| Playwright E2E（全プロジェクト集計） | **41 tests/browser**（17 files・3 ブラウザ計 **123**）。**17 files の内訳 = E2E メイン 11 + Visual 2 + a11y 4**（`testDir` が `tests/e2e` 単一のため `--list` は 3 系統を合算する。「E2E メイン 11」の区分は [`COVERAGE_REPORT.md §1`](./COVERAGE_REPORT.md) の定義と一致し、Visual / a11y の内訳は下 2 行が担当）。E2E メインの **11 スペック**（purchase-flow / seller-onboarding / payment-error / search-filter / mobile-responsive / platform-coupon / stock-decrement / country-selector / messages / layout-chrome / security-headers）。Clerk 依存 spec は `CLERK_SECRET_KEY` 未設定時に自動 skip。2026-08-04 実測: 全プロジェクト `bunx playwright test --list` が `Total: 123 tests in 17 files`、`--project=chromium` / `firefox` / `webkit` が**各 41**（3 ブラウザ計は掛け算ではなく実測値。projects は 3 つとも同一 `testDir` を走査するため各ブラウザで件数が一致する）。**2026-08-04 フルラン実測（plan 043 完了後・`bash scripts/e2e/run-local.sh`）: 83 passed / 0 failed / 3 flaky / 37 skipped / 7.4m**。**failed はゼロ**（042/044 完了時点で残っていた visual 3 件を plan 043 が解消）。flaky 3 件（payment-error@chromium / platform-coupon@firefox / layout-chrome@webkit）はいずれもリトライで pass しており **VRT とは無関係の別事案**として残る。所要は従前ベースライン 25.5m から短縮（サインイン後ハングの除去でリトライ消費が消滅）。増減の経緯・実測履歴は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) |
| Playwright Visual | **2 スペック**（cart / checkout）・**3 テストとも passed**（chromium 限定）。2026-08-04 に plan 043 で再撮影して解消（連続 2 回 green で再現性確認済み）。cart 2 枚は旧ベースラインが dev サーバー時代の 720px（フッター未描画・Next dev インジケータ写り込み）だった陳腐化。**checkout はベースライン陳腐化ではなかった** —— Clerk が client-only のため撮影時に本文が空で、`toHaveScreenshot` の安定判定（100ms 間隔 2 枚の一致）が空画面を「安定」と誤認していた。spec 側に描画完了アンカー（`.cl-signIn-root` + `input[name="identifier"]` の可視）を追加して解決（`15cbca83`、locator は `62b915a4` で `password` → `identifier` に是正 —— ベースラインは `<SignIn />` の初期表示＝識別子入力ステップで、パスワード欄は写っていない） |
| Playwright a11y | **4 スペック**（sign-in / seller-apply / checkout / profile）・**4 spec すべて passed**。2026-08-03 実測（`bunx playwright test tests/e2e/a11y --project=chromium`）。**2026-08-04 の 3 ブラウザフルランでも全て passed を再確認**。増減の経緯・実測履歴は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) |
| 型エラー | **0 件** |
| Skipped テスト | **3 件**（idempotency suite 3 件 [`prisma/seed/__tests__/idempotency.test.ts` を `SKIP_DB_TESTS` 環境変数で `describe.skip`]）。modal-provider 9 件は 2026-06-14 に un-skip 済み（OI-8 解消）。Playwright a11y spec は別系統で `CLERK_SECRET_KEY` 未設定時に `test.skip` 条件分岐 |
| Skipped スイート | **1 件**（idempotency suite のみ。modal-provider.test.tsx の file-level skip は OI-8 解消で解除） |
| テストファイル総数（ダッシュボード集計） | **202** / lcov エントリ **302** / マトリクス 18/80 セル (23%)。2026-08-09 実測（plan 033 の `search-products.test.ts` / plan 036 の `product-deletion.test.ts` / plan 037 の `shipping-address-default.test.ts` で +3。lcov は再測定していないためエントリ数・マトリクスは 2026-08-04 の値のまま）。直前: 199・2026-08-04 実測（plan 032 の `tests/integration/webhook-payment.test.ts` で +1）。直前: 198（plan 031 の `order-lifecycle.test.ts` で +1。ダッシュボード上の `testCount` は 8 で実測と一致）。その前: 197（plan 028 の `country.test.ts` で +1）。直前: 196・2026-08-03 実測（`bun run coverage:dashboard` → `docs/coverage-dashboard.html` の `matrix-data`）。lcov 由来の値（エントリ 302）も 2026-08-04 に `coverage/lcov.info` を測り直した後の再生成なので **2026-08-04 の測定値**（生成物の `generatedAt` は `2026-08-04T15:10:09.967Z`）。増減の経緯・実測履歴は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) |

> **恒久メモ（Unit 行・Integration 行の到達点）**: Unit 行は `queries / pages / store / dashbd /
> shared / lib` が ✦、`api` は構造的 N/A（categorize 上 api-contract 固定・実カバーは API/Contract 行 ✦
> が担保）、`seed` は logic-centric 分母の意図的対象外（2026-05-31 確立）。Integration 行は
> testcontainers 実 PostgreSQL 基盤（ADR-004）+ `integration × queries` 分類（D1, `b57841a`）。
> 各到達の経緯・追加テスト一覧は [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) の
> 2026-05-29〜06-02 エントリを参照（本ファイルの詳細セクションは 2026-07-10 に重複整理で削除）。

---

## フェーズ別実施状況

### ✅ Phase 1（基盤ロジック・ユーティリティ）— 完了

| ステップ | 対象 | ファイル | 状態 |
|---|---|---|---|
| 1-1 | middleware.ts | `src/middleware.test.ts` | ✅ 完了 |
| 1-2 | country.ts | `src/lib/country.test.ts` | ✅ 完了 |
| 1-3 | sanitize.ts | `src/utils/sanitize.test.ts` | ✅ 完了 |
| 1-4a | useIsMobile | `src/hooks/use-mobile.test.tsx` | ✅ 完了 |
| 1-4b | useToast reducer | `src/hooks/use-toast.test.ts` | ✅ 完了 |
| 1-4c | useFromStore | `src/hooks/useFromStore.test.tsx` | ✅ 完了 |
| 1-5 | modal-provider | `src/providers/modal-provider.test.tsx` | ✅ 完了 |
| 1-6 | utils.ts (cn + DOM) | `src/lib/utils.test.ts` / `tests/component/utils-dom.test.ts` | ✅ 完了 |

### ✅ Phase 2（UI コンポーネント）— 完了

| ステップ | 対象コンポーネント | ファイル | 状態 |
|---|---|---|---|
| Step 10 | ステータスタグ群 | `tests/component/shared/status-tags.test.tsx` | ✅ 完了 |
| Step 11 | ProductPrice | `tests/component/store/product-price.test.tsx` | ✅ 完了 |
| Step 12 | ProductShippingFee | `tests/component/store/shipping-fee.test.tsx` | ✅ 完了（2026-03-23） |
| Step 13 | SizeSelector | `tests/component/store/size-selector.test.tsx` | ✅ 完了 |
| Step 14 | QuantitySelector | `tests/component/store/quantity-selector.test.tsx` | ✅ 完了 |
| Step 15 | CartProduct | `tests/component/store/cart-product.test.tsx` | ✅ 完了 |
| Step 16 | ApplyCouponForm | `tests/component/store/apply-coupon-form.test.tsx` | ✅ 完了 |
| Step 17 | PlaceOrderCard | `tests/component/store/place-order-card.test.tsx` | ✅ 完了 |
| Step 18 | OrderStatusSelect | `tests/component/dashboard/order-status-select.test.tsx` | ✅ 完了 |
| Step 19 | ProductStatusSelect | `tests/component/dashboard/product-status-select.test.tsx` | ✅ 完了 |
| Step 20 | StoreStatusSelect | `tests/component/dashboard/store-status-select.test.tsx` | ✅ 完了 |
| Step 21 | CountrySelector | `tests/component/shared/country-selector.test.tsx` | ✅ 完了 |
| F1-1 | StatsCards (admin dashboard) | `tests/component/dashboard/admin/stats-cards.test.tsx` | ✅ 完了 |
| F1-2 | RecentOrders (admin dashboard) | `tests/component/dashboard/admin/recent-orders.test.tsx` | ✅ 完了 |
| F1-3 | SalesChart (admin dashboard) | `tests/component/dashboard/admin/sales-chart.test.tsx` | ✅ 完了 |
| F1-4 | RecentStores (admin dashboard) | `tests/component/dashboard/admin/recent-stores.test.tsx` | ✅ 完了 |

### ⚠️ Phase 3（E2E テスト）— スケルトン完了・一部保留

| ステップ | ファイル | 状態 | 備考 |
|---|---|---|---|
| Step 22 | `tests/e2e/purchase-flow.spec.ts` | ✅ 8/8 テスト | 「複数バリアント追加」を 2026-05-22 に追加（OI-2 解消） |
| Step 23 | `tests/e2e/seller-onboarding.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |
| Step 24 | `tests/e2e/payment-error.spec.ts` | ✅ 2/4 テスト実行（残 2 は機能未実装 skip） | 実行は seed:e2e 前提。2026-08-03 plan 047 で「住所未選択 → エラー表示」を un-skip（Clerk 認証セッションは `createCustomerSession` で解決） |
| Step 25 | `tests/e2e/search-filter.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |
| Step 26 | `tests/e2e/mobile-responsive.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |

### ✅ A1（認可テスト横展開）— 完了（2026-05-21）

- `docs/testing/SECURITY_GAP_REPORT.md` で 14 ファイルの認可カバレッジを調査・記録
- `review.test.ts` に IDOR レグレッションテストを追加
- `paypal.ts` / `stripe.ts` の IDOR 脆弱性（orderId 所有権チェック欠落）を修正 → テスト有効化
- 参照コミット: `55c07b1`, `03a7e89`, `37754d9`, `217bf76`

### ✅ A4（認可ガード統合 + IDOR テスト 3 階層化）— 完了（2026-05-24）

- **認可ガード統合 (`src/lib/auth-guards.ts`)**: `requireUser` / `requireAdmin` / `requireSeller` / `requireStoreOwner` を導入し、`category` / `subCategory` / `offer-tag` / `coupon` / `product` / `store` の各 Server Action からインライン認可チェックを撤去。エラーメッセージを SSOT 化（"Forbidden: store not owned by current user." 等）。
- **CSRF 防御方針 (ADR 001)**: Next.js 16 Server Actions の Origin/Host 検証 + Clerk SameSite=Lax Cookie に依拠する方針を採択。明示的トークン実装は導入しない。`specs/multi-vendor-ecommerce/06-quality.md` / `.claude/steering/tech.md` に明文化。
- **IDOR テスト 3 階層化**: 既存の「(a) スロー検証」に加え、「(b) `where: { url, userId }` 構造検証」「(c) ガード失敗時の副作用なし検証（下流の `upsert` / `create` / `delete` / `findMany` 非呼び出し）」を 8 件追加 (`product.test.ts` +4 / `coupon.test.ts` +1 / `store.test.ts` +3)。
- 参照コミット: `a73603e` 〜 `eae2cfe`

### ✅ A2（Visual Regression MVP）— 完了（2026-05-22）

- `tests/e2e/visual/cart.spec.ts` / `checkout.spec.ts` を追加（chromium 限定）
- `playwright.config.ts` に `reducedMotion: 'reduce'` / `locale: 'en-US'` / `timezoneId: 'UTC'` を追加
- baseline スクリーンショット 3 枚をコミット済み（`688225f`）
  - `cart.spec.ts-snapshots/cart-empty-chromium-darwin.png`
  - `cart.spec.ts-snapshots/cart-with-item-chromium-darwin.png`
  - `checkout.spec.ts-snapshots/checkout-redirect-signin-chromium-darwin.png`
- ⚠️ **CI（Linux）では `-linux.png` baseline が別途必要**（詳細は `specs/multi-vendor-ecommerce/07-testing.md §Visual Regression`）
- 参照コミット: `f639334`, `688225f`

### ✅ A3（a11y MVP）— 完了（2026-05-21）

- `tests/e2e/a11y/sign-in.spec.ts` / `seller-apply.spec.ts` を追加
- `@axe-core/playwright` で WCAG 2.1 AA スキャン
- 参照コミット: `d261d76`

---

## 残課題・Open Issues

### 🔴 現在アクティブな残課題（優先度順・2026-07-30 時点） {#active-open-issues}

> 解消済み OI（OI-1〜OI-9）は下表に取り消し線付きで監査証跡として残す。**着手すべきは以下 3 件（OI-11 / OI-10 / C2）。**

| 優先 | ID | 課題 | 期限 / 状態 | 次の一手 |
|---|---|---|---|---|
| ~~1~~ | ~~**OI-9**~~ | ~~ホーム `/` が SSR で 500（`featured.tsx` の `window` 初期化子参照）~~ | ✅ **解消済み（2026-06-06 / `c196e3d5`）** | 実装は `useState<number>(1200)` の安全な既定値 + `useEffect` での実測反映済み（`featured.tsx:19,30`）。**実測（2026-07-26）**: `security-headers.spec.ts` の `/` が 3 ブラウザとも `status < 400` で pass。**次の一手は D2** — `.lighthouserc.json` / `lhci.yml` の計測 URL へ `/` を追加できる状態になった。 |
| **1（最優先）** | **OI-11** | `/dashboard/seller` 系ルートが本番 SSR で `ReferenceError: self is not defined`（`next-cloudinary` の `CldUploadWidget` をサーバ評価）。OI-9 と同族の client-only ref 問題。現状テストは落ちていない（ログのみ）が本番でも再現の可能性 | 🟡 未着手 | `image-upload.tsx` の `CldUploadWidget` を `next/dynamic` の `ssr:false` で遅延 import する。発見: 2026-06-19（E2E 本番ビルド化で顕在化） |
| 2 | **OI-10** | a11y `color-contrast` 負債: `/checkout`・`/profile`・`/seller/apply` でグレー/ブルー系テキストが 4.5:1 未満。E2E では `runA11yScan` の `disabledRules:["color-contrast"]` で抑制中（追跡のため意図的） | 🟢 低 | 配色（テキスト色）を是正して `disabledRules` を解除する。発見: 2026-06-19（a11y readiness 修正で axe 到達後に検出） |
| 3 | **C2** | Bundle Size の継続監視 | 🟢 低 | `@next/bundle-analyzer + size-limit` で初期 JS の閾値超過を CI 警告（下記 C2 プロンプト参照）。 |

> ✅ **OI-8 完了（2026-06-14）**: CI flake の真因は `src/queries/size.test.ts` の `@/lib/db` 未モックによる実 Prisma 接続リーク（stub DB へ P1001 → jest-circus が別ファイルへ「本文空」失敗を帰属）。`size.test.ts` に `jest.mock("@/lib/db")` を追加して根絶（`83ef06c`）→ 被害者だった `modal-provider.test.tsx` 9 件を un-skip（`49fa32d`、1272→1281 / skip 12→3）。CI push/pull_request 両 event × 2 サイクル緑・stub DB フルスイート P1001 = 0。詳細: [`docs/ci/archive/unit-tests-run-reactive.md`](../ci/archive/unit-tests-run-reactive.md)。
>
> ✅ **D1 完了（2026-06-02）**: ダッシュボード Integration 行の誤分類（`tests/integration/` が `unit × other` セルに分類）は `categorize.ts` 改修で恒久解消（commit `b57841a`）。`integration × queries` ◯→◐（lcov に同名ソース無しのため partial）。詳細: [`COVERAGE_REPORT.md §3 D1`](./COVERAGE_REPORT.md)。

---

### 📜 Open Issues 監査証跡（解消済み含む全履歴）

| # | 課題 | 優先度 | 備考 |
|---|---|---|---|
| ~~OI-1~~ | ~~Visual Regression baseline 未コミット~~ | ~~🔴 高~~ | ✅ 解消済み（`688225f`） |
| ~~OI-2~~ | ~~`purchase-flow.spec.ts` の「複数バリアント追加」1テスト保留~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`tests/e2e/seed/constants.ts` に第2バリアント追加 + spec 追加） |
| ~~OI-3~~ | ~~`/checkout` / `/profile` の a11y spec 未追加~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`tests/e2e/helpers/auth.ts` + `tests/e2e/a11y/{checkout,profile}.spec.ts`。`CLERK_SECRET_KEY` 未設定時は自動スキップ） |
| ~~OI-4~~ | ~~`.github/workflows/` CI 未整備~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`.github/workflows/ci.yml` に lint/test/build 3 並列ジョブ） |
| ~~OI-4a~~ | ~~CI で Visual Regression の `-linux.png` baseline 生成~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`ci.yml` に `workflow_dispatch` 起動の `visual-baselines` ジョブ追加。`gh workflow run ci.yml --ref <branch>` で起動 → 自動 PR） |
| ~~OI-5~~ | ~~E2E シード冪等性（CI 環境での `seed:e2e`）~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`ci.yml` の `seed-idempotency` ジョブで PG service container 起動 → seed 2回実行 → 行数 diff 検証） |
| ~~OI-6~~ | ~~`DashboardStats` コンポーネント調査未完了~~ | ~~🟢 低~~ | ✅ 解消済み（2026-05-24、調査結果: ソース・仕様ともに該当コンポーネントなし。`src/app/dashboard/{admin,seller}/.../page.tsx` はプレースホルダー、`specs/multi-vendor-ecommerce/04-interfaces.md` も「overview」と記載のみ。統計 UI 要件は将来の機能追加時に `specs/` で別途起票） |
| ~~OI-7~~ | ~~`coverage/lcov.info` が古い (2025-03-16 時点)~~ | ~~🟢 低~~ | ✅ 解消済み（2026-05-24、`/coverage` は `.gitignore:10` 対象で git 管理外。`bun run test -- --coverage` でローカル再生成 → `bun run coverage:dashboard` で `docs/coverage-dashboard.html` を更新する運用を確認。CI でのカバレッジ自動化は [`COVERAGE_REPORT §3 B4`](./COVERAGE_REPORT.md#b4-ci-でのカバレッジ-artifact-化--dashboard-自動再生成) に移管 → **B4 完了（2026-06-03）**: `ci.yml` の `test` ジョブで `bun run coverage:dashboard` を実行し `docs/coverage-dashboard.html` を `coverage-dashboard` artifact 化。`generatedAt` の churn 回避のため自動コミットはせず artifact 化に限定） |
| ~~OI-9~~ | ~~**ホーム (`/`) が SSR で 500**: `featured.tsx` の `useState<number>(window.innerWidth)` が初期化子で `window` を参照し、`"use client"` でも SSR 実行時に `ReferenceError: window is not defined` を投げる~~。発見: 2026-05-30 (C1 検証中) | ✅ 解消済み（2026-06-06） | **修正**: `c196e3d5` が初期化子を安全な既定値 `useState<number>(1200)` に置き換え、`useEffect` で実測幅を反映する形にした（現行 `featured.tsx:19,30`）。ハイドレーション差分は `17dfa9f4` の `mounted` ゲートで併せて解消。**実測（2026-07-26）**: `security-headers.spec.ts` の `/` が 3 ブラウザとも `status < 400` で pass し、SSR 200 を確認。**追跡漏れの経緯**: 修正から本行のクローズまで約 7 週間ドリフトしていた（`1fd0a9ef` で E2E の `/checkout` 404 を調査した際に発覚）。**残作業は D2 のみ** — `.lighthouserc.json` / `lhci.yml` の URL へ `/` を追加する。 |
| ~~OI-8~~ | ~~CI flake（本文空・ローカル緑/CI赤・失敗テストがランダム移動）~~。真因確定 + 解消 2026-06-14 | ✅ 解消済み（2026-06-14） | **真因確定（2026-06-14）**: `src/queries/size.test.ts` が `@/lib/db` をモックせず実 Prisma を `spyOn` していたため、CI の stub `DATABASE_URL` へバックグラウンド接続が `PrismaClientInitializationError`(P1001) で reject。その非同期 reject が同一ワーカーのプロセス境界をまたいでリークし、jest-circus が「その瞬間 current な別ファイルのテスト/フック」に `error` イベントとして帰属（P1001 の stack getter が空のためレポーターが本文を空に整形 → 「本文空」署名）。modal-provider / shipping-form / review-details はいずれも Prisma 非依存の**被害者**だった。**過去の仮説の誤り**: 仮説 A(isMounted)/B(MSW)/workflow 層はいずれも対症療法。`[FLAKE-DIAG:unhandledRejection]`(`0736735`) が沈黙したのは、真因が process の unhandledRejection ではなく jest-circus の `error` イベントだったため。**実観測手段**: 一時カスタム jsdom 環境の `handleTestEvent` で失敗イベントの生エラーを surface（`a93effe`、撤去 `756c6a9`）→ 3× P1001 を捕捉（失敗 push run `27487047124`）。**修正**: `size.test.ts` に `jest.mock("@/lib/db")` 追加（`83ef06c`）。stub DB のフルスイートで P1001 が 6+→0、review-details は CI push/PR 両 event × 2 サイクル緑で確認。**完了（2026-06-14）**: 被害者だった `modal-provider.test.tsx` 9 件を un-skip（`49fa32d`）→ CI push/pull_request 両 event 2 サイクル緑 → `spec-sync-after-test`（passed 1272→1281 / skip 12→3）。手順全文（アーカイブ）: [`docs/ci/archive/unit-tests-run-reactive.md`](../ci/archive/unit-tests-run-reactive.md)。 |

---

## 次回セッション 推奨着手順

> **このファイルが即時 TODO の Single Source of Truth。**
> 中長期タスク（B1〜C2）の戦略的背景は [`COVERAGE_REPORT.md §3`](./COVERAGE_REPORT.md#3-next-actions-カバレッジ観点の戦略台帳) を参照。

### ✅ 完了

全ての優先 OI（OI-2 / OI-3 / OI-4 / OI-4a / OI-5）は 2026-05-22 に解消済み。
**B1（shadcn/ui プリミティブ Snapshot）** は 2026-05-23 に MVP 9 プリミティブ分を完了（40 snapshot）。
**A4（認可ガード統合 + IDOR 3 階層化）** は 2026-05-24 に完了（テスト総数 990 → 1016、+26 件）。**A4 残課題 `getStoreOrders` 統合** は 2026-05-26 にクローズ（`70f5b94`、テスト総数 1015 → 1016 / +1）。
**B1+ Sprint 1（Tier 1 前半 10 プリミティブ）** は 2026-05-26 に完了（`b55e177`〜`66fb8d5`、テスト総数 1016 → 1042 / +26、snapshot 40 → 66 / +26）。
**B1+ Sprint 2（Tier 1 後半 11 プリミティブ）** は 2026-05-28 に完了（`750d830`〜`45c339b`、テスト総数 1042 → 1069 / +27、snapshot 66 → 93 / +27）。
**B1+ Sprint 3（Tier 2 全 8 プリミティブ）** は 2026-05-28 に完了（`e6c79e3`〜`4429b8b`、テスト総数 1069 → 1088 / +19、snapshot 93 → 112 / +19）。
**B1+ Sprint 4（Tier 3 + 補助 全 11 プリミティブ）** は 2026-05-28 に完了（`1b207ba`〜`8e429f2`、テスト総数 1088 → 1103 / +15、snapshot 112 → 127 / +15）。**B1+ 全完了**：49/49 shadcn/ui プリミティブが snapshot テストでカバーされ、NA-NS-01 をアーカイブ化。

### 残課題

- 現在、アクティブな残課題は **OI-11 / OI-10 / C2** の 3 件です（優先度・次の一手は[アクティブな残課題テーブル](#active-open-issues)を SSOT として参照）。**OI-9（ホーム `/` の SSR 500）は 2026-06-06 に解消済み**（`c196e3d5`。2026-07-26 に E2E 実測でクローズ確認）。**OI-8（CI flake）は 2026-06-14 に解消済み**（真因 = `size.test.ts` の Prisma 接続リーク `83ef06c` + modal-provider un-skip `49fa32d`。経緯: [`docs/ci/archive/unit-tests-run-reactive.md`](../ci/archive/unit-tests-run-reactive.md)）。
- 中長期タスクは [`COVERAGE_REPORT.md §3`](./COVERAGE_REPORT.md#3-next-actions-カバレッジ観点の戦略台帳) の B / C グループに集約。

### 🟢 中長期（COVERAGE_REPORT §3 B/C グループ）

- ~~**B1** shadcn/ui プリミティブの Snapshot~~ ✅ MVP 完了（2026-05-23、9 プリミティブ / 40 snapshot）
- ~~**B1+** shadcn/ui プリミティブ Snapshot 拡張~~ ✅ **全完了（2026-05-28）**。Sprint 1 (Tier 1 前半 10) + Sprint 2 (Tier 1 後半 11) + Sprint 3 (Tier 2 全 8) + Sprint 4 (Tier 3 + 補助 全 11) で **49/49 プリミティブ・127 snapshot**。NA-NS-01 をアーカイブ化
- ~~**B2** Stripe / PayPal Webhook の Contract テスト拡充~~ ✅ **完了（2026-05-28）**。`/api/webhooks/stripe` / `/api/webhooks/paypal` ハンドラーを新規実装し、payment_intent.succeeded/failed/charge.refunded と PAYMENT.CAPTURE.COMPLETED/DENIED/REFUNDED を冪等処理。30 ケース + metadata 検証 2 ケースで網羅
- ~~**B3** Cart → Checkout の Integration テスト~~ ✅ **完了（2026-05-29）**。`tests/integration/cart-checkout.test.ts` で 4 シナリオ計 11 テストを実装：Zustand persist hydration（2）/ shipping fee 一貫性 ITEM/WEIGHT/FIXED（3）/ クーポン適用（5 正常+異常）/ 未認証リダイレクト（1）。基盤として testcontainers PostgreSQL + 専用 jest config を新設（ADR-004）
- ~~**C1** Lighthouse CI（パフォーマンス予算化）~~ ✅ **完了（2026-05-30）**。`.github/workflows/lhci.yml` + `.lighthouserc.json` を新設し、`@lhci/cli` で `/browse` の LCP/CLS/TBT を計測（warn-only ベースライン）。Clerk は pk_live ダミーで dev handshake を回避。ホーム `/` は OI-9（featured.tsx SSR window バグ）で除外
- **C2** Bundle Size 継続監視（🟢 低）
- ~~**D1** ダッシュボード `categorize.ts` 改修：`tests/integration/` を Integration 行へ正しく分類~~ ✅ **完了（2026-06-02）**。`unit × other` 誤分類を恒久解消し `integration × queries` ◯→◐（commit `b57841a`）
- **D2** Performance 行の着手（🟡 中 / cost S）：**前提だった OI-9 は解消済み**（2026-06-06 `c196e3d5` / 2026-07-26 実測確認）。lhci 計測 URL に `/` を追加 → warn→error 化で予算厳格化。**着手可能**
- **R4** テストギャップ解消（🟡 中 / cost S〜M ×5）：improve Round 4 監査（2026-07-10）の実行プラン **plans/026〜030**（paypal エラー分岐 / placeOrder オーバーセル+PLATFORM 端数統合 / country.ts 新設 / profile.ts catch 分岐 / money-path コンポーネント 6 本）。進捗は [`plans/README.md`](../../plans/README.md) の status 列が SSOT。着手プロンプトは本ファイル「次回着手用 依頼プロンプト」R4 を参照

詳細は [`COVERAGE_REPORT.md §3`](./COVERAGE_REPORT.md#3-next-actions-カバレッジ観点の戦略台帳) を参照。D2 の着手プロンプトは本ファイル「次回着手用 依頼プロンプト」を参照。

---

## 主要コミット履歴

> 2026-07-10 整理: 旧「主要コミット履歴（2026-05-21〜28）」テーブル（62 行）は
> [`COVERAGE_REPORT.md §7 履歴`](./COVERAGE_REPORT.md#7-履歴) と重複していたため削除。
> コミット単位の履歴は §7（日付・コミットハッシュ付き）と `git log` を参照。

---

## 次回着手用 依頼プロンプト

> **使い方**: 新しいセッションを開いて以下の **コードブロック内の文字列をそのままコピペ** すれば、文脈再構築なしに該当タスクへ着手できます。
> プロンプトは `coverage-dashboard.html §03 Next Actions` (= `scripts/coverage-dashboard/render-html.ts` の `NEXT_ACTIONS`) と一対一で対応しています。
> **更新規約**: タスクを完了したら、対応するプロンプトをこのセクションから削除し、`render-html.ts` の `NEXT_ACTIONS` からも同時に削除する（SSOT 二重管理を防ぐ）。新規タスクを追加する場合は両方に同時追加する。

### 🔴 Immediate (high)

（現在 high 優先度の Next Action はありません。A4 残課題 `getStoreOrders` 統合は `70f5b94` でクローズ済み）

### 🟡 Next Sprint (medium)

<!-- NA-NS-01 (B1+ shadcn/ui Snapshot 拡張) ✅ 完了 2026-05-28: 49/49 プリミティブ / 127 snapshot。詳細: B1_SNAPSHOT_EXPANSION_PLAN.md / COVERAGE_REPORT.md §7 -->
<!-- NA-NS-02 (B2: Stripe/PayPal Webhook Contract テスト) ✅ 完了 2026-05-28: 30+2 ケース。コミット 338ab41 / 1d69f0f / 2321cd8 -->
<!-- NA-NS-03 (B3: Cart → Checkout Integration テスト) ✅ 完了 2026-05-29: 4 シナリオ / 11 テスト。ADR-004 参照 -->
<!-- D1 (categorize.ts 改修 / Integration 行実体化) ✅ 完了 2026-06-02: commit b57841a。詳細: COVERAGE_REPORT.md §3 D1 -->

#### R4: テストギャップ解消（improve Round 4 / plans 026〜030）

2026-07-10 の lcov 実測監査（`plans/audit/findings-12-test-coverage.md`）で特定した
「危険な未テスト箇所」5 件の実行プラン。**各プランは zero-context executor（Sonnet 級）向けに
自己完結**しており、下のプロンプトだけで着手できる。**2026-08-04 時点で 026 / 027 / 028 / 029 は
DONE**（`c3699b9c` / `b0e488b5` / `68f636d5` / `70803930`）で、**残るは 030 のみ**。

```
plans/030-component-test-money-path-client.md を読んで、プラン記載のステップどおりに実行してください。
ルール: 本体コード（src/components/store 配下の money-path クライアント）は変更禁止・テスト追加のみ。
各 Step の Verify コマンドを必ず実行し、STOP conditions に該当したら中断して報告。完了後は
spec-sync-after-test skill で docs 同期（別コミット）を行い、plans/README.md の 030 行を
DONE に更新すること。
```

#### R5: improve Round 5 Integration テストギャップ解消（plans 031〜035）🆕 2026-07-11 起票

2026-07-11 の Integration 特化監査（`plans/audit/findings-13-integration-coverage.md`・
実測 17/17 pass）で特定した「実 DB でしか検証できない未テスト統合面」5 件の実行プラン。
**全プラン Docker 必須**（`docker info` 失敗時は各プラン Step 0 の STOP 条件で BLOCKED 記録）。
推奨順: 031（在庫復元・money-critical）→ 032（webhook 決済）→ 033（tsvector 検索）→
034（レビュー集計）→ 035（ロール昇格）。相互独立・並行可だが、**031 と 027 は両方
`tests/integration/setup/seed.ts` を拡張**するため同時実行時はマージに注意（可能なら 027 → 031 順）。
**2026-08-04 時点で 027 / 031 / 032 は DONE**（`b0e488b5` / `61eacfb1` / `9e1682b7`）で、
**次は 033**。

```
plans/033-integration-test-tsvector-search.md を読んで、プラン記載のステップどおりに実行してください。
ルール: 本体コード（src/queries/ の全文検索 raw SQL）は変更禁止・テスト追加のみ。Docker 必須
（docker info 失敗時は STOP して BLOCKED 記録）。各 Step の Verify コマンドを必ず実行し、
STOP conditions に該当したら中断して報告。完了後は spec-sync-after-test skill で docs 同期
（別コミット）を行い、plans/README.md の 033 行を DONE に更新すること。
```

（034〜035 も同形式: パスを
`plans/033-integration-test-tsvector-search.md` / `plans/034-integration-test-review-aggregation.md` /
`plans/035-integration-test-store-status-role-promotion.md` に差し替え、「本体コード」を各プランの
Out of scope 記載どおり読み替えて依頼する）

#### R6: improve Round 6 Integration 深掘りギャップ解消（plans 036〜039）🆕 2026-07-11 起票

2026-07-11 の Integration 深掘り監査（`plans/audit/findings-14-integration-coverage-r6.md`・
R5 未スイープの切り口: FK/カスケード実セマンティクス・default 不変条件・全置換 tx・browse
フィルタ）で特定した 4 件の実行プラン。**全プラン Docker 必須**・相互独立・
**`tests/integration/setup/seed.ts` を変更しない**ため R4/R5 プラン（027 / 031〜035）とも並行可。
推奨順: 036（deleteProduct FK — セラー障害直結）→ 037（住所 default — checkout 信頼性）→
038（updateProduct 編集フロー）→ 039（browse フィルタ — Prisma 6 回帰網）。
037/039 には**現挙動の characterization**（既知ギャップの固定）シナリオが含まれる —
期待値の反転条件は各プラン本文の STOP conditions / Maintenance notes を参照。

```
plans/036-integration-test-product-deletion-fk.md を読んで、プラン記載のステップどおりに実行してください。
ルール: 本体コード（src/queries/product.ts）と prisma/ は変更禁止・テスト追加のみ。Docker 必須
（docker info 失敗時は STOP して BLOCKED 記録）。各 Step の Verify コマンドを必ず実行し、
STOP conditions に該当したら中断して報告。完了後は spec-sync-after-test skill で docs 同期
（別コミット）を行い、plans/README.md の 036 行を DONE に更新すること。
```

（037〜039 も同形式: パスを `plans/037-integration-test-shipping-address-default.md` /
`plans/038-integration-test-product-update-tx.md` /
`plans/039-integration-test-product-browse-filters.md` に差し替え、「本体コード」を各プランの
Out of scope 記載どおり読み替えて依頼する）

#### R7: improve Round 7 Integration 残余ギャップ解消（plans 040〜041）🆕 2026-07-11 起票

2026-07-11 の Integration 第 3 弾監査（`plans/audit/findings-15-integration-coverage-r7.md`・
R5/R6 未スイープの切り口: Clerk user-sync webhook の FK 連鎖・グローバル unique 制約の実発火）で
特定した 2 件の実行プラン（高レバレッジ候補が 2 件のみだったため水増しせず 2 本 — 詳細な
rejected/deferred 判定は findings-15 参照）。**全プラン Docker 必須**・相互独立・
**`tests/integration/setup/seed.ts` / `setup/reset-db.ts` を変更しない**ため
R4〜R6 プラン（027 / 031〜039）とも並行可。
推奨順: 040（user.deleted FK 連鎖 — PII 残存・Svix 無限リトライのコンプライアンス隣接）→
041（coupon code unique — セラー日常運用のエラー UX）。
040 のシナリオ 2〜4 と 041 のシナリオ 2・3 は**現挙動の characterization**（既知ギャップの固定）—
期待値の反転条件は各プラン本文の STOP conditions / Maintenance notes を参照。

```
plans/040-integration-test-user-deletion-webhook.md を読んで、プラン記載のステップどおりに実行してください。
ルール: 本体コード（src/app/api/webhooks/route.ts）と prisma/ は変更禁止・テスト追加のみ。Docker 必須
（docker info 失敗時は STOP して BLOCKED 記録）。各 Step の Verify コマンドを必ず実行し、
STOP conditions に該当したら中断して報告。完了後は spec-sync-after-test skill で docs 同期
（別コミット）を行い、plans/README.md の 040 行を DONE に更新すること。
```

（041 も同形式: パスを `plans/041-integration-test-coupon-code-uniqueness.md` に差し替え、
「本体コード」を `src/queries/coupon.ts` に読み替えて依頼する）

#### R8: improve Round 8 E2E 網羅性ギャップ解消（plans 042〜050）🆕 2026-07-11 起票

2026-07-11 の初 E2E フル実測 + 網羅性監査（`plans/audit/findings-16-e2e-coverage.md`）で
特定した 9 件の実行プラン。**最優先は 042**（signIn ヘルパーの Clerk UI ドリフトが
5 サイトに複製され認証系 16 テストが全滅中 — 047/048/049/050 の先行依存）。
042 と並行して依存ゼロの 045（ゲスト導線）/ 044（運用ガード）/ 043（VRT）/
046（/browse ページネーション配線）に着手可能。045・046 は同じ
`tests/e2e/seed/` を触るため後発が先発の diff を取り込むこと。
全プラン `CLERK_SECRET_KEY` + ローカル Docker Postgres 前提。**実行前に :3000 を解放**
（`docker compose stop app` — 怠ると別環境のサーバーを無警告で再利用し実測が無効化される。
2026-07-11 実測 #1 の事故として findings-16 に記録済み）。

```
plans/042-e2e-signin-helper-repair.md を読んで、プラン記載のステップどおりに実行してください。
ルール: 変更は In scope のファイルのみ（tests/e2e/ の 5 ファイル + src/components/store/icons/ の
aria-label 追加 3 行）。実行前に lsof -nP -iTCP:3000 -sTCP:LISTEN が空であることを確認し、
占有されていたら docker compose stop app。各 Step の Verify コマンドを必ず実行し、
STOP conditions に該当したら中断して報告。完了後は spec-sync-after-test skill で docs 同期
（別コミット）を行い、plans/README.md の 042 行を DONE に更新すること。
```

（043〜050 も同形式: パスを各プランに差し替える。047〜050 は「plan 042 が DONE であること」を
冒頭で確認し、未完なら BLOCKED 記録で STOP と付記して依頼する）

#### R9: improve Round 9 E2E 残余ギャップ解消（plans 051〜056）🆕 2026-07-12 起票

2026-07-12 の E2E 残余監査（`plans/audit/findings-17-e2e-coverage-r9.md` — R8 未スイープの
新規切り口 8 系統を精査。ベースラインは R8 実測 #2 を SSOT 引き継ぎ・再実測なし）で
特定した 6 件の実行プラン。**051（国選択セレクタ — 依存ゼロ・P1）と
056（Newsletter dormant 404 の characterization — 依存ゼロ）は R8 プランを待たず即着手可能**。
052（a11y 拡大）は plan 042 Step 4（svg-img-alt 修正）完了後、055（カート引き継ぎ）と
053 のサインアウト部は 042 全体の完了後、054（VRT 拡大）は plan 043 完了後。
**監査で新規発見したアプリ側ギャップ**: フッター Newsletter フォームの `/api/newsletter` が
**リポジトリに不在**（curl 実測 404・schema に購読者モデルも無し）— 全購読操作が失敗する
dormant 機能。成功系は機能実装プランの起票が先（characterization は plan 056 が担当）。

```
plans/051-e2e-country-selector.md を読んで、プラン記載のステップどおりに実行してください。
ルール: 変更は In scope のファイルのみ（tests/e2e/country-selector.spec.ts 新規のみ・src/ 変更禁止）。
実行前に lsof -nP -iTCP:3000 -sTCP:LISTEN が空であることを確認し、占有されていたら
docker compose stop app。各 Step の Verify コマンドを必ず実行し、STOP conditions に該当したら
中断して報告。完了後は spec-sync-after-test skill で docs 同期（別コミット）を行い、
plans/README.md の 051 行を DONE に更新すること。
```

（052〜056 も同形式: パスを各プランに差し替える。052 は「plan 042 Step 4 完了」、
055 は「plan 042 DONE」、054 は「plan 043 DONE」を冒頭で確認し、未完なら BLOCKED 記録で
STOP と付記して依頼する）

#### D2: Performance 行の着手（lhci の計測 URL に `/` を追加）

```text
ヒートマップ Performance 0% 行を前進させるため、Lighthouse CI の計測対象に / を追加してください。

背景:
- C1（Lighthouse CI）は 2026-05-30 に完了済みだが、ホーム / は OI-9（featured.tsx の SSR window
  参照バグで 500）のため計測対象から除外され、暫定的に /browse のみを計測している。
- その OI-9 は 2026-06-06 に解消済み（c196e3d5 が初期化子を安全な既定値へ置換）。
  2026-07-26 に security-headers.spec.ts の / が 3 ブラウザとも status < 400 で pass することを
  実測し、SSR 200 を確認済み。したがってコード修正は不要で、計測 URL の追加から着手できる。

実装方針:
1. .lighthouserc.json / .github/workflows/lhci.yml の collect URL に / を追加する。
2. 数回ベースライン観測後、.lighthouserc.json の assertion を warn → error 化して予算を厳格化（別 PR 可）。

完了条件:
1. lhci が / を計測（CI グリーン）、bunx tsc --noEmit / bun run lint グリーン。
2. render-html.ts の NEXT_ACTIONS から D2 を削除し、本プロンプトも削除（二重 SSOT 同期）。
3. COVERAGE_REPORT.md §2/§3 を更新（Performance 行の状態変化を反映）。

参考:
- OI-9 のクローズ記録: docs/testing/QA_HANDOFF.md「解消済み OI」OI-9 行
- 先行例: .github/workflows/lhci.yml + .lighthouserc.json（C1）
- コミット規約: .claude/rules/02-tdd-step-commit.md
```

#### OI-11: seller ルートの本番 SSR クラッシュ修正

```text
/dashboard/seller 系ルートが本番 SSR で ReferenceError: self is not defined を投げる問題
（OI-11）を修正してください。next-cloudinary の CldUploadWidget がサーバ評価される client-only
コンポーネントであることが原因です（OI-9 と同族）。

実装方針:
1. image-upload.tsx の CldUploadWidget を next/dynamic の { ssr: false } で遅延 import する。
2. 本番ビルド（next build → next start）で /dashboard/seller 系が SSR 200 を返すことを確認。

完了条件:
1. seller ルートが本番 SSR で 200、OI-11 を QA_HANDOFF.md 残課題からクローズ（取り消し線）。
2. bunx tsc --noEmit / bun run lint グリーン。
3. render-html.ts の NEXT_ACTIONS から OI-11 を削除し、本プロンプトも削除（二重 SSOT 同期）。

参考:
- OI-11 詳細: docs/testing/QA_HANDOFF.md「現在アクティブな残課題」OI-11 行
- 同族先行例: OI-9（featured.tsx の SSR window 参照）
```

#### plan 063: Stripe 既存決済行の `PaymentDetails.amount` backfill 🆕 2026-07-27 起票

CORRECTNESS-05 の残件。コード修正（Stripe 経路が `paymentIntent.amount`（セント）を
`Decimal(12,2)` = ドル建てカラムへ書いていたバグ）は 2 段階で完了しており、**残るのは
カットオーバー以前に書かれた履歴データのみ**。本番決済データへの `UPDATE` を伴うため、
`safe-migration` skill と人手承認ゲートが前提。**カットオーバー境界は `c4a6fb41`（2026-08-07・
webhook 経路を `Order.total` に統一）である** —— `e63474b6`（2026-07-19）が直したのは同期パス
`src/queries/stripe.ts` だけで、webhook `src/app/api/webhooks/stripe/route.ts` はその後も cents を
書き続けていた。境界を `e63474b6` に取ると、その間に webhook が書いた cents 行を取りこぼす
（詳細は plan 063 Step 1 の訂正記録）。

```text
plans/063-backfill-stripe-payment-amount.md を読んで、プラン記載のステップどおりに実行してください。

ルール:
- 本体コード（src/queries/stripe.ts / paypal.ts / src/app/api/webhooks/**）は変更禁止。
  コード側は同期パスが e63474b6、webhook 経路が c4a6fb41 で修正済み。
- カットオーバー境界は c4a6fb41（webhook が cents を書かなくなった時点）を使う。
  e63474b6 を境界にすると、その後 webhook が書いた cents 行を取りこぼすため禁止。
- Step 3 の dry-run レポートを提示して人手承認を得るまで、いかなる UPDATE も実行しない。
- 候補行の述語は肯定形 paymentMethod = 'Stripe' を使う（否定形は d8f770d2 以前の
  "Paypal" 表記の行を巻き込むため禁止）。
- 各 Step の Verify コマンドを必ず実行し、STOP conditions に該当したら中断して報告。

完了条件:
1. Step 2 のクエリが backfill 後に ratio 外れ値 0 行を返す（プラン Done criteria 全項目）。
2. plans/README.md の 063 行を DONE に更新し、Deferred の CORRECTNESS-05 記述をクローズする。
3. render-html.ts の NEXT_ACTIONS から 063 を削除し、本プロンプトも削除（二重 SSOT 同期）。
   削除後は bun run coverage:dashboard を実行して docs/coverage-dashboard.html を再生成する。

参考:
- 起票の経緯: plans/README.md Deferred の CORRECTNESS-05 行
- コード修正コミット: e63474b6（同期パス: fix(stripe): store payment amount in dollars ...）
  / c4a6fb41（webhook 経路 = カットオーバー境界: PaymentDetails.amount を Order.total に統一）
- コミット規約: .claude/rules/02-tdd-step-commit.md
```

### 🟢 Mid–Long Term (low)

SaaS ロードマップ範囲 (docs/architecture/saas-roadmap.md) で別ストリーム扱い。

#### OI-10: a11y color-contrast 負債の是正

```text
/checkout・/profile・/seller/apply のグレー/ブルー系テキストが WCAG 2.1 AA の 4.5:1 を
満たさない a11y 負債（OI-10）を是正してください。現在 E2E では runA11yScan の
disabledRules:["color-contrast"] で追跡のため意図的に抑制中です。

実装方針:
1. 対象ページのテキスト色を 4.5:1 以上を満たす配色へ是正する。
2. runA11yScan の disabledRules から "color-contrast" を解除する。

完了条件:
1. axe color-contrast 違反ゼロ、OI-10 を QA_HANDOFF.md 残課題からクローズ（取り消し線）。
2. E2E a11y spec グリーン（disabledRules 解除後）。
3. render-html.ts の NEXT_ACTIONS から OI-10 を削除し、本プロンプトも削除（二重 SSOT 同期）。

参考:
- OI-10 詳細: docs/testing/QA_HANDOFF.md「現在アクティブな残課題」OI-10 行
```

<!--
C1 (Lighthouse CI でパフォーマンス予算化) は 2026-05-30 に完了済み。
- 結果: .github/workflows/lhci.yml + .lighthouserc.json を新設、@lhci/cli で /browse の
  LCP/CLS/TBT を計測 (warn-only ベースライン)。
- Clerk 回避: pk_test ダミーは dev handshake (偽 FAPI) で collect 400。本番形式の
  pk_live ダミー (+ sk_live ダミー) で handshake を回避 (ローカルで /browse → 200 実証)。
- ホーム / は OI-9 (featured.tsx の SSR window バグ) で 500 のため URL から除外。修正後に追加。
- scripts/coverage-dashboard/render-html.ts の NEXT_ACTIONS からも削除済み。
- フォローアップ: 数回のベースライン観測後に .lighthouserc.json を warn → error 化して予算を厳格化。
-->

#### C2: Bundle Size の継続監視 (`.github/workflows/bundle.yml`)

```text
依存追加による初期 JS バンドルの肥大化を PR で検知するため、Bundle Size 継続監視を導入してください。

背景:
- C1 (Lighthouse CI) は 2026-05-30 に完了済み (.github/workflows/lhci.yml + .lighthouserc.json)。
  C2 は同じ "パフォーマンス退行を PR で検知する" ストリームの 2 件目 (COVERAGE_REPORT.md §3)。
- 目的: @next/bundle-analyzer + size-limit で初期ロード JS の閾値超過を CI で警告する。
- コスト感: S (lhci 比で軽量。サーバー起動・DB seed 不要)。

実装方針:
1. devDependencies に size-limit + @size-limit/file (または @size-limit/preset-app) を追加。
2. .size-limit.json を新設し、.next/static/chunks の主要バンドル (app shell / framework) に
   閾値 (例: gzip 後 KB) を設定。初期は warn 相当の緩い閾値でベースライン観測。
3. .github/workflows/bundle.yml を新設:
   - on: pull_request [main, dev] + workflow_dispatch
   - permissions: contents: read / concurrency: bundle-${{ github.ref }}
   - third-party action は SHA ピン + バージョンコメント (01-engineering-standards.md)。
     postgres service は不要 (bundle はビルド成果物のサイズのみ計測)。
   - steps: checkout → setup-bun (1.3.14) → bun install --frozen-lockfile →
     bunx prisma generate → bun run build → bunx size-limit
   - env: ci.yml と同じ stub 群 (DATABASE_URL は build 時の force-dynamic 回避用 stub で可)。
4. ビルドが DB に到達しないことを確認 (force-dynamic ページは build 時クエリを実行しないが、
   念のため lhci と同様 stub DATABASE_URL を渡す)。

完了条件:
1. .github/workflows/bundle.yml + .size-limit.json + package.json/lockfile をコミット。
2. bunx tsc --noEmit エラーゼロ、bun run lint グリーン。
3. scripts/coverage-dashboard/render-html.ts の NEXT_ACTIONS から C2 を削除。
4. 本セクション (QA_HANDOFF.md C2 プロンプト) を削除し、COVERAGE_REPORT.md §3 に
   C2 完了アーカイブ行を追加 (完了日 + commit hash)。
5. docs/coverage-dashboard.html を bun run coverage:dashboard で再生成。
6. docs/PROGRESS.md の「次アクション」を更新 (C シリーズ完了)。

参考:
- 先行例: .github/workflows/lhci.yml (C1。トリガー/ピン/concurrency/env のパターン)
- コミット規約: .claude/rules/02-tdd-step-commit.md (実装とドキュメント同期は別コミット)
- ドキュメント配置: .claude/steering/documentation-guide.md
```

---

*Stay Red, Go Green, and Refactor rigorously.*
