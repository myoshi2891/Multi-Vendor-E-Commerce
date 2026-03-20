import { ReviewsOrderType } from "@/lib/types";
import { ChevronDown } from "lucide-react";
import { Dispatch, FC, SetStateAction } from "react";

interface Props {
	sort: ReviewsOrderType | undefined;
	setSort: Dispatch<SetStateAction<ReviewsOrderType | undefined>>;
}

const ReviewsSort: FC<Props> = ({ sort, setSort }) => {
	return (
		<div className="group relative w-[120px]">
			{/* Trigger */}
			<button type="button" className="inline-flex items-center py-0.5 text-center text-sm text-main-primary hover:text-[#fd384f]">
				Sort by{" "}
				{sort?.orderBy === "latest"
					? "latest"
					: sort?.orderBy === "highest"
					? "highest"
					: "default"}
				<ChevronDown className="ml-1 w-3" />
			</button>
			<div className="absolute z-10 hidden w-[120px] bg-white shadow group-hover:block group-focus-within:block" role="menu">
				<ul className="text-sm text-gray-700">
					<li>
						<button role="menuitem" type="button" className="block w-full text-left cursor-pointer p-2 hover:bg-gray-100 focus:bg-gray-100" onClick={() => setSort(undefined)}>
							Sort by default
						</button>
					</li>
					<li>
						<button role="menuitem" type="button" className="block w-full text-left cursor-pointer p-2 hover:bg-gray-100 focus:bg-gray-100" onClick={() => setSort({ orderBy: "highest" })}>
							Sort by highest
						</button>
					</li>
					<li>
						<button role="menuitem" type="button" className="block w-full text-left cursor-pointer p-2 hover:bg-gray-100 focus:bg-gray-100" onClick={() => setSort({ orderBy: "latest" })}>
							Sort by latest
						</button>
					</li>
				</ul>
			</div>
		</div>
	);
};

export default ReviewsSort;
