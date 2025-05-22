// React
import { ReactNode } from "react";
// Components
import StoreHeader from "@/components/store/layout/header/header";

export default function StoreLayout({ children }: { children: ReactNode }) {
	return (
		<div>
			<StoreHeader />
			<div className="">{children}</div>
			<div className="">Footer</div>
		</div>
	);
}
