/**
 * カテゴリツリー（`SEED_CATEGORIES`）の走査ヘルパー。
 *
 * base-seeder（投入順の決定）と product-seeder（ルート祖先の解決）が同じ木を
 * 別々に遡っていたため、「ノード未定義」「循環」の検証規則が 2 箇所に重複していた。
 * 親解決の規則が seeder 間でずれないよう、ここに集約する。
 */

import { SEED_CATEGORIES } from "./constants/categories";
import type { SeedCategory } from "./types";

/**
 * url からノードを引く。未定義は木の宣言データの誤りなので即座に落とす。
 *
 * @param url - 探すノードの url
 * @returns 一致するノード
 * @throws 該当ノードが `SEED_CATEGORIES` に無い場合
 */
export function findCategoryNode(url: string): SeedCategory {
    const node = SEED_CATEGORIES.find((c) => c.url === url);
    if (!node) throw new Error(`カテゴリが見つかりません: ${url}`);
    return node;
}

/**
 * ルートからの深さ（ルート = 0）を返す。
 *
 * @param url - 対象ノードの url
 * @returns depth（ルートは 0）
 * @throws ノードが見つからない場合／親参照が循環している場合
 */
export function depthOf(url: string): number {
    let depth = 0;
    for (const _ of walkToRoot(url)) depth++;
    return depth;
}

/**
 * リーフの url からルート祖先の url を求める。
 *
 * Phase A の Product は旧 FK（categoryId = ルート）も書く必要があるが、
 * 商品定数はリーフ 1 本しか持たない。ルートは木の宣言データから一意に決まるので、
 * 商品側に冗長に持たせずここで遡る。
 *
 * @param url - 起点ノードの url
 * @returns ルート祖先の url（起点自身がルートならその url）
 * @throws ノードが見つからない場合／親参照が循環している場合
 */
export function rootAncestorUrl(url: string): string {
    let current = url;
    for (const parentUrl of walkToRoot(url)) current = parentUrl;
    return current;
}

/**
 * 親を辿って各ステップの親 url を列挙する（ルートに着いたら終了）。
 * 循環検出をここ 1 箇所に閉じ込めるための内部ジェネレータ。
 */
function* walkToRoot(url: string): Generator<string> {
    const seen = new Set<string>([url]);
    let current = url;

    for (;;) {
        const node = findCategoryNode(current);
        if (!node.parentUrl) return;
        if (seen.has(node.parentUrl)) {
            throw new Error(
                `カテゴリツリーが循環しています: ${node.parentUrl}`
            );
        }
        seen.add(node.parentUrl);
        current = node.parentUrl;
        yield current;
    }
}
