"use client";
import styles from "../design/seller.module.css";

// Provider
import { useModal } from "@/providers/modal-provider";

// UI components
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
} from "@/components/ui/dialog";
import { DialogTitle } from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

type Props = {
    className?: string;
    heading?: string;
    subheading?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    maxWidth?: string;
    design?: "seller";
    locked?: boolean;
    returnFocusTo?: React.RefObject<HTMLElement | null>;
};

const CustomModal = ({
    children,
    className,
    defaultOpen,
    subheading,
    heading,
    maxWidth,
    design,
    locked = false,
    returnFocusTo,
}: Props) => {
    const { isOpen, setClose } = useModal();
    return (
        <Dialog
            open={isOpen || defaultOpen}
            onOpenChange={() => {
                if (!locked) setClose();
            }}
        >
            <DialogContent
                closeDisabled={locked}
                onEscapeKeyDown={(event) => {
                    if (locked) event.preventDefault();
                }}
                onInteractOutside={(event) => {
                    if (locked) event.preventDefault();
                }}
                onCloseAutoFocus={
                    returnFocusTo
                        ? (event) => {
                              event.preventDefault();
                              returnFocusTo.current?.focus();
                          }
                        : undefined
                }
                className={cn(
                    "h-screen overflow-y-scroll bg-card md:h-fit md:max-h-[700px]",
                    maxWidth,
                    className,
                    design === "seller" && `${styles.theme} ${styles.dialog}`
                )}
            >
                <DialogHeader className="pt-8 text-left">
                    {(heading || design === "seller") && (
                        <DialogTitle className="text-2xl font-bold">
                            {heading || "Store details"}
                        </DialogTitle>
                    )}
                    {subheading && (
                        <DialogDescription>{subheading}</DialogDescription>
                    )}

                    {children}
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
};

export default CustomModal;
