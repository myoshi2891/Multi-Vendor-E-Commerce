"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type {
    StoreProductRow,
    ProductListActions,
} from "@/lib/seller-products";
import styles from "@/components/dashboard/design/seller.module.css";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function getProductColumns(
    deleteProductAction: ProductListActions["deleteProductAction"]
): ColumnDef<StoreProductRow>[] {
    return [
        {
            accessorKey: "name",
            header: "Name",
            cell: ({ row }) => (
                <span className="font-medium">{row.original.name}</span>
            ),
        },
        {
            id: "variants",
            header: "Variants",
            cell: ({ row }) => (
                <div className="flex flex-col gap-4">
                    {row.original.variants.map((variant) => (
                        <div key={variant.id} className="flex gap-3">
                            <Link
                                aria-label={`Edit ${variant.variantName}`}
                                href={`/dashboard/seller/stores/${row.original.store.url}/products/${row.original.id}/variants/${variant.id}`}
                            >
                                {variant.images[0]?.url ? (
                                    <Image
                                        src={variant.images[0].url}
                                        alt={variant.variantName}
                                        width={72}
                                        height={72}
                                        className="size-16 shrink-0 object-cover"
                                    />
                                ) : (
                                    <span className="block size-16 border p-1 text-xs">
                                        No image
                                    </span>
                                )}
                            </Link>
                            <div>
                                <p>{variant.variantName}</p>
                                <div className="flex flex-wrap gap-1">
                                    {variant.colors.map((color) => (
                                        <span
                                            key={color.name}
                                            title={color.name}
                                            role="img"
                                            aria-label={color.name}
                                            className="inline-block size-4 border"
                                            style={{
                                                backgroundColor: color.name,
                                            }}
                                        />
                                    ))}
                                </div>
                                {variant.sizes.map((size) => (
                                    <p
                                        key={size.id}
                                        className="text-xs text-muted-foreground"
                                    >
                                        {size.size} · {size.quantity} · $
                                        {size.price.toFixed(2)}
                                    </p>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ),
        },
        {
            id: "category",
            header: "Category",
            cell: ({ row }) => (
                <span>{row.original.category?.name ?? "—"}</span>
            ),
        },
        {
            id: "subCategory",
            header: "SubCategory",
            cell: ({ row }) => (
                <span>{row.original.subCategory?.name ?? "—"}</span>
            ),
        },
        {
            id: "offerTag",
            header: "Offer",
            cell: ({ row }) => (
                <span>{row.original.offerTag?.name ?? "—"}</span>
            ),
        },
        { accessorKey: "brand", header: "Brand" },
        {
            id: "newVariant",
            header: "Add variant",
            cell: ({ row }) => (
                <Link
                    href={`/dashboard/seller/stores/${row.original.store.url}/products/${row.original.id}/variants/new`}
                    className={`${styles.control} underline`}
                >
                    New variant
                </Link>
            ),
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <ProductActions
                    productId={row.original.id}
                    name={row.original.name}
                    deleteProductAction={deleteProductAction}
                />
            ),
        },
    ];
}
export function ProductActions({
    productId,
    name,
    deleteProductAction,
}: {
    productId: string;
    name: string;
    deleteProductAction: ProductListActions["deleteProductAction"];
}) {
    const [open, setOpen] = useState(false),
        [busy, setBusy] = useState(false),
        [error, setError] = useState(false);
    const pending = useRef(false),
        trigger = useRef<HTMLButtonElement>(null);
    const router = useRouter();
    const remove = async () => {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        setError(false);
        try {
            await deleteProductAction(productId);
            setOpen(false);
            router.refresh();
        } catch {
            setError(true);
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };
    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        ref={trigger}
                        className={styles.control}
                        variant="outline"
                        aria-label={`Actions for ${name}`}
                    >
                        Actions
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className={`${styles.theme} ${styles.controls}`}>
                    <DropdownMenuItem onSelect={() => setOpen(true)}>
                        Delete product
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog
                open={open}
                onOpenChange={(value) => {
                    if (!pending.current) setOpen(value);
                }}
            >
                <AlertDialogContent
                    className={`${styles.theme} ${styles.dialog} ${styles.controls}`}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        trigger.current?.focus();
                    }}
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete product</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete {name} and its
                            variants. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {error && (
                        <p role="alert" className={styles.alert}>
                            We couldn’t delete this product. Please try again.
                        </p>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy}>
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            variant="destructive"
                            disabled={busy}
                            onClick={remove}
                        >
                            {busy ? "Deleting…" : "Delete"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
