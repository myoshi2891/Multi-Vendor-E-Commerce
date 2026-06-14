import OrderStatusTag from "@/components/shared/order-status";
import { useToast } from "@/hooks/use-toast";
import { OrderStatus } from "@/lib/types";
import {
    updateOrderGroupStatus,
    updateOrderGroupStatusAsAdmin,
} from "@/queries/order";
import { FC, useState } from "react";

// mode で seller / admin を静的に分岐する discriminated union。
// admin 分岐には storeId が型として存在しないため、seller 文脈への admin action 混入を
// コンパイル時に排除する（design §3.4）。
type Props =
    | { mode: "seller"; storeId: string; groupId: string; status: OrderStatus }
    | { mode: "admin"; groupId: string; status: OrderStatus };

const OrderStatusSelect: FC<Props> = (props) => {
    const [newStatus, setNewStatus] = useState<OrderStatus>(props.status);
    const [isOpen, setIsOpen] = useState<boolean>(false);

    const { toast } = useToast();

    // Options
    const options = Object.values(OrderStatus).filter(
        (status) => status !== newStatus
    );

    // Handle click
    const handleClick = async (selectedStatus: OrderStatus) => {
        try {
            const response =
                props.mode === "admin"
                    ? await updateOrderGroupStatusAsAdmin(
                          props.groupId,
                          selectedStatus
                      )
                    : await updateOrderGroupStatus(
                          props.storeId,
                          props.groupId,
                          selectedStatus
                      );

            if (response) {
                setNewStatus(response as OrderStatus);
                setIsOpen(false);
            }
        } catch (error: unknown) {
            toast({
                variant: "destructive",
                title: "Failed to update order status",
                description:
                    error instanceof Error ? error.message : String(error),
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
                <OrderStatusTag status={newStatus} />
            </div>
            {/* Dropdown menu */}
            {isOpen && (
                <div className="absolute z-50 mt-2 w-[140px] rounded-md border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
                    {options.map((option) => (
                        <button
                            key={option}
                            className="flex w-full items-center rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-300"
                            onClick={() => handleClick(option)}
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
