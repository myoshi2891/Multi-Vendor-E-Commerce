"use client";

// React, Next.js imports
import { useState } from "react";
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
import {
    archiveAttributeDefinition,
    changeAttributeTypeToNumber,
    restoreAttributeDefinition,
} from "@/queries/attribute";

// Tanstack React Table
import { ColumnDef } from "@tanstack/react-table";

// Prisma models
import { AttributeType, type AttributeDefinition } from "@prisma/client";

export type AttributeRow = AttributeDefinition & {
    category: { name: string; path: string };
    _count: { options: number };
    categories: AttributeCategoryOption[];
};

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

    const run = async <T,>(
        action: () => Promise<T>,
        success: string | ((result: T) => string)
    ) => {
        if (loading) return;
        setLoading(true);
        try {
            const result = await action();
            toast({
                title: typeof success === "string" ? success : success(result),
            });
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

    const { categories, category: _category, _count, ...definition } = rowData;
    const archived = Boolean(rowData.archivedAt);

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
                {!archived && (
                    <DropdownMenuItem
                        className="flex gap-2"
                        onClick={() =>
                            setOpen(
                                <CustomModal>
                                    <AttributeDetails
                                        data={definition}
                                        categories={categories}
                                    />
                                </CustomModal>
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
                        className="flex gap-2"
                        onClick={() =>
                            run(
                                () => changeAttributeTypeToNumber(rowData.id),
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
                        className="flex gap-2"
                        onClick={() =>
                            run(
                                () => restoreAttributeDefinition(rowData.id),
                                "Attribute restored."
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
                                () => archiveAttributeDefinition(rowData.id),
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
    );
};
