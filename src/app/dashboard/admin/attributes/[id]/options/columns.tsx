"use client";

// React, Next.js imports
import { useState, useRef } from "react";
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
import type { AttributeOptionActions } from "@/components/dashboard/admin/attribute-actions";
import styles from "@/components/dashboard/design/seller.module.css";
import attributeStyles from "@/components/dashboard/admin/attribute.module.css";

// Tanstack React Table
import { ColumnDef } from "@tanstack/react-table";

// Prisma models
import type { AttributeOption } from "@prisma/client";

export function getAttributeOptionColumns(
    actions: AttributeOptionActions
): ColumnDef<AttributeOption>[] {
    return [
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
            cell: ({ row }) => (
                <CellActions rowData={row.original} actions={actions} />
            ),
        },
    ];
}

const CellActions: React.FC<{
    rowData: AttributeOption;
    actions: AttributeOptionActions;
}> = ({ rowData, actions }) => {
    const { setOpen } = useModal();
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const pending = useRef(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    const run = async (action: () => Promise<unknown>, success: string) => {
        if (pending.current) return;
        pending.current = true;
        setLoading(true);
        setFeedback(null);
        setFailed(false);
        try {
            await action();
            setFeedback(success);
            toast({ title: success });
            router.refresh();
        } catch (error: unknown) {
            setFailed(true);
            toast({
                variant: "destructive",
                title: "Error",
                description:
                    error instanceof Error ? error.message : "Action failed.",
            });
        } finally {
            pending.current = false;
            setLoading(false);
        }
    };

    return (
        <div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        ref={trigger}
                        variant="ghost"
                        className="size-11 p-0"
                        disabled={loading}
                    >
                        <span className="sr-only">
                            Open menu for {rowData.label}
                        </span>
                        <MoreHorizontal className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    className={`${styles.theme} ${attributeStyles.surface}`}
                >
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem
                        className="flex min-h-11 gap-2"
                        disabled={loading}
                        onClick={() =>
                            setOpen(
                                <OptionEditModal
                                    data={rowData}
                                    saveAction={actions.saveAction}
                                    returnFocusTo={trigger}
                                />
                            )
                        }
                    >
                        <Edit size={15} />
                        Edit label
                    </DropdownMenuItem>
                    {rowData.archivedAt ? (
                        <DropdownMenuItem
                            className="flex min-h-11 gap-2"
                            disabled={loading}
                            onClick={() =>
                                run(
                                    () => actions.restoreAction(rowData.id),
                                    "Option restored."
                                )
                            }
                        >
                            <ArchiveRestore size={15} />
                            Restore
                        </DropdownMenuItem>
                    ) : (
                        <DropdownMenuItem
                            className="flex min-h-11 gap-2"
                            disabled={loading}
                            onClick={() =>
                                run(
                                    () => actions.archiveAction(rowData.id),
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
            {loading && <p role="status">Updating option…</p>}
            {feedback && <p role="status">{feedback}</p>}
            {failed && (
                <p role="alert" className={styles.alert}>
                    Could not update option. Please try again from the actions
                    menu.
                </p>
            )}
        </div>
    );
};

function OptionEditModal({
    data,
    saveAction,
    returnFocusTo,
}: {
    data: AttributeOption;
    saveAction: AttributeOptionActions["saveAction"];
    returnFocusTo: React.RefObject<HTMLElement | null>;
}) {
    const [busy, setBusy] = useState(false);
    return (
        <CustomModal
            design="seller"
            className={attributeStyles.surface}
            heading={`Edit option ${data.label}`}
            subheading="The machine value is permanent."
            locked={busy}
            returnFocusTo={returnFocusTo}
        >
            <AttributeOptionDetails
                definitionId={data.definitionId}
                data={data}
                saveAction={saveAction}
                onBusyChange={setBusy}
            />
        </CustomModal>
    );
}
