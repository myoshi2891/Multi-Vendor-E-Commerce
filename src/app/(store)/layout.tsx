// React
import { ReactNode } from "react";
// Components
import StoreHeader from "@/components/store/layout/header/header";
import CategoriesHeader from "@/components/store/layout/categories-header/categories-header";
import Footer from "@/components/store/layout/footer/footer";

// Toaster
import {Toaster} from "react-hot-toast"

export default function StoreLayout({ children }: { children: ReactNode }) {
	return (
		<div>
			<StoreHeader />
			<CategoriesHeader />
			<div className="">{children}</div>
			<div className="h-96"></div>
			<Footer />
			<Toaster position="top-center" />
		</div>
	);
}
