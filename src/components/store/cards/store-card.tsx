"use client";
import { cn } from "@/lib/utils";
import { Check, MessageSquareMore, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FC, useState } from "react";

interface Props {
	store: {
		id: string;
		url: string;
		name: string;
		logo: string;
		followersCount: number;
		isUserFollowingStore: boolean;
	};
}

const StoreCard: FC<Props> = ({ store }) => {
	const { id, name, logo, url, followersCount, isUserFollowingStore } = store;
	const [following, setFollowing] = useState<boolean>(isUserFollowingStore);
	return (
		<div className="w-full">
			<div className="bg-[#f5f5f5] flex items-center justify-between rounded-xl py-3 px-4">
				<div className="flex">
					<Link href={`/store/${url}`}>
						<Image
							src={logo}
							alt={name}
							width={50}
							height={50}
							className="w-12 h-12 object-cover rounded-full"
						/>
					</Link>
					<div className="mx-2">
						<div className="text-xl font-bold leading-6">
							<Link
								href={`/store/${url}`}
								className="text-main-primary"
							>
								{name}
							</Link>
						</div>
						<div className="text-sm leading-5 mt-1">
							<strong>100%</strong>
							<span> Positive Feedback</span>&nbsp;|&nbsp;
							<strong>{followersCount}</strong>
							<strong> Followers</strong>
						</div>
					</div>
				</div>
				<div className="flex">
					<div
						className={cn(
							"flex items-center border border-black rounded-full cursor-pointer text-base font-bold h-9 mx-2 px-4 hover:bg-black hover:text-white",
							{
								"bg-black text-white": following,
							}
						)}
					>
						{following ? (
							<Check className="w-4 me-1" />
						) : (
							<Plus className="w-4 me-1" />
						)}
						<span>{following ? "Following" : "Follow"}</span>
					</div>
					<div className="flex items-center border border-black rounded-full cursor-pointer text-base font-bold h-9 mx-2 px-4 bg-black text-white">
						<MessageSquareMore className="w-4 me-1" />
						<span>Message</span>
					</div>
				</div>
			</div>
		</div>
	);
};

export default StoreCard;
