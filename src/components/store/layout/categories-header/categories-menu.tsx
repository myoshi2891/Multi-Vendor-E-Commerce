import { cn } from "@/lib/utils";
import { Category } from "@prisma/client";
import { Menu } from "lucide-react";
import { Dispatch, SetStateAction, useState } from "react";

export default function CategoriesMenu({
	categories,
	open,
	setOpen,
}: {
	categories: Category[];
	open: boolean;
	setOpen: Dispatch<SetStateAction<boolean>>;
}) {
	const [dropdownVisible, setDropdownVisible] = useState<boolean>(false);

	const toggleMenu = (state: boolean) => {
		setOpen(state);
	};
	return (
		<div
			className="relative w-10 h-10 xl:w-[256px] z-50"
            onMouseEnter={() => toggleMenu(true)}
            onMouseLeave={()=> toggleMenu(false)}
		>
            {/* Trigger and Dropdown Container */}
            <div className="relative">
                {/* Trigger */}
                <div className={cn("w-12 xl:w-[256px] h-12 rounded-full -translate-y-1 xl:translate-y-0 xl:h-11 bg-[#535353] text-white text-[20px] relative flex items-center cursor-pointer transition-all duration-100 ease-in-out")}>
                    {/* Menu Icon with transition to move right when open */}
                    <Menu className={cn("absolute xl:ml-1 left-3")} />
                </div>
            </div>
		</div>
	);
}
