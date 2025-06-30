"use client";
import OrderStatusTag from "@/components/shared/order-status";
import PaymentStatusTag from "@/components/shared/payment-status";
import { Button } from "@/components/ui/button";
import { OrderFullType, OrderStatus, PaymentStatus } from "@/lib/types";
import { ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import { generateOrderPDFBlob } from "./pdf-invoice";
import { downloadBlobAsFile } from "@/lib/utils";

export default function OrderHeader({ order }: { order: OrderFullType }) {
    if (!order) return null;

    const handleDownload = async () => {
        try {
            const pdfBlob = await generateOrderPDFBlob(order);
            downloadBlobAsFile(pdfBlob, `Order-${order.id}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
        }
    };
    return (
        <div>
            <div className="flex w-full items-center justify-between border-b p-2">
                <div className="flex items-center gap-x-3">
                    <div className="border-r pr-4">
                        <button className="grid size-10 place-items-center rounded-full border">
                            <ChevronLeft className="stroke-main-secondary" />
                        </button>
                    </div>
                    <h1 className="text-main-secondary">Order Details</h1>
                    <ChevronRight className="w-4 stroke-main-secondary" />
                    <h2>Order #{order.id}</h2>
                    <PaymentStatusTag
                        status={order.paymentStatus as PaymentStatus}
                    />
                    <OrderStatusTag status={order.orderStatus as OrderStatus} />
                </div>
                <div className="flex items-center gap-x-2">
                    <Button variant="outline" onClick={() => handleDownload()}>
                        <Download className="me-2 w-4" />
                        Export
                    </Button>
                    <Button variant="outline">
                        <Printer className="me-2 w-4" />
                        Print
                    </Button>
                </div>
            </div>
        </div>
    );
}
