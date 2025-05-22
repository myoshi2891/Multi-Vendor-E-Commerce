// Assets
import { AppIcon } from "@/components/store/icons";
import PlayStoreImg from "@/public/assets/icons/google-play.webp"
import AppStoreImg from "@/public/assets/icons/app-store.webp"

// Next.js
import Link from "next/link";
import Image from "next/image";

export default function DownloadApp() {
    return (
		<div className="relative group">
			{/* Trigger */}
			<div className="flex h-11 items-center px-2 cursor-pointer">
				<span className="text-[32px]">
					<AppIcon />
				</span>
				<div className="ml-1">
					<b className="max-w-[90px] inline-block font-medium text-xs text-white">
						Download the GoShop App
					</b>
				</div>
			</div>
			{/* Content */}
			<div className="absolute hidden top-0 group-hover:block cursor-pointer">
				<div className="relative mt-12 -ml-20 w-[300px] bg-white rounded-3xl text-main-primary pt-2 px-1 pb-6 z-50 shadow-lg">
					{/* Triangle */}
					<div className="w-0 h-0 absolute -top-1.5 left-36 !border-l-[10px] !border-l-transparent !border-r-[10px] !border-r-transparent !border-b-[10px] border-b-white"></div>
					<div className="py-3 px-1 break-words">
						<div className="flex">
							<div className="mx-3">
								<h3 className="font-bold text-[20px] text-main-primary m-0 max-w-40 mx-auto">Download the GoShop App</h3>
								<div className="mt-4 flex items-center gap-x-2">
									<Link href="" className="rounded-3xl bg-black grid  place-items-center px-4 py-3" >
									<Image src={AppStoreImg} alt="App Store" width={120} height={40} />
									</Link>
									<Link href="" className="rounded-3xl bg-black grid  place-items-center px-4 py-3" >
									<Image src={PlayStoreImg} alt="Google Play Store" width={120} height={40} />
									</Link>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
