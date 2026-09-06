import Link from "next/link";

/** footer が描くカテゴリリンク 1 件分。ツリーの内部表現は持ち込まない。 */
export interface FooterCategoryLink {
	id: string;
	name: string;
	/** 正準 slug（`Category.url`）。旧 `SubCategory.url` ではない */
	url: string;
}

/**
 * Renders the footer link columns.
 *
 * カテゴリリンクは `?category=<正準slug>` を生成する。カテゴリツリー Phase B
 * （plan 067）以前は旧 `SubCategory.url` を `?subCategory=` に載せていたため、
 * /browse 側の 308 正準化を毎回 1 ホップ踏んでいた。**渡ってくる url が
 * `Category` 由来の正準 slug であることが前提**で、旧 `SubCategory.url` を
 * そのまま `?category=` に載せてはならない（移行時にリネームされた slug は
 * CATEGORY 別名では解決できず 0 件になる）。
 */
export default function Links({
	categories,
}: Readonly<{ categories: FooterCategoryLink[] }>) {
	return (
		<div className="mt-5 grid gap-4 text-sm md:grid-cols-3">
			{/* Categories */}
			<div className="space-y-4">
				<h1 className="text-lg font-bold">Find it Fast</h1>
				<ul className="flex flex-col gap-y-1">
					{categories.map((category) => (
						<li key={category.id}>
							<Link href={`/browse?category=${category.url}`}>
								<span>{category.name}</span>
							</Link>
						</li>
					))}
				</ul>
			</div>
			{/* Profile links */}
			<div className="space-y-4 md:mt-10">
				<ul className="flex flex-col gap-y-1">
					{footer_links.slice(0, 6).map((link) => (
						<li key={link.title}>
							<Link href={link.link}>
								<span>{link.title}</span>
							</Link>
						</li>
					))}
				</ul>
			</div>
			<div className="space-y-4">
				<h1 className="text-lg font-bold">Customer care</h1>
				<ul className="flex flex-col gap-y-1">
					{footer_links.slice(6).map((link) => (
						<li key={link.title}>
							<Link href={link.link}>
								<span>{link.title}</span>
							</Link>
						</li>
					))}
				</ul>
			</div>
			{/* Customer care */}
		</div>
	);
}

const footer_links = [
	{
		title: "About",
		link: "/about",
	},
	{
		title: "Contact",
		link: "/contact",
	},
	{
		title: "Wishlist",
		link: "/profile/wishlist",
	},
	{
		title: "Compare",
		link: "/compare",
	},
	{
		title: "FAQ",
		link: "/faq",
	},
	{
		title: "Store Directory",
		link: "/profile",
	},
	{
		title: "My Account",
		link: "/profile",
	},
	{
		title: "Track your Order",
		link: "/track-order",
	},
	{
		title: "Customer Service",
		link: "/customer-service",
	},
	{
		title: "Returns/Exchange",
		link: "/returns-exchange",
	},
	{
		title: "FAQs",
		link: "/faqs",
	},
	{
		title: "Product Support",
		link: "/product-support",
	},
];
