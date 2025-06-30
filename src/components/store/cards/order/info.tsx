import { PaymentDetails } from "@prisma/client";

export default function OrderInfoCard({
    totalItemsCount,
    deliveredItemsCount,
    paymentDetails,
}: {
    totalItemsCount: number;
    deliveredItemsCount: number;
    paymentDetails: PaymentDetails | null;
}) {
    return (
        <div>
            <div className="w-full p-4 shadow-sm">
                <div className="flex justify-between">
                    <div className="space-y-4">
                        <p className="text-sm text-main-primary">Total Items</p>
                        <p className="text-sm text-main-primary">Delivered</p>
                        <p className="text-sm text-main-primary">
                            Payment Status
                        </p>
                        <p className="text-sm text-main-primary">
                            Payment Method
                        </p>
                        <p className="text-sm text-main-primary">
                            Payment Reference
                        </p>
                        <p className="text-sm text-main-primary">Paid at</p>
                    </div>
                    <div className="space-y-4 text-right">
                        <p className="text-sm text-neutral-500">
                            {totalItemsCount}
                        </p>
                        <p className="mt-0.5 text-sm text-neutral-500">
                            {deliveredItemsCount}
                        </p>
                        <p className="mt-0.5 text-sm text-neutral-500">
                            {paymentDetails ? paymentDetails.status : "Unpaid"}
                        </p>
                        <p className="mt-0.5 text-sm text-neutral-500">
                            {paymentDetails
                                ? paymentDetails.paymentMethod
                                : "-"}
                        </p>
                        <p className="mt-0.5 text-sm text-neutral-500">
                            {paymentDetails
                                ? paymentDetails.paymentIntentId
                                : "-"}
                        </p>
                        <p className="mt-0.5 text-sm text-neutral-500">
                            {paymentDetails &&
                            paymentDetails.status === "Completed"
                                ? paymentDetails.updatedAt.toDateString()
                                : "-"}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
