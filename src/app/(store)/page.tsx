import ThemeToggle from "@/components/shared/theme-toggle";
import ProductList from "@/components/store/shared/product-list";
import { getProducts } from "@/queries/product";
import { UserButton } from "@clerk/nextjs";

export default async function HomePage() {
	const productsData = await getProducts();
	const { products } = productsData;
	console.log("products", products);
	
	return (
		<div className="p-14">
			<ProductList products={products} title="Products" arrow />
		</div>
	);
}
