import { flattenCategoryTree } from "@/lib/category-tree";
import { getAllCategories } from "@/queries/category";
import Contact from "./contact";
import Links, { FooterCategoryLink } from "./links";
import Newsletter from "./newsletter";

/** footer の "Find it Fast" に並べるリンクの上限。 */
const FOOTER_CATEGORY_LIMIT = 7;

/**
 * Renders the store footer.
 *
 * カテゴリツリー Phase B（plan 067）で、リンク元を旧 `SubCategory` テーブルから
 * `Category` ツリーへ移した。旧経路は `SubCategory.url` を `?subCategory=` に
 * 載せており、移行でリネームされた slug は /browse の 308 正準化を 1 ホップ
 * 踏んでいた。ツリーから引けば最初から正準 slug なのでホップが要らない。
 *
 * 子ノード（旧サブカテゴリ相当）を優先し、無ければルートで埋める。ツリーが
 * 1 階層しかない環境（seed 直後など）でリンク欄が空にならないようにするため。
 *
 * @returns The footer layout, including the newsletter section, contact details, category links, and rights bar.
 */
export default async function Footer() {
	const nodes = flattenCategoryTree(await getAllCategories());
	const descendants = nodes.filter((node) => node.depth > 0);
	const picked = descendants.length > 0 ? descendants : nodes;
	const categories: FooterCategoryLink[] = picked
		.slice(0, FOOTER_CATEGORY_LIMIT)
		.map(({ id, name, url }) => ({ id, name, url }));
	return (
		<div data-testid="store-footer" className="w-full bg-white">
			<Newsletter />
			<div className="mx-auto max-w-[1430px]">
				<div className="p-5">
					<div className="grid md:grid-cols-2 md:gap-x-5">
						<Contact />
						<Links categories={categories} />
					</div>
				</div>
			</div>
			{/* Rights */}
			<div className="bg-gradient-to-r from-slate-500 to-slate-800 px-2 text-white">
				<div className="mx-auto flex h-7 max-w-[1430px] items-center">
					<span className="text-sm">
						<b>@ GoShop</b> - All Rights Reserved
					</span>
				</div>
			</div>
		</div>
	);
}
