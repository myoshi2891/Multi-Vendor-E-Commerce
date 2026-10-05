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
    heading?: string;
    subheading?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    maxWidth?: string;
    design?: "seller";
};

const CustomModal = ({
    children,
    defaultOpen,
    subheading,
    heading,
    maxWidth,
    design,
}: Props) => {
    const { isOpen, setClose } = useModal();
    return (
        <Dialog open={isOpen || defaultOpen} onOpenChange={setClose}>
            <DialogContent
                className={cn(
                    "h-screen overflow-y-scroll bg-card md:h-fit md:max-h-[700px]",
                    maxWidth,
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
