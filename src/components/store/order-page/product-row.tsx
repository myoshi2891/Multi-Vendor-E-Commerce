import ProductStatusTag from "@/components/shared/product-status";
import { ProductStatus } from "@/lib/types";
import { OrderItem } from "@prisma/client";
import Image from "next/image";

export default function ProductRow({ product }: { product: OrderItem }) {
    const { price } = product;
    return (
        <div className="flex w-full flex-col items-center gap-6 py-6 lg:flex-row">
            <div className="max-lg:w-full">
                <Image
                    src={product.image}
                    alt={product.name}
                    width={200}
                    height={200}
                    className="aspect-square h-36 w-40 rounded-xl object-cover"
                    priority
                />
            </div>
            <div className="flex w-full items-center">
                <div className="grid w-full grid-cols-1 lg:grid-cols-2">
                    <div className="flex items-center">
                        <div>
                            <h2 className="mb-1 line-clamp-2 pr-2 text-xl font-semibold leading-8 text-black">
                                {product.name.split("・")[0]}
                            </h2>
                            <p className="mb-1 text-lg font-normal leading-8 text-gray-500">
                                {product.name.split("・")[1]}
                            </p>
                            <p className="mb-1 text-sm font-normal leading-8 text-gray-500">
                                #{product.sku}
                            </p>
                            <div className="flex items-center">
                                <p className="mr-4 border-r pr-4 text-base font-medium leading-7 text-black">
                                    Size:&nbsp;
                                    <span className="text-gray-500">
                                        {product.size}
                                    </span>
                                </p>
                                <p className="mr-4 pr-4 text-base font-medium leading-7 text-black">
                                    Qty:&nbsp;
                                    <span className="text-gray-500">
                                        {product.quantity}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 pl-5">
                        <div className="col-span-4 flex items-center lg:col-span-1">
                            <div className="flex gap-3 lg:block">
                                <p className="text-sm font-medium leading-7 text-black">
                                    Price
                                </p>
                                <p className="text-sm font-medium leading-7 text-blue-primary lg:mt-4">
                                    ${product.totalPrice.toFixed(2)}
                                </p>
                            </div>
                        </div>
                        <div className="col-span-4 flex items-center lg:col-span-2">
                            <div className="flex gap-3 lg:block">
                                <p className="text-sm font-medium leading-7 text-black">
                                    Status
                                </p>
                                <p className="mt-3 flex py-0.5 leading-6">
                                    <ProductStatusTag
                                        status={product.status as ProductStatus}
                                    />
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
