import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { FC } from "react";

interface Variant {
	url: string;
	img: string;
	slug: string;
}

interface Props {
	variants: Variant[];
	slug: string;
}

const ProductVariantSelector: FC<Props> = ({ variants, slug }) => {
	return (
		<div className="flex items-center flex-wrap gap-2">
			{variants.map((variant, i) => (
				<Link href={variant.url} key={i}>
					<div
						className={cn(
							"w-12 h-12 rounded-full grid place-items-center p-0.5  overflow-hidden border border-transparent hover:border-main-primary cursor-pointer transition-all duration-75 ease-in",
							{
								"border-main-primary": slug === variant.slug,
							}
						)}
					>
						<Image
							src={variant.img}
							alt={`product variant ${variant.url}`}
							width={48}
							height={48}
							className="rounded-full"
						/>
					</div>
				</Link>
			))}
		</div>
	);
};

export default ProductVariantSelector;
