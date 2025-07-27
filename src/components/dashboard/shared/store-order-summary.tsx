import {
    PaymentStatus,
    StoreOrderType,
    UserShippingAddressType,
} from "@/lib/types";
import { getShippingDatesRange } from "@/lib/utils";
import { PaymentDetails } from "@prisma/client";
import { FC } from "react";

interface Props {
    group: StoreOrderType;
}

const StoreOrderSummary: FC<Props> = ({
    group,
}) => {
    const paymentDetails = group.order.paymentDetails
    const paymentStatus = group.order.paymentStatus
    const shippingAddress = group.order.shippingAddress
    const { minDate, maxDate } = getShippingDatesRange(
        group.shippingDeliveryMin,
        group.shippingDeliveryMax,
        group.createdAt
    );

    const {
        address1,
        address2,
        city,
        country,
        firstName,
        lastName,
        phone,
        state,
        zip_code,
        user,
    } = shippingAddress;

    const { coupon, couponId, subTotal, total, shippingFees } = group;

    let discountedAmount = 0;
    if (couponId && coupon) {
        discountedAmount = ((subTotal + shippingFees) * coupon.discount) / 100;
    }

    return (
        <div className="relative py-2">
            <div className="w-full px-1">
                <div className="space-y-3">
                    <h2 className="line-clamp-1 text-ellipsis text-3xl font-bold leading-10">
                        Order Details
                    </h2>
                    <h6 className="text-2xl font-semibold leading-9">
                        #{group.id}
                    </h6>
                </div>
            </div>
        </div>
    );
};

export default StoreOrderSummary;
