"use client";
import OrderStatusTag from "@/components/shared/order-status";
import PaymentStatusTag from "@/components/shared/payment-status";
import type { OrderInvoice } from "@/lib/order-invoice";
import { OrderStatus, PaymentStatus } from "@/lib/types";
import { downloadBlobAsFile, printPDF } from "@/lib/utils";
import Link from "next/link";
import { useRef, useState } from "react";
import styles from "../shared/commerce.module.css";

export default function OrderHeader({ order }: { order: OrderInvoice }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(false);
    const locked = useRef(false);
    async function invoice(print: boolean) {
        if (locked.current) return;
        locked.current = true;
        setBusy(true);
        setError(false);
        try {
            const { generateOrderPDFBlob } = await import("./pdf-invoice");
            const blob = await generateOrderPDFBlob(order);
            if (print) printPDF(blob);
            else downloadBlobAsFile(blob, `Order-${order.id}.pdf`);
        } catch {
            setError(true);
        } finally {
            locked.current = false;
            setBusy(false);
        }
    }
    return (
        <header className={styles.hero}>
            <nav className={styles.breadcrumb} aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <Link href="/profile/orders">My orders</Link>
                <span aria-current="page">Order details</span>
            </nav>
            <h1>Order Details</h1>
            <p>Order #{order.id}</p>
            <div className={styles.badges}>
                <PaymentStatusTag
                    status={order.paymentStatus as PaymentStatus}
                />
                <OrderStatusTag status={order.orderStatus as OrderStatus} />
            </div>
            <div className={styles.actions}>
                <Link href="/profile/orders" className={styles.secondary}>
                    Back to orders
                </Link>
                <button
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() => void invoice(false)}
                >
                    Export
                </button>
                <button
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() => void invoice(true)}
                >
                    Print
                </button>
            </div>
            {busy && <p role="status">Preparing your invoice…</p>}
            {error && (
                <p role="alert">
                    We couldn’t prepare your invoice. Please try again.
                </p>
            )}
        </header>
    );
}
