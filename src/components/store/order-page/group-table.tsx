import OrderStatusTag from "@/components/shared/order-status";
import { OrderGroupWithItemsType, OrderStatus } from "@/lib/types";
import Image from "next/image";
import ProductRow from "./product-row";

export default function OrderGroupTable({
    group,
    deliveryInfo,
}: {
    group: OrderGroupWithItemsType;
    deliveryInfo: {
        shippingService: string;
        deliveryMinDate: string;
        deliveryMaxDate: string;
    };
}) {
    const { shippingService, deliveryMinDate, deliveryMaxDate } = deliveryInfo;
    const { coupon, couponId, subTotal, total, shippingFees } = group;
    let discountedAmount = 0;
    if (couponId && coupon) {
        discountedAmount = ((subTotal + shippingFees) * coupon.discount) / 100;
    }
    return (
        <div className="max-w-xl rounded-xl border border-gray-200 pt-6 max-lg:mx-auto lg:max-w-full">
            <div className="flex flex-col justify-between border-b border-gray-200 px-6 pb-6 lg:flex-row lg:items-center">
                <div>
                    <p className="text-base font-semibold leading-7 text-black">
                        Order Id:
                        <span className="ms-2 font-medium text-blue-primary">
                            #{group.id}
                        </span>
                    </p>
                    <div className="mt-4 flex items-center gap-x-2">
                        <Image
                            src={group.store.logo}
                            alt={group.store.name}
                            width={100}
                            height={100}
                            className="size-10 rounded-full object-cover"
                            priority
                        />
                        <span className="font-medium text-main-secondary">
                            {group.store.name}
                        </span>
                        <div className="mx-2 h-5 w-px bg-border" />
                        <p>{shippingService}</p>
                        <div className="mx-2 h-5 w-px bg-border" />
                    </div>
                </div>
                <OrderStatusTag status={group.status as OrderStatus} />
            </div>
            <div
                className="grid w-full px-3 min-[400px]:px-6"
                style={{ gridTemplateColumns: "4fr 1fr" }}
            >
                <div>
                    {group.items.map((product, index) => (
                        <ProductRow key={index} product={product} />
                    ))}
                </div>
                <div className="flex items-center text-center max-lg:mt-3">
                    <div className="flex gap-3 lg:block">
                        <p className="whitespace-nowrap text-sm font-medium leading-6 text-black">
                            Expected Delivery Time
                        </p>
                        <p className="whitespace-nowrap text-base font-medium leading-7 text-emerald-500 lg:mt-3">
                            {deliveryMinDate} - {deliveryMaxDate}
                        </p>
                    </div>
                </div>
            </div>
            {/* Group Info */}
            <div className="flex w-full flex-col items-center justify-between border-t border-gray-200 px-6 lg:flex-row">
                <div className="flex flex-col items-center border-gray-200 max-lg:border-b sm:flex-row">
                    <button className="group flex items-center justify-center gap-2 whitespace-nowrap border-gray-200 bg-white py-6 text-lg font-semibold text-black outline-0 transition-all duration-500 hover:text-blue-primary sm:border-r sm:pr-6">
                        <svg
                            className="stroke-black transition-all duration-500 group-hover:stroke-blue-primary"
                            xmlns="http://www.w3.org/2000/svg"
                            width={22}
                            height={22}
                            viewBox="0 0 22 22"
                            fill="none"
                        >
                            <path
                                d="M5.5 5.5L16.5 16.5M16.5 5.5L5.5 16.5"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                            />
                        </svg>
                        Cancel Order
                    </button>
                    <p className="border-r px-6 py-3 text-lg font-medium text-gray-900 max-lg:text-center">
                        Subtotal:
                        <span className="ms-1 text-gray-500">
                            ${subTotal.toFixed(2)}
                        </span>
                    </p>
                    <p className="border-r px-6 py-3 text-lg font-medium text-gray-900 max-lg:text-center">
                        Shipping Fees:
                        <span className="ms-1 text-gray-500">
                            ${shippingFees.toFixed(2)}
                        </span>
                    </p>
                    {couponId && (
                        <p className="px-6 py-3 text-lg font-medium text-gray-900 max-lg:text-center">
                            Coupon ({coupon?.code})
                            <span className="ms-1 text-gray-500">
                                (-{coupon?.discount}%)
                            </span>
                            <span className="ms-1 text-gray-500">
                                (-${discountedAmount.toFixed(2)})
                            </span>
                        </p>
                    )}
                </div>
                <div>
                    <p className="py-2 text-xl font-semibold text-black">
                        Total price:
                        <span className="ms-1 text-blue-primary">
                            ${total.toFixed(2)}
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
}
