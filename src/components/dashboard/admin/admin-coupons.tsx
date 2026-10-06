"use client";
import type { Coupon } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import type {
    getCouponAsAdmin,
    upsertCouponAsAdmin,
    deleteCouponAsAdmin,
    toggleCouponActive,
} from "@/queries/coupon";
import { useRouter } from "next/navigation";
import { getCouponPeriodColumns } from "../shared/coupon-columns";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/ui/data-table";
import SellerPage from "../design/seller-page";
import ConfirmDelete from "../design/confirm-delete";
import CouponForm from "./coupon-form";
import MasterDialog from "./master-dialog";
import { useSaveState, SaveFeedback } from "./save-state";
export type AdminCouponRow = Coupon & { store: { name: string } | null };
export type AdminCouponActions = {
    loadAction: typeof getCouponAsAdmin;
    saveAction: typeof upsertCouponAsAdmin;
    deleteAction: typeof deleteCouponAsAdmin;
    toggleAction: typeof toggleCouponActive;
};
function ToggleCoupon({
    coupon,
    action,
}: {
    coupon: Coupon;
    action: typeof toggleCouponActive;
}) {
    const router = useRouter(),
        state = useSaveState();
    return (
        <div>
            <Button
                variant="outline"
                disabled={state.busy}
                onClick={() =>
                    void state.save(
                        () => action(coupon.id),
                        () => router.refresh()
                    )
                }
            >
                {state.busy
                    ? "Updating…"
                    : `${coupon.isActive ? "Deactivate" : "Activate"} ${coupon.code}`}
            </Button>
            <SaveFeedback {...state} />
        </div>
    );
}
export function getAdminCouponColumns(
    actions: AdminCouponActions
): ColumnDef<AdminCouponRow>[] {
    return [
        {
            id: "store",
            header: "Store",
            cell: ({ row }) => <span>{row.original.store?.name ?? "—"}</span>,
        },
        { accessorKey: "code", header: "Code" },
        { accessorKey: "scope", header: "Scope" },
        ...getCouponPeriodColumns<AdminCouponRow>(),
        {
            accessorKey: "isActive",
            header: "Status",
            cell: ({ row }) => (
                <span>{row.original.isActive ? "Active" : "Inactive"}</span>
            ),
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <div className="space-y-3">
                    <MasterDialog
                        label={`Edit coupon ${row.original.code}`}
                        loadAction={() => actions.loadAction(row.original.id)}
                    >
                        {(data, onBusyChange) => (
                            <CouponForm
                                data={data}
                                saveAction={actions.saveAction}
                                onBusyChange={onBusyChange}
                            />
                        )}
                    </MasterDialog>
                    <ToggleCoupon
                        coupon={row.original}
                        action={actions.toggleAction}
                    />
                    <ConfirmDelete
                        label={`coupon ${row.original.code}`}
                        deleteAction={() =>
                            actions.deleteAction(row.original.id)
                        }
                    />
                </div>
            ),
        },
    ];
}
export default function AdminCoupons({
    coupons,
    actions,
}: {
    coupons: AdminCouponRow[];
    actions: AdminCouponActions;
}) {
    return (
        <SellerPage
            workspace="Administration"
            id="admin-coupons"
            title="Coupons"
            description="Manage store and platform discounts, validity and availability."
        >
            <div>
                <MasterDialog<Coupon> label="Create New Coupon">
                    {(_, onBusyChange) => (
                        <CouponForm
                            saveAction={actions.saveAction}
                            onBusyChange={onBusyChange}
                        />
                    )}
                </MasterDialog>
            </div>
            <DataTable
                design="seller"
                data={coupons}
                columns={getAdminCouponColumns(actions)}
                filterValue="code"
                searchPlaceholder="Search coupon code ..."
                newTabLink="/dashboard/admin/coupons/new"
            />
        </SellerPage>
    );
}
