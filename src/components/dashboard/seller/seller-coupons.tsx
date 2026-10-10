"use client";
import { useMemo, useRef, useState } from "react";
import type { Coupon } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import type { getCoupon, upsertCoupon, deleteCoupon } from "@/queries/coupon";
import { getCouponPeriodColumns } from "../shared/coupon-columns";
import DataTable from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import SellerPage from "../design/seller-page";
import styles from "../design/seller.module.css";
import ConfirmDelete from "../design/confirm-delete";
import SellerCouponForm from "./seller-coupon-form";
export type CouponActions = {
    loadAction: typeof getCoupon;
    saveAction: typeof upsertCoupon;
    deleteAction: typeof deleteCoupon;
};
function CouponDialog({
    coupon,
    storeUrl,
    actions,
}: {
    coupon?: Coupon;
    storeUrl: string;
    actions: CouponActions;
}) {
    const [open, setOpen] = useState(false),
        [data, setData] = useState<Coupon | null>(null),
        [loading, setLoading] = useState(false),
        [failed, setFailed] = useState(false),
        [busy, setBusy] = useState(false),
        generation = useRef(0),
        locked = useRef(false);
    async function load() {
        if (!coupon) return;
        const request = ++generation.current;
        setLoading(true);
        setFailed(false);
        setData(null);
        try {
            const result = await actions.loadAction(coupon.id, storeUrl);
            if (request === generation.current) {
                if (!result) throw Error("missing");
                setData(result);
            }
        } catch {
            if (request === generation.current) setFailed(true);
        } finally {
            if (request === generation.current) setLoading(false);
        }
    }
    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (locked.current) return;
                setOpen(value);
                if (value) {
                    if (coupon) void load();
                } else generation.current++;
            }}
        >
            <DialogTrigger asChild>
                <Button variant={coupon ? "outline" : "default"}>
                    {coupon
                        ? `Edit coupon ${coupon.code}`
                        : "Create New Coupon"}
                </Button>
            </DialogTrigger>
            <DialogContent
                closeDisabled={busy}
                className={`${styles.theme} ${styles.dialog}`}
                onEscapeKeyDown={(event) => {
                    if (locked.current) event.preventDefault();
                }}
                onInteractOutside={(event) => {
                    if (locked.current) event.preventDefault();
                }}
            >
                <DialogHeader>
                    <DialogTitle>
                        {coupon ? "Edit coupon" : "Create coupon"}
                    </DialogTitle>
                    <DialogDescription>
                        {coupon
                            ? `Update ${coupon.code}.`
                            : "Create a coupon for this store."}
                    </DialogDescription>
                </DialogHeader>
                {loading ? (
                    <p role="status">Loading coupon…</p>
                ) : failed ? (
                    <div className={styles.alert}>
                        <p role="alert">
                            Could not load coupon. Please try again.
                        </p>
                        <Button variant="outline" onClick={() => void load()}>
                            Retry load
                        </Button>
                    </div>
                ) : (
                    (!coupon || data) && (
                        <SellerCouponForm
                            data={data ?? undefined}
                            storeUrl={storeUrl}
                            saveAction={actions.saveAction}
                            onBusyChange={(value) => {
                                locked.current = value;
                                setBusy(value);
                            }}
                        />
                    )
                )}
            </DialogContent>
        </Dialog>
    );
}
export function getSellerCouponColumns(
    storeUrl: string,
    actions: CouponActions
): ColumnDef<Coupon>[] {
    return [
        { accessorKey: "code", header: "Code" },
        ...getCouponPeriodColumns(),
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <div className="space-y-3">
                    <CouponDialog
                        coupon={row.original}
                        storeUrl={storeUrl}
                        actions={actions}
                    />
                    <ConfirmDelete
                        label={`coupon ${row.original.code}`}
                        deleteAction={() =>
                            actions.deleteAction(row.original.id, storeUrl)
                        }
                    />
                </div>
            ),
        },
    ];
}
export default function SellerCoupons({
    coupons,
    storeUrl,
    actions,
}: {
    coupons: Coupon[];
    storeUrl: string;
    actions: CouponActions;
}) {
    // 列定義を毎 render 作ると router.refresh() のたびに行内の要素が remount され、成功表示や
    // Dialog のフォーカス復帰先が失われる。refresh ごとに別参照になる Server Action は初回の参照を
    // 固定し、列定義を useMemo で固定する（seller-shipping.tsx と同じ）
    const [stableActions] = useState(() => actions);
    const columns = useMemo(
        () => getSellerCouponColumns(storeUrl, stableActions),
        [storeUrl, stableActions]
    );
    return (
        <SellerPage
            id="seller-coupons"
            title="Coupons"
            description="Manage store coupon codes, discounts and validity dates."
        >
            <div>
                <CouponDialog storeUrl={storeUrl} actions={actions} />
            </div>
            <DataTable
                design="seller"
                data={coupons}
                columns={columns}
                filterValue="code"
                searchPlaceholder="Search coupon code ..."
                newTabLink={`/dashboard/seller/stores/${encodeURIComponent(storeUrl)}/coupons/new`}
            />
        </SellerPage>
    );
}
