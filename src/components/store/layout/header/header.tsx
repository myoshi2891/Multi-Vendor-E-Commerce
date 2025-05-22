import Link from "next/link";
import UserMenu from "./user-menu/user-menu";
import Cart from "./cart";
import DownloadApp from "./download-app";

export default function StoreHeader() {
	return (
		<div className="bg-gradient-to-r from-slate-500 to-slate-800">
			<div className="h-full w-full lg:flex text-white px-4 lg:px-12">
				<div className="flex lg:w-full lg:flex-1 flex-col lg:flex-row gap-3 py-3">
					<div className="flex items-center justify-between">
						<Link href="/">
							<h1 className="font-extrabold text-3xl font-mono">
								GoShop
							</h1>
						</Link>
						<div className="flex lg:hidden">
							<UserMenu />
							<Cart />
						</div>
					</div>
					{/* Search input */}
				</div>
				<div className="hidden lg:flex w-full lg:w-fit lg:mt-2 justify-end mt-1.5 pl-6">
					<div className="lg:flex">
						{/* Download App */}
						<DownloadApp />
					</div>
					{/* Country selector */}
					<UserMenu />
					<Cart />
				</div>
			</div>
		</div>
	);
}
