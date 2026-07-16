# プラン 006: 「注文を確定」の二重送信を防止する（reentrancy ガード + ボタンの disabled 化）

> 原本: [../006-place-order-double-submit-guard.md](../006-place-order-double-submit-guard.md)

> **Executor 向け指示**: このプランを順番どおりに実行すること。各検証コマンドを実行し、
> 次に進む前に期待結果を確認する。「STOP conditions」に該当する事象が起きたら、
> 停止して報告すること — 独自判断で進めない。完了したら `plans/README.md` の
> このプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**: `git diff --stat f9752c0..HEAD -- src/components/store/cards/place-order.tsx`
> このファイルがこのプラン作成後に変更されていれば、「Current state」の抜粋を
> 実コードと比較すること。不一致があれば STOP。

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness
- **Planned at**: commit `f9752c0`, 2026-07-03

## なぜ重要か

「注文を確定」ボタンは `disabled` 状態も reentrancy ガードも無しに `handlePlaceOrder()` を呼んでいる。`placeOrder`（サーバー）はカート単位で冪等ではない — 呼び出しごとに `Order` を作成し在庫を減算する。ダブルクリックする（あるいは遅いネットワークが2回目のクリックを誘発する）ユーザーは、1回のチェックアウトで重複注文を作成し在庫を二重減算し得る。`loading` 中に表示される spinner は装飾に過ぎない — ボタンはクリック可能なままである。本プランは、リポジトリで確立された reentrancy ガード規約を使って**クライアント起点**の二重送信経路を閉じる。これにより現実的なユーザー起因のケースを LOW risk で排除できる。（真に並行なリクエストに対するより深いサーバー側冪等性保証は、より大きなトランザクションリファクタと重複し MED risk を伴うため、先送りのフォローアップとして明示している — これにより本プランを安全かつ焦点を絞ったものに保つ。）

## Current state

`src/components/store/cards/place-order.tsx`。

State + handler、26-47行目（`f9752c0` 時点）:

```ts
const [loading, setLoading] = useState<boolean>(false)
const { id, coupon, subTotal, shippingFees, total } = cartData
const { push } = useRouter()
const emptyCart = useCartStore((state) => state.emptyCart)
const handlePlaceOrder = async () => {
    setLoading(true)
    if (!shippingAddress) {
        toast.error('Select a shipping address before placing your order.')
    } else {
        try {
            const order = await placeOrder(shippingAddress, id)
            if (order) {
                emptyCart()
                await emptyUserCart()
                push(`/order/${order.orderId}`)
            }
        } catch (_error) {
            toast.error('Something went wrong while placing your order.')
        }
    }
    setLoading(false)
}
```

Button、142-148行目 — `disabled` なし:

```tsx
<Button onClick={() => handlePlaceOrder()}>
    {loading ? (<PulseLoader size={5} color="#fff" />) : (<span>Place order</span>)}
</Button>
```

`import { Dispatch, FC, SetStateAction, useState } from 'react'`（5行目）— `useRef` はまだ import されていない。

### 従うべきリポジトリ規約（インライン）

このプロジェクトは、まさにこのケース向けに **`useRef` による reentrancy ガード**を規約として文書化している（`.claude/steering/tech.md`「リエントランシーガード」；模範実装 `src/components/store/layout/footer/newsletter.tsx`）:

```ts
const isSubmittingRef = useRef(false);
const handleSubmit = async () => {
    if (isSubmittingRef.current) return;   // early return
    isSubmittingRef.current = true;
    try {
        await performAsyncOperation();
    } finally {
        isSubmittingRef.current = false;   // always release
    }
};
```

このパターンを使うこと。ボタンの `disabled` props は ref の可視な補完である（ref はクリックと状態更新の間のレースをカバーし、`disabled` は UI をカバーする）。

## 必要なコマンド

| 目的   | コマンド             | 期待結果            |
|-----------|---------------------|---------------------|
| 型チェック | `bunx tsc --noEmit` | exit 0              |
| Lint      | `bun run lint`      | exit 0（警告は許容）   |
| テスト      | `bun run test -- src/components/store/cards` | 全件 pass（ここにテストが存在する場合） |

## Scope

**対象内**:
- `src/components/store/cards/place-order.tsx` — ref ガード + `disabled` を追加
- このコンポーネントをリポジトリがテストしている場合、co-located コンポーネントテスト（Step 3 参照；姉妹テストパターンが存在する場合のみ作成）

**対象外**:
- `placeOrder`（`src/queries/user.ts`）のサーバー側冪等性 — 先送り（Maintenance notes 参照）。ここで `placeOrder` を変更しないこと。
- `emptyUserCart` / カートクリアフロー。
- このファイル内のクーポン/割引表示ロジック。

## Git ワークフロー

- Branch: `advisor/006-place-order-double-submit`
- コミットスタイル: `fix(checkout): guard place-order against double submit`
- 指示がない限り push や PR は作成しないこと。

## Steps

### Step 1: `useRef` の import と reentrancy ガードを追加

`src/components/store/cards/place-order.tsx` にて:
1. React の import（5行目）に `useRef` を追加: `import { Dispatch, FC, SetStateAction, useRef, useState } from 'react'`。
2. `loading` state の隣に ref を追加する:
   ```ts
   const isPlacingOrderRef = useRef(false)
   ```
3. `handlePlaceOrder` を、ref でガードし常に解放するように書き換える:
   ```ts
   const handlePlaceOrder = async () => {
       if (isPlacingOrderRef.current) return
       isPlacingOrderRef.current = true
       setLoading(true)
       try {
           if (!shippingAddress) {
               toast.error('Select a shipping address before placing your order.')
               return
           }
           const order = await placeOrder(shippingAddress, id)
           if (order) {
               emptyCart()
               await emptyUserCart()
               push(`/order/${order.orderId}`)
           }
       } catch (_error) {
           toast.error('Something went wrong while placing your order.')
       } finally {
           isPlacingOrderRef.current = false
           setLoading(false)
       }
   }
   ```
   注記: 住所欠落時の early `return` は今や `try` の中にあるため、`finally` が引き続き ref を解放し `loading` をクリアする — これは潜在的な「loading が固着する」経路も同時に修正する。

**検証**: `bunx tsc --noEmit` → exit 0。

### Step 2: 注文確定中はボタンを disabled にする

ボタン（~142行目）を `loading` 中に disabled になるよう変更する:

```tsx
<Button onClick={() => handlePlaceOrder()} disabled={loading}>
    {loading ? (<PulseLoader size={5} color="#fff" />) : (<span>Place order</span>)}
</Button>
```

共有 `Button`（`src/components/ui/button.tsx`、shadcn）が `disabled` を forward することを確認する — shadcn のボタンはデフォルトでそうなっている。

**検証**: `bunx tsc --noEmit` → exit 0；`bun run lint` → exit 0。

### Step 3: このコンポーネントがテストされている場合、コンポーネントテストを追加

このコンポーネント付近に既存テストがあるか確認する:
`ls src/components/store/cards/*.test.tsx 2>/dev/null` とリポジトリ内で checkout カードの RTL テストを検索する。
- **姉妹コンポーネントのテストパターンが存在する場合**、`@/queries/user`（`placeOrder`、`emptyUserCart`）をモックし、`PlaceOrderCard` をレンダーし、ボタンを素早く2回クリックし、`placeOrder` が**1回だけ**呼ばれたことを assert するテストを追加する。最も近い既存の `render`/`fireEvent`/`waitFor` テストを手本にする。
- **この領域にコンポーネントテストが存在しない場合**、新しいテストハーネスを組み立てないこと — 代わりに、この修正が UI でガードされ手動で確認済みであることをレポートに記す。（1コンポーネントのために新規テストインフラを作るのは本プランの範囲を超える。）

**検証**（テストを追加した場合）: `bun run test -- src/components/store/cards` → 全件 pass。

## Test plan

- ここにコンポーネントテストが存在する場合: ダブルクリック → `placeOrder` が1回だけ呼ばれる；保留中はボタンが `disabled`；reject 時にエラー toast；住所欠落経路は住所 toast を表示し `placeOrder` を呼ばない。
- 構造パターン: `src/components/store/**` 内の最も近い既存 RTL コンポーネントテスト。
- そのようなテストが存在しない場合、検証は型チェック + lint + 手動確認（レポートに記載）とする。

## Done criteria

以下すべてを満たすこと:

- [ ] `bunx tsc --noEmit` が exit 0
- [ ] `bun run lint` が exit 0
- [ ] `grep -n "isPlacingOrderRef" src/components/store/cards/place-order.tsx` がガードを示す
- [ ] `grep -n "disabled={loading}" src/components/store/cards/place-order.tsx` が disabled 化されたボタンを示す
- [ ] `src/queries/user.ts` の `placeOrder` が変更されていない（`git diff --stat` がそこに変更を示さない）
- [ ] 対象外リストのファイルが一切変更されていない（`git status`）
- [ ] `plans/README.md` の 006 のステータス行が更新されている

## STOP conditions

以下に該当する場合は停止して報告すること:

- コンポーネントが「Current state」の抜粋と一致しない（ドリフト）。
- 共有 `Button` が `disabled` を受け付けない（shadcn としては想定外）— 報告する。
- 観測されたリスクに対してクライアントガードでは不十分であり、今すぐ真にサーバー側変更が必要だと結論づけた場合 — `placeOrder` を編集するのではなく報告すること（それは先送りされたより高リスクのフォローアップである）。

## Maintenance notes

- **先送りのフォローアップ（別プラン）**: `placeOrder` を真に並行なリクエストに対して冪等にする — 例えば注文作成の `$transaction` 内でカートを消費/ロックし、2回目の並行呼び出しがカートを見つけられないようにする。これは追跡中の `applyCoupon` ロストアップデートの `$transaction` リファクタ（`specs/.../08-open-questions.md`）と重複し MED risk を伴う；この UI ガードにボルトオンするのではなく、単独でプラン化・レビューすべきである。
- レビュアーは ref が `finally` で解放されていること（マウントされたコンポーネントで恒久的に注文を無効化してしまう `true` 固着経路が無いこと）を確認すること。
- 将来フォーム向けのグローバルな loading/submit 抽象が導入される場合、このガードをそこに統合すること。
