import { cn } from "@/lib/utils";
import { currentUser } from "@clerk/nextjs/server";
import { ChevronDown, UserIcon } from "lucide-react";
import Image from "next/image";

export default async function UserMenu() {
	// Get the current user
	const user = await currentUser();

	return (
		<div className="relative group">
			{/* Trigger */}
			<div className="">
				{user ? (
					<Image
						src={user.imageUrl}
						alt={user.fullName!}
						width={40}
						height={40}
						className="rounded-full"
					/>
				) : (
					<div className="flex h-11 items-center py-0 cursor-pointer">
						<span className="text-2xl">
							<UserIcon />
						</span>
						<div className="ml-1">
							<span className="block text-xs text-white leading-3">
								Welcome
							</span>
							<b className="font-bold text-xs text-white leading-4">
								<span>Sign in / Register</span>
								<span className="text-white scale-[60%] align-middle inline-block">
									<ChevronDown />
								</span>
							</b>
						</div>
					</div>
				)}
			</div>
			{/* Content */}
			<div
				className={cn(
					"hiddenn absolute top-0 -left-20 group-hover:block cursor-pointer",
					{ "-left-[200px] lg:-left-[138px]": user }
				)}
			>
				<div className="relative left-2 mt-10 right-auto bottom-auto pt-2.5 text-[#222] p-0 text-sm z-40">
					{/* { Triangle } */}
                    <div className="w-0 h-0 absolute left-[149px] top-1 right-24 !border-l-[10px] !border-l-transparent !border-r-[10px] !border-r-transparent !border-b-[10px] !border-b-white">
                        {/* Menu */}
                    </div>
				</div>
			</div>
		</div>
	);
}
