export default function OrderTotalDetailsCard({
    details,
}: {
    details: {
        subTotal: number;
        shippingFees: number;
        total: number;
    };
}) {
    const { subTotal, shippingFees, total } = details;
    return (
        <div>
            <div className="w-full p-4 shadow-sm">
                <div className="flex justify-between">
                    <div className="space-y-4">
                        <p className="text-lg font-semibold text-main-primary">
                            Subtotal
                        </p>
                        <p className="text-sm text-main-primary">
                            Shipping Fee
                        </p>
                        <p className="text-sm text-main-primary">Taxes</p>
                        <p className="text-lg font-semibold text-main-primary">
                            Total
                        </p>
                    </div>
                    <div className="space-y-4 text-right">
                        <p className="text-lg font-semibold text-main-primary">
                            ${subTotal.toFixed(2)}
                        </p>
                        <p className="mt-0.5 text-sm text-neutral-500">
                            +${shippingFees.toFixed(2)}
                        </p>
                        <p className="mt-0.5 text-sm text-neutral-500">
                            +$0.00
                        </p>
                        <p className="rounded-lg bg-blue-primary px-3 py-1.5 text-sm font-semibold text-white">
                            ${total.toFixed(2)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
