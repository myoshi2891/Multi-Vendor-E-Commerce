"use client";

// React, Next.js imports
import { useState } from "react";
import { useRouter } from "next/navigation";

// Custom components
import CustomModal from "@/components/dashboard/shared/custom-modal";
import AttributeOptionDetails from "@/components/dashboard/forms/attribute-option-details";

// UI components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Hooks and utilities
import { useModal } from "@/providers/modal-provider";
import { useToast } from "@/hooks/use-toast";

// Lucide icons
import { Archive, ArchiveRestore, Edit, MoreHorizontal } from "lucide-react";

// Queries
import {
    archiveAttributeOption,
    restoreAttributeOption,
} from "@/queries/attribute";

// Tanstack React Table
import { ColumnDef } from "@tanstack/react-table";

// Prisma models
import type { AttributeOption } from "@prisma/client";

export const columns: ColumnDef<AttributeOption>[] = [
    {
        accessorKey: "label",
        header: "Label",
        cell: ({ row }) => (
            <span className="font-semibold">{row.original.label}</span>
        ),
    },
    {
        accessorKey: "value",
        header: "Value",
    },
    {
        accessorKey: "sortOrder",
        header: "Order",
    },
    {
        id: "status",
        header: "Status",
        cell: ({ row }) =>
            row.original.archivedAt ? (
                <Badge variant="destructive">Archived</Badge>
            ) : (
                <Badge variant="secondary">Active</Badge>
            ),
    },
    {
        id: "actions",
        cell: ({ row }) => <CellActions rowData={row.original} />,
    },
];

const CellActions: React.FC<{ rowData: AttributeOption }> = ({ rowData }) => {
    const { setOpen } = useModal();
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const run = async (action: () => Promise<unknown>, success: string) => {
        if (loading) return;
        setLoading(true);
        try {
            await action();
            toast({ title: success });
            router.refresh();
        } catch (error: unknown) {
            toast({
                variant: "destructive",
                title: "Error",
                description:
                    error instanceof Error ? error.message : "Action failed.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="size-8 p-0"
                    disabled={loading}
                >
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem
                    className="flex gap-2"
                    onClick={() =>
                        setOpen(
                            <CustomModal>
                                <AttributeOptionDetails
                                    definitionId={rowData.definitionId}
                                    data={rowData}
                                />
                            </CustomModal>
                        )
                    }
                >
                    <Edit size={15} />
                    Edit label
                </DropdownMenuItem>
                {rowData.archivedAt ? (
                    <DropdownMenuItem
                        className="flex gap-2"
                        onClick={() =>
                            run(
                                () => restoreAttributeOption(rowData.id),
                                "Option restored."
                            )
                        }
                    >
                        <ArchiveRestore size={15} />
                        Restore
                    </DropdownMenuItem>
                ) : (
                    <DropdownMenuItem
                        className="flex gap-2"
                        onClick={() =>
                            run(
                                () => archiveAttributeOption(rowData.id),
                                "Option archived. Products keep their current value."
                            )
                        }
                    >
                        <Archive size={15} />
                        Archive
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
