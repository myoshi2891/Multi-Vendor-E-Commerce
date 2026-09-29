import { ProductType } from "@/lib/types";
import EditorialProductGrid from './editorial-product-grid';

export default function RelatedProducts({products}: {products: ProductType[]}) {
    return <EditorialProductGrid products={products} title="Related products" eyebrow="MORE TO DISCOVER" />;
}
