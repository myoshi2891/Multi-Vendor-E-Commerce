import StoreHeader from "@/components/dashboard/store/layout/header/header";
import  { ReactNode } from "react";

export default function StoreLayout({children}: { children: ReactNode })  {
    return (
		<div>
			<StoreHeader />
            <div className="">{children}</div>
            <div className="">Footer</div>
		</div>
	);
}
