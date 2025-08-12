import StoreStatusTag from "@/components/shared/store-status";
import { useToast } from "@/hooks/use-toast";
import { StoreStatus } from "@/lib/types";
import { updateStoreStatus } from "@/queries/store";
import { useRouter } from "next/navigation";
import { FC, useState } from "react";

interface Props {
    storeId: string;
    status: StoreStatus;
}

const StoreStatusSelect: FC<Props> = ({ storeId, status }) => {
    const [newStatus, setNewStatus] = useState<StoreStatus>(status);
    const [isOpen, setIsOpen] = useState<boolean>(false);

    const router = useRouter();

    const { toast } = useToast();

    // Options
    const options = Object.values(StoreStatus).filter(
        (status) => status !== newStatus
    );

    // Handle click
    const handleClick = async (selectedStatus: StoreStatus) => {
        try {
            const response = await updateStoreStatus(storeId, selectedStatus);

            if (response) {
                setNewStatus(response as StoreStatus);
                setIsOpen(false);
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
                <StoreStatusTag status={newStatus} />
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
                            <StoreStatusTag status={option} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StoreStatusSelect;
