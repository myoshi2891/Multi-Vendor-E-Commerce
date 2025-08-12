import PaymentStatusTag from "@/components/shared/payment-status";
import {
    AdminStoreType,
    OrderStatus,
    PaymentStatus,
    ProductStatus,
    StoreOrderType,
    StoreStatus,
} from "@/lib/types";
import { cn, getShippingDatesRange } from "@/lib/utils";
import Image from "next/image";
import { FC, useState } from "react";
import OrderStatusSelect from "../forms/order-status-select";
import ProductStatusSelect from "../forms/product-status-select";
import StoreStatusSelect from "../forms/store-status-select";

interface Props {
    store: AdminStoreType;
}

const StoreSummary: FC<Props> = ({ store }) => {
    const [showFullDesc, setShowFullDesc] = useState<boolean>(false);
    return (
        <div className="relative py-2">
            <div className="w-full px-1">
                <div className="space-y-3">
                    <h2 className="line-clamp-1 text-ellipsis text-3xl font-bold leading-10">
                        Store Details
                    </h2>
                    <h6 className="text-2xl font-semibold leading-9">
                        #{store.id}
                    </h6>
                    <div className="flex items-center gap-x-2">
                        <StoreStatusSelect
                            status={store.status as StoreStatus}
                            storeId={store.id}
                        />
                    </div>
                </div>
                <div className="relative mt-4">
                    <Image
                        src={store.cover}
                        alt="store cover"
                        width={1000}
                        height={400}
                        className="h-80 w-full rounded-md object-cover"
                    />
                    <Image
                        src={store.logo}
                        alt="store logo"
                        width={200}
                        height={200}
                        className="absolute -bottom-11 left-11 size-36 rounded-full object-cover shadow-lg"
                    />
                </div>
                <div className="mt-16 space-y-3">
                    <h1 className="text-2xl font-semibold">{store.name}</h1>
                    <div>
                        <p
                            className={cn("text-sm", {
                                "line-clamp-4": !showFullDesc,
                            })}
                        >
                            {store.description}
                        </p>
                        <span
                            className="cursor-pointer text-sm text-blue-primary hover:underline"
                            onClick={() => setShowFullDesc((prev) => !prev)}
                        >
                            {showFullDesc ? "Show Less" : "Show More"}
                        </span>
                    </div>
                </div>
                <div className="mb-6 mt-3 grid grid-cols-1 gap-3 border-gray-100 py-4">
                    <div className="grid grid-cols-2">
                        <div>
                            <p className="mb-3 text-base font-normal leading-7 text-gray-500 transition-all duration-500">
                                Store email
                            </p>
                            <h6 className="text-lg font-semibold leading-9">
                                {store.email}
                            </h6>
                        </div>
                        <div>
                            <p className="mb-3 text-base font-normal leading-7 text-gray-500 transition-all duration-500">
                                Store phone number
                            </p>
                            <h6 className="text-lg font-semibold leading-9">
                                {store.phone}
                            </h6>
                        </div>
                    </div>
                    <div className="grid grid-cols-2">
                        <div>
                            <p className="mb-3 text-base font-normal leading-7 text-gray-500 transition-all duration-500">
                                Store url
                            </p>
                            <h6 className="text-lg font-semibold leading-9">
                                /{store.url}
                            </h6>
                        </div>
                    </div>
                </div>
                {/* Shipping details table */}
                <div>
                    <h2 className="mb-4 text-2xl font-semibold leading-tight text-gray-500">
                        Shipping Details
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <tbody>
                                <tr className="border-b border-gray-100 dark:border-gray-100/20">
                                    <td className="p-3">
                                        <p className="font-semibold">
                                            Shipping Service
                                        </p>
                                    </td>
                                    <td className="p-3">
                                        <p>
                                            {store.defaultShippingService ||
                                                "-"}
                                        </p>
                                    </td>
                                </tr>
                                <tr className="border-b  border-gray-100 dark:border-gray-100/20">
                                    <td className="p-3">
                                        <p className="font-semibold">
                                            Shipping Fee per item
                                        </p>
                                    </td>
                                    <td className="p-3">
                                        <p>
                                            ${store.defaultShippingFeePerItem}
                                        </p>
                                    </td>
                                </tr>
                                <tr className="border-b border-gray-100 dark:border-gray-100/20">
                                    <td className="p-3">
                                        <p className="font-semibold">
                                            Shipping Fee for additional item
                                        </p>
                                    </td>
                                    <td className="p-3">
                                        <p>
                                            $
                                            {
                                                store.defaultShippingFeeForAdditionalItem
                                            }
                                        </p>
                                    </td>
                                </tr>
                                <tr className="border-b border-gray-100 dark:border-gray-100/20">
                                    <td className="p-3">
                                        <p className="font-semibold">
                                            Shipping Fee per kg
                                        </p>
                                    </td>
                                    <td className="p-3">
                                        <p>${store.defaultShippingFeePerKg}</p>
                                    </td>
                                </tr>
                                <tr className="border-b border-gray-100 dark:border-gray-100/20">
                                    <td className="p-3">
                                        <p className="font-semibold">
                                            Shipping fee fixed
                                        </p>
                                    </td>
                                    <td className="p-3">
                                        <p>${store.defaultShippingFeeFixed}</p>
                                    </td>
                                </tr>
                                <tr className="border-b border-gray-100 dark:border-gray-100/20">
                                    <td className="p-3">
                                        <p className="font-semibold">
                                            Shipping Delivery min days
                                        </p>
                                    </td>
                                    <td className="p-3">
                                        <p>
                                            {store.defaultDeliveryTimeMin} days
                                        </p>
                                    </td>
                                </tr>
                                <tr className="border-b border-gray-100 dark:border-gray-100/20">
                                    <td className="p-3">
                                        <p className="font-semibold">
                                            Shipping Delivery max days
                                        </p>
                                    </td>
                                    <td className="p-3">
                                        <p>
                                            {store.defaultDeliveryTimeMax} days
                                        </p>
                                    </td>
                                </tr>
                                <tr className="border-b border-gray-100 dark:border-gray-100/20">
                                    <td className="p-3">
                                        <p className="font-semibold">
                                            Return policy
                                        </p>
                                    </td>
                                    <td className="p-3">
                                        <p>{store.returnPolicy || "-"} </p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StoreSummary;
