# Plan 065: 商品詳細の右購入パネルが 1280px でクリップされる欠陥を修正する（plan 054 のブロッカー解消）

> **Executor instructions**: 本プランは **未実行**。plan 054（VRT 対象を商品詳細へ拡大）は
> このレイアウト欠陥のため商品詳細のベースライン撮影を**意図的に見送っている**。
> 本プラン完了後に 054 の残りを実行すること（順序を逆にすると壊れた見た目を
> ベースラインとして固定してしまう）。
>
> **Drift check（着手前に必ず実行）**:
> ```bash
> git diff --stat 1847946d -- src/components/store/product-page/container.tsx "src/app/(store)/product"
> git status --porcelain -- src/components/store/product-page "src/app/(store)/product"
> ```

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: MED（ストアフロントの購買導線の見た目を変える。回帰検知器が現時点で存在しない）
- **Depends on**: なし（本プランが plan 054 の依存元）
- **Blocks**: [plan 054](054-e2e-vrt-expansion.md) の残り（商品詳細の VRT ベースライン撮影）
- **Category**: correctness（UI）
- **Planned at**: 2026-08-24

## Why this matters

クリップされているのは **`Add to cart` / `Buy now` を含む右側の購入パネル**であり、
商品詳細は購買判断の最終ページである。1280px は最も一般的なラップトップ幅の一つなので、
欠陥は周辺的な breakpoint ではなく**主要導線の中心**に出ている。

さらに、この欠陥がある限り plan 054 は完了できない。VRT のベースライン PNG は
「意図した見た目」の宣言であり、壊れた状態を固定すると**欠陥をロック**して次の担当者に
「直したらテストが壊れた」と受け取らせる（plan 050 / 056 が確立した「修正を罰するテストは
書かない」原則と同型）。

出典: [`plans/README.md`](README.md) の 054 実行記録（2026-08-23・`0dba44de`〜`1847946d`）。
同記録は **2026-08-23 時点で**「レイアウト修正は未起票」と記していた（＝実行時の履歴）。
**現在は本プランが追跡先**であり、未起票の状態は解消済みである。以降この欠陥の状態は
本プランを正とし、054 実行記録は当時の記録として残す。

## Current state（修正前）

`page.evaluate` による 054 の実測は **`scrollWidth === clientWidth === 1280`**、すなわち
**ドキュメントの横スクロールは発生していない**。これは「溢れていない」ことを意味せず、
**溢れた分が握り潰されている**ことを意味する。

1. [`src/app/(store)/product/[productSlug]/[variantSlug]/page.tsx:91`](../src/app/\(store\)/product/[productSlug]/[variantSlug]/page.tsx)
   のページラッパが `overflow-x-hidden` を持つ。これが横スクロール条を消し、
   `scrollWidth` を `clientWidth` に一致させている（= 症状を計測から隠す層）。
2. [`src/components/store/product-page/container.tsx:200-210`](../src/components/store/product-page/container.tsx)
   が溢れの発生源。`md:flex-row` の行に、`w-full` の `ProductInfo` と
   **固定幅 `w-[390px]`** の購入パネルが並ぶ。`w-full` は残余幅ではなく親幅に対して解決される
   ため、行の intrinsic width は親を超える。`xl:` 未満では画像 swiper も同じ行に居るため
   1280px でちょうど右端が欠ける。

**根本原因は 1 ではなく 2 単独である**。1 は原因ではなく**発覚を遅らせた要因**なので、
`overflow-x-hidden` を外すだけの修正は「クリップ」を「横スクロール」に置き換えるだけで
欠陥を解消しない（そして 1650px 超のレイアウト保護という本来の役割を失う）。

## Scope

**In**: `src/components/store/product-page/container.tsx` の幅指定 /
必要なら同ページラッパ / `tests/e2e/visual/` の商品詳細ベースライン（054 側で撮影） /
`plans/README.md` / docs 同期。

**Out（意図的に触らない）**:

- **`ProductInfo` / `ProductSwiper` の内部構造** — 行レベルの幅解決の問題であり、
  子の再設計を混ぜるとレビュー単位が壊れる。
- **`page.tsx:91` の `overflow-x-hidden` 削除** — 上記のとおり原因ではない。行の幅解決を
  直した後も `scrollWidth === clientWidth` が保たれることを確認するに留める。
- **他ブレークポイント（sm / 2xl）の作り直し** — 1280px の欠損の修正に限定する。

## Steps

1. **再現を固定する**。1280x720 で商品詳細を開き、`page.evaluate` で購入パネルの
   `getBoundingClientRect().right` が `document.documentElement.clientWidth` を
   超えていることを実測する（`scrollWidth` は前述のとおり指標にならない）。
2. **行の幅解決を直す**。`w-full` + 固定 `w-[390px]` の併置をやめ、情報列を
   `min-w-0 flex-1`、購入パネルを `shrink-0`（幅は据え置き）にする。`min-w-0` が無いと
   flex item の既定 `min-width: auto` が縮小を拒み、`flex-1` を付けても溢れは残る。
3. **Step 1 の測定を再実行**し、`right <= clientWidth` を確認する。
4. **目視ゲート**: 1280 / 1440 / 768 で、`Ship to` / `Buy now` / `Add to cart` が
   全幅で描画されることを確認する。
5. `bun run lint` / `bunx tsc --noEmit` / `bun run test`。
6. **plan 054 の残りへ引き渡す** — 商品詳細のベースラインを撮影し、054 を DONE にする。

## Done criteria

- 1280px で購入パネルの右端がビューポート内に収まる（Step 1 の実測で確認）。
- `scrollWidth === clientWidth` が維持されている（クリップを横スクロールに
  すり替えていないことの確認）。
- **1440px / 768px でも Step 4 の目視ゲートを通す** —— `Ship to` / `Buy now` /
  `Add to cart` が全幅で描画されること。1280px だけ直して他ブレークポイントを
  壊す（`shrink-0` が狭幅で新たな溢れを生む）経路を塞ぐため、Done criteria に置く。
- **Step 5 を実行して緑**: `bun run lint`（0 errors。warnings は既存ベースライン）/
  `bunx tsc --noEmit` 0 件 / `bun run test` が既存の passed 数を維持している。
- plan 054 の商品詳細 VRT が撮影可能な状態になり、054 が DONE へ遷移できる。
