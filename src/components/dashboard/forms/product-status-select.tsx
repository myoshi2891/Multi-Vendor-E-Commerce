import OrderStatusTag from "@/components/shared/order-status";
import ProductStatusTag from "@/components/shared/product-status";
import { useToast } from "@/hooks/use-toast";
import { ProductStatus } from "@/lib/types";
import { updateOrderGroupStatus, updateOrderItemStatus } from "@/queries/order";
import { useRouter } from "next/navigation";
import { FC, useState } from "react";

interface Props {
    storeId: string;
    orderItemId: string;
    status: ProductStatus;
}

const ProductStatusSelect: FC<Props> = ({ storeId, orderItemId, status }) => {
    const [newStatus, setNewStatus] = useState<ProductStatus>(status);
    const [isOpen, setIsOpen] = useState<boolean>(false);

    const router = useRouter();

    const { toast } = useToast();

    // Options
    const options = Object.values(ProductStatus).filter(
        (status) => status !== newStatus
    );

    // Handle click
    const handleClick = async (selectedStatus: ProductStatus) => {
        try {
            const response = await updateOrderItemStatus(
                storeId,
                orderItemId,
                selectedStatus
            );

            if (response) {
                setNewStatus(response as ProductStatus);
                setIsOpen(false);
                router.refresh()
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Failed to update order status",
                description: error.toString(),
            });
        }
    };
    return (
        <div className="relative">
            {/* Current status */}
            <div
                className="cursor-pointer"
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <ProductStatusTag status={newStatus} />
            </div>
            {/* Dropdown menu */}
            {isOpen && (
                <div className="absolute z-50 mt-2 w-[170px] rounded-md border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
                    {options.map((option) => (
                        <button
                            key={option}
                            className="flex w-full items-center rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-300"
                            onClick={() => handleClick(option)}
                        >
                            <ProductStatusTag status={option} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProductStatusSelect;
