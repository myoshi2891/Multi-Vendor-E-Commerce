# Compare — 要件（requirements.md）

> 記法: EARS 風（`When/While/The system shall`）。受け入れ基準は `AC-CMP<n>`。
> 設計は [design.md](./design.md)、実装手順は [tasks.md](./tasks.md)。

---

## 1. 機能要件

| ID        | 要件（EARS 風）                                                                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CMP-1** | 訪問者がバリアントを比較リストへ追加したとき、システムはそのバリアント ID を localStorage 永続の比較ストアに保持しなければならない。                                    |
| **CMP-2** | While 比較リストが空でないとき、`/compare` にアクセスすると、システムは保持中のバリアントの商品名・画像・サイズ別の割引価格範囲・評価をグリッドで横並び表示しなければならない。 |
| **CMP-3** | When 同一バリアントを重複追加したとき、システムは重複を無視しなければならない（冪等）。                                                                                 |
| **CMP-4** | When 比較リストが上限（4 件）に達した状態でさらに追加したとき、システムは追加を拒否する（またはユーザーに通知する）。                                                   |
| **CMP-5** | 訪問者は比較リストから個別バリアントを削除、または全消去できなければならない。                                                                                          |
| **CMP-6** | While 比較リストが空のとき、`/compare` は空状態（比較対象が無い旨）を表示しなければならない。                                                                           |

---

## 2. 受け入れ基準（AC）

| ID          | 受け入れ基準                                                                                                                   | 検証方法              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| **AC-CMP1** | `addToCompare(id)` で id がストアに入り、`persist` により localStorage に保存される。                                          | ユニット（store）     |
| **AC-CMP2** | 既存 id を再度 `addToCompare` してもリスト長は増えない（冪等）。                                                               | ユニット              |
| **AC-CMP3** | 4 件保持時に 5 件目を `addToCompare` してもリスト長は 4 のまま（拒否）。                                                       | ユニット              |
| **AC-CMP4** | `removeFromCompare(id)` / `clearCompare()` でリストが更新される。                                                              | ユニット              |
| **AC-CMP5** | `/compare` がストアの id を `getProductsByIds` で取得し、各商品の名前/画像/価格/評価を描画する（`getProductsByIds` を mock）。 | コンポーネント（RTL） |
| **AC-CMP6** | 空リストで `/compare` を開くと空状態が表示され、`getProductsByIds` が呼ばれない。                                              | コンポーネント        |

---

## 3. 非機能要件（NFR）

| ID                             | 内容                                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **NFR-CMP1**（コード規約）     | `any` 禁止・`console.log` 禁止。ストアは `useCartStore` と同型（`create(persist<State & Actions>())`）。                    |
| **NFR-CMP2**（金額精度）       | 価格表示は `getProductsByIds` の数値（`toNumberSafe` 済み）と既存 `ProductPrice` の割引・サイズ価格範囲を使い、独自の金額計算を追加しない。                         |
| **NFR-CMP3**（テスト配置）     | ストアテストはソースと同階層（`src/compare-store/useCompareStore.test.ts`・[tech.md](../../../.claude/steering/tech.md)）。 |
| **NFR-CMP4**（パフォーマンス） | `getProductsByIds` の呼び出しは比較リストが空でないときのみ（空クエリで throw する仕様を回避）。                            |
| **NFR-CMP5**（TDD）            | [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md) 遵守。                                |

---

## 4. デザインシステム移行（2026-09-30）

| ID | 受け入れ条件 | 検証方法 |
|---|---|---|
| AC-CMP7 | 深緑・アイボリー・ゴールド、セリフ見出し、罫線を使い、商品情報と既存価格表示を保持する | Playwright・実画面 |
| AC-CMP8 | 空状態から `/browse` に移動でき、件数と最大4件を表示する | RTL・Playwright |
| AC-CMP9 | 取得中は読み上げ可能な通知、取得失敗は通知と再試行、商品取得ゼロは利用不可案内を表示し、選択は保持する | RTL・Playwright |
| AC-CMP10 | PC1440px・モバイル390px・境界700pxでページ全体の横スクロールがなく、比較領域はキーボードでもスクロールできる | Playwright |
| AC-CMP11 | focus-visible、見出し、操作領域、main内のWCAG 2 AA相当のaxe検証を満たし、reduced-motionを尊重する | Playwright・CSS確認 |
| AC-CMP12 | 比較リスト変更・全消去後に古い取得応答を反映しない。空リストは取得しない | RTL |

新規API・DB変更は不要。価格の再実装はせず既存ProductPriceを使う。Server Componentから取得Actionをpropで渡す。仕様と検証証跡の正本は[移行進捗](../design-system/PROGRESS.md)。

## 5. スコープ外

- サーバー側での比較リスト永続（ログイン間・デバイス間同期）。
- スペック（`Spec`）行ごとの詳細比較表（任意拡張・design §判断4）。
- 商品カード・商品詳細ページへの「Add to compare」ボタンの本格設置（MVP は最小、または follow-up）。
- 比較対象の並び替え・絞り込み。

## P2残存表示統一（2026-10-09）

比較rootにstore限定purchase themeを合成し、hero/card/price/罫線/意味色/focusを役割別tokensへ統一。暗いheroのfocusには装飾gold、明るい面には濃いfocusを使う。ProductPriceの計算・4件制限・削除・全消去・保存方式・Action Propsは不変。

[保存計画](../../../plans/layout-design/priority-six-p2-residual-design-system-plan.md)／[証跡](../design-system/PROGRESS.md#p2残存6画面移行記録)。


## 優先8画面受け入れ（2026-10-11）

個別削除・全消去後は、消えない「Your selection」見出しへkeyboard focusを戻す。選択件数はpoliteに通知。最大4件・永続化・取得失敗/retry・古い取得結果の抑止は既存契約を保持。
