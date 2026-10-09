"use client";

// React, Next.js imports
import { createContext, useContext, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Custom components
import CustomModal from "@/components/dashboard/shared/custom-modal";
import AttributeDetails, {
    type AttributeCategoryOption,
} from "@/components/dashboard/forms/attribute-details";

// UI components
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Hooks and utilities
import { useModal } from "@/providers/modal-provider";
import { useToast } from "@/hooks/use-toast";

// Lucide icons
import {
    Archive,
    ArchiveRestore,
    Edit,
    Hash,
    List,
    MoreHorizontal,
} from "lucide-react";

// Queries
import type { AttributeActions } from "@/components/dashboard/admin/attribute-actions";
import styles from "@/components/dashboard/design/seller.module.css";
import attributeStyles from "@/components/dashboard/admin/attribute.module.css";

// Tanstack React Table
import { ColumnDef } from "@tanstack/react-table";

// Prisma models
import { AttributeType, type AttributeDefinition } from "@prisma/client";

export type AttributeRow = AttributeDefinition & {
    category: { name: string; path: string };
    _count: { options: number };
};

// 編集フォームのカテゴリ選択肢。全行で同一なので行データへ複製せず Context で 1 回だけ渡す。
// columns（関数）をサーバーから渡さずに済むよう、Provider もこのクライアントモジュールに置く。
const AttributeActionsContext = createContext<AttributeActions | null>(null);

const AttributeCategoriesContext = createContext<AttributeCategoryOption[]>([]);

export function AttributeCategoriesProvider({
    categories,
    actions,
    children,
}: {
    categories: AttributeCategoryOption[];
    actions: AttributeActions;
    children: React.ReactNode;
}) {
    return (
        <AttributeActionsContext.Provider value={actions}>
            <AttributeCategoriesContext.Provider value={categories}>
                {children}
            </AttributeCategoriesContext.Provider>
        </AttributeActionsContext.Provider>
    );
}

export const columns: ColumnDef<AttributeRow>[] = [
    {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
            <div className="flex flex-col">
                <span className="font-semibold">{row.original.name}</span>
                <span className="text-xs text-muted-foreground">
                    {row.original.key}
                </span>
            </div>
        ),
    },
    {
        id: "category",
        header: "Category",
        cell: ({ row }) => <span>/{row.original.category.path}</span>,
    },
    {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
            <span>
                {row.original.type}
                {row.original.unit ? ` (${row.original.unit})` : ""}
                {row.original.type === AttributeType.ENUM
                    ? ` · ${row.original._count.options} options`
                    : ""}
            </span>
        ),
    },
    {
        accessorKey: "scope",
        header: "Scope",
    },
    {
        id: "flags",
        header: "Flags",
        cell: ({ row }) => (
            <div className="flex flex-wrap gap-1">
                {row.original.required && <Badge>Required</Badge>}
                {row.original.facetable && (
                    <Badge variant="secondary">Facet</Badge>
                )}
                {row.original.multiValued && (
                    <Badge variant="secondary">Multi</Badge>
                )}
                {row.original.archivedAt && (
                    <Badge variant="destructive">Archived</Badge>
                )}
            </div>
        ),
    },
    {
        id: "actions",
        cell: ({ row }) => <CellActions rowData={row.original} />,
    },
];

interface CellActionsProps {
    rowData: AttributeRow;
}

const CellActions: React.FC<CellActionsProps> = ({ rowData }) => {
    const { setOpen } = useModal();
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const categories = useContext(AttributeCategoriesContext);
    const actions = useContext(AttributeActionsContext)!;
    const pending = useRef(false);
    const trigger = useRef<HTMLButtonElement>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    const run = async <T,>(
        action: () => Promise<T>,
        success: string | ((result: T) => string)
    ) => {
        if (pending.current) return;
        pending.current = true;
        setLoading(true);
        setFeedback(null);
        setFailed(false);
        try {
            const result = await action();
            const message =
                typeof success === "string" ? success : success(result);
            setFeedback(message);
            toast({ title: message });
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

    const { category: _category, _count, ...definition } = rowData;
    const archived = Boolean(rowData.archivedAt);

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
                            Open menu for {rowData.name}
                        </span>
                        <MoreHorizontal className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    className={`${styles.theme} ${attributeStyles.surface}`}
                >
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    {!archived && (
                        <DropdownMenuItem
                            className="flex min-h-11 gap-2"
                            disabled={loading}
                            onClick={() =>
                                setOpen(
                                    <AttributeEditModal
                                        data={definition}
                                        categories={categories}
                                        saveAction={actions.saveAction}
                                        returnFocusTo={trigger}
                                    />
                                )
                            }
                        >
                            <Edit size={15} />
                            Edit details
                        </DropdownMenuItem>
                    )}
                    {rowData.type === AttributeType.ENUM && (
                        <DropdownMenuItem asChild>
                            <Link
                                className="flex gap-2"
                                href={`/dashboard/admin/attributes/${rowData.id}/options`}
                            >
                                <List size={15} />
                                Manage options
                            </Link>
                        </DropdownMenuItem>
                    )}
                    {rowData.type === AttributeType.TEXT && !archived && (
                        <DropdownMenuItem
                            className="flex min-h-11 gap-2"
                            disabled={loading}
                            onClick={() =>
                                run(
                                    () => actions.convertAction(rowData.id),
                                    (result) =>
                                        result.route === 1
                                            ? `Converted ${result.converted} values to NUMBER.`
                                            : `Converted ${result.converted} values. ${result.unconvertible} unconvertible values stay on the archived TEXT attribute.`
                                )
                            }
                        >
                            <Hash size={15} />
                            Convert to NUMBER
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {archived ? (
                        <DropdownMenuItem
                            className="flex min-h-11 gap-2"
                            disabled={loading}
                            onClick={() =>
                                run(
                                    () => actions.restoreAction(rowData.id),
                                    "Attribute restored."
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
                                    "Attribute archived. Existing values are kept."
                                )
                            }
                        >
                            <Archive size={15} />
                            Archive
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            {loading && <p role="status">Updating attribute…</p>}
            {feedback && <p role="status">{feedback}</p>}
            {failed && (
                <p role="alert" className={styles.alert}>
                    Could not update attribute. Please try again from the
                    actions menu.
                </p>
            )}
        </div>
    );
};

function AttributeEditModal({
    data,
    categories,
    saveAction,
    returnFocusTo,
}: {
    data: AttributeDefinition;
    categories: AttributeCategoryOption[];
    saveAction: AttributeActions["saveAction"];
    returnFocusTo: React.RefObject<HTMLElement | null>;
}) {
    const [busy, setBusy] = useState(false);
    return (
        <CustomModal
            design="seller"
            className={attributeStyles.surface}
            heading={`Edit attribute ${data.name}`}
            subheading="Update the attribute information."
            locked={busy}
            returnFocusTo={returnFocusTo}
        >
            <AttributeDetails
                data={data}
                categories={categories}
                saveAction={saveAction}
                onBusyChange={setBusy}
            />
        </CustomModal>
    );
}
