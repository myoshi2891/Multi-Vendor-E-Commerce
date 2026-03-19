import { ReviewsOrderType } from "@/lib/types";
import { ChevronDown } from "lucide-react";
import { Dispatch, FC, SetStateAction } from "react";

interface Props {
	sort: ReviewsOrderType | undefined;
	setSort: Dispatch<SetStateAction<ReviewsOrderType | undefined>>;
}

const ReviewsSort: FC<Props> = ({ sort, setSort }) => {
	return (
		<div className="group w-[120px]">
			{/* Trigger */}
			<button className="inline-flex items-center py-0.5 text-center text-sm text-main-primary hover:text-[#fd384f]">
				Sort by{" "}
				{sort?.orderBy === "latest"
					? "latest"
					: sort?.orderBy === "highest"
					? "highest"
					: "default"}
				<ChevronDown className="ml-1 w-3" />
			</button>
			<div className="absolute z-10 hidden w-[120px] bg-white shadow group-hover:block">
				<ul className="text-sm text-gray-700">
					<li onClick={() => setSort(undefined)}>
						<span className="block cursor-pointer p-2 hover:bg-gray-100">
							Sort by default
						</span>
					</li>
					<li onClick={() => setSort({ orderBy: "highest" })}>
						<span className="block cursor-pointer p-2 hover:bg-gray-100">
							Sort by highest
						</span>
					</li>
					<li onClick={() => setSort({ orderBy: "latest" })}>
						<span className="block cursor-pointer p-2 hover:bg-gray-100">
							Sort by latest
						</span>
					</li>
				</ul>
			</div>
		</div>
	);
};

export default ReviewsSort;
