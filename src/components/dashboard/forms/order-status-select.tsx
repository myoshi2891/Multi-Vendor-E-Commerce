import OrderStatusTag from "@/components/shared/order-status";
import { useToast } from "@/hooks/use-toast";
import { OrderStatus } from "@/lib/types";
import { useRouter } from "next/navigation";
import { FC, useState } from "react";

interface Props {
    storeId: string;
    groupId: string;
    status: OrderStatus;
}

const OrderStatusSelect: FC<Props> = ({ storeId, groupId, status }) => {
    const [newStatus, setNewStatus] = useState<OrderStatus>(status);
    const [isOpen, setIsOpen] = useState<boolean>(false);

    const router = useRouter();

    const { toast } = useToast();

    // Options
    const options = Object.values(OrderStatus).filter(
        (status) => status !== newStatus
    );

    return (
        <div className="relative">
            {/* Current status */}
            <div
                className="cursor-pointer"
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <OrderStatusTag status={newStatus} />
            </div>
            {/* Dropdown menu */}
            {isOpen && (
                <div className="absolute z-50 mt-2 w-[140px] rounded-md border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
                    {options.map((option) => (
                        <button
                            key={option}
                            className="flex w-full items-center rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-300"
                        >
                            <OrderStatusTag status={option} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OrderStatusSelect;
