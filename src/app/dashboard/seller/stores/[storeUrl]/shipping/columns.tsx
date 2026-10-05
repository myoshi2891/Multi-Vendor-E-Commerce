"use client";
import { useRef, useState } from "react";
import type { RefObject } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useModal } from "@/providers/modal-provider";
import CustomModal from "@/components/dashboard/shared/custom-modal";
import ShippingRateDetails from "@/components/dashboard/forms/shippingRate-details";
import type {
    ShippingCountryRow,
    ShippingActions,
} from "@/lib/seller-shipping";
import styles from "@/components/dashboard/design/seller.module.css";

type DecimalLike = { toNumber: () => number };

export const formatShippingAmount = (
    value: number | string | DecimalLike | null | undefined
): string => {
    if (value === null || value === undefined) return "Default";
    const numValue =
        typeof value === "object" && "toNumber" in value
            ? value.toNumber()
            : Number(value);
    if (Number.isNaN(numValue)) return "Default";
    if (numValue === 0) return "Free";
    if (numValue > 0) return `$${numValue.toFixed(2)}`;
    return "Default";
};

export function createShippingColumns(actions: {
    storeUrl: string;
    upsertShippingRateAction: ShippingActions["upsertShippingRateAction"];
}): ColumnDef<ShippingCountryRow>[] {
    return [
        {
            accessorKey: "countryName",
            header: "Country",
            cell: ({ row }) => {
                return <span>{row.original.countryName}</span>;
            },
        },
        {
            accessorKey: "shippingService",
            header: "Shipping service",
            cell: ({ row }) => {
                return (
                    <span>
                        {row.original.shippingRate?.shippingService ||
                            "Default"}
                    </span>
                );
            },
        },
        {
            accessorKey: "shippingFeePerItem",
            header: "Shipping Fee per item",
            cell: ({ row }) => {
                const value = row.original.shippingRate?.shippingFeePerItem;
                return <span>{formatShippingAmount(value)}</span>;
            },
        },
        {
            accessorKey: "shippingFeeForAdditionalItem",
            header: "Shipping Fee for additional item",
            cell: ({ row }) => {
                const value =
                    row.original.shippingRate?.shippingFeeForAdditionalItem;
                return <span>{formatShippingAmount(value)}</span>;
            },
        },
        {
            accessorKey: "shippingFeePerKg",
            header: "Shipping Fee per Kg",
            cell: ({ row }) => {
                const value = row.original.shippingRate?.shippingFeePerKg;
                return <span>{formatShippingAmount(value)}</span>;
            },
        },
        {
            accessorKey: "shippingFeeFixed",
            header: "Shipping Fee fixed",
            cell: ({ row }) => {
                const value = row.original.shippingRate?.shippingFeeFixed;
                return <span>{formatShippingAmount(value)}</span>;
            },
        },
        {
            accessorKey: "deliveryTimeMin",
            header: "Delivery min days",
            cell: ({ row }) => {
                return (
                    <span>
                        {row.original.shippingRate?.deliveryTimeMin
                            ? `${row.original.shippingRate?.deliveryTimeMin}`
                            : "Default"}
                    </span>
                );
            },
        },
        {
            accessorKey: "deliveryTimeMax",
            header: "Delivery max days",
            cell: ({ row }) => {
                return (
                    <span>
                        {row.original.shippingRate?.deliveryTimeMax
                            ? `${row.original.shippingRate?.deliveryTimeMax}`
                            : "Default"}
                    </span>
                );
            },
        },
        {
            accessorKey: "returnPolicy",
            header: "Return policy",
            cell: ({ row }) => {
                return (
                    <span>
                        {row.original.shippingRate?.returnPolicy
                            ? `${row.original.shippingRate?.returnPolicy}`
                            : "Default"}
                    </span>
                );
            },
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const rowData = row.original;

                return <CellActions rowData={rowData} {...actions} />;
            },
        },
    ];
}

function RateEditor({
    rowData,
    storeUrl,
    upsertShippingRateAction,
    trigger,
}: {
    rowData: ShippingCountryRow;
    storeUrl: string;
    upsertShippingRateAction: ShippingActions["upsertShippingRateAction"];
    trigger: RefObject<HTMLButtonElement | null>;
}) {
    const [pending, setPending] = useState(false);
    return (
        <CustomModal
            heading={`Edit shipping for ${rowData.countryName}`}
            subheading="Update country-specific delivery and return details."
            design="seller"
            returnFocusTo={trigger}
            locked={pending}
        >
            <ShippingRateDetails
                data={rowData}
                storeUrl={storeUrl}
                upsertShippingRateAction={upsertShippingRateAction}
                onBusyChange={setPending}
                design="seller"
            />
        </CustomModal>
    );
}
function CellActions({
    rowData,
    storeUrl,
    upsertShippingRateAction,
}: {
    rowData: ShippingCountryRow;
    storeUrl: string;
    upsertShippingRateAction: ShippingActions["upsertShippingRateAction"];
}) {
    const { setOpen } = useModal();
    const trigger = useRef<HTMLButtonElement>(null);
    const openingDialog = useRef(false);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    ref={trigger}
                    variant="ghost"
                    className="size-8 p-0"
                    aria-label={`Actions for ${rowData.countryName}`}
                >
                    <MoreHorizontal className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className={styles.theme}
                onCloseAutoFocus={(event) => {
                    if (openingDialog.current) {
                        event.preventDefault();
                        openingDialog.current = false;
                    }
                }}
            >
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem
                    className="flex gap-2"
                    onSelect={() => {
                        openingDialog.current = true;
                        setOpen(
                            <RateEditor
                                rowData={rowData}
                                storeUrl={storeUrl}
                                upsertShippingRateAction={
                                    upsertShippingRateAction
                                }
                                trigger={trigger}
                            />
                        );
                    }}
                >
                    <Edit size={15} />
                    Edit details
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
