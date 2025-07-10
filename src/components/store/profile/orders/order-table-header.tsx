import { OrderTableDateFilter, OrderTableFilter } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Dispatch, FC, SetStateAction } from "react";
import { DeleteIcon } from "../../icons";

interface Props {
    filter: OrderTableFilter;
    setFilter: Dispatch<SetStateAction<OrderTableFilter>>;
    period: OrderTableDateFilter;
    setPeriod: Dispatch<SetStateAction<OrderTableDateFilter>>;
    search: string;
    setSearch: Dispatch<SetStateAction<string>>;
}
const OrderTableHeader: FC<Props> = ({ filter, setFilter }) => {
    const router = useRouter();

    return (
        <div className="bg-white px-6 pt-4">
            <div className="flex items-center justify-between">
                <div className="-ml-3 text-sm text-main-primary">
                    <div className="relative overflow-x-hidden">
                        <div className="relative inline-flex items-center justify-center bg-white py-4">
                            {filters.map((f, i) => (
                                <div
                                    key={f.filter}
                                    className={cn(
                                        "relative cursor-pointer whitespace-nowrap px-4 leading-6 text-main-primary",
                                        {
                                            "user-orders-table-tr font-bold":
                                                f.filter === filter,
                                        }
                                    )}
                                    onClick={() => {
                                        if (f.filter === "") {
                                            router.refresh();
                                            setFilter(f.filter);
                                        } else {
                                            setFilter(f.filter);
                                        }
                                    }}
                                >
                                    {f.title}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="mt-0.5 cursor-pointer text-xs"
                    onClick={() => {
                    setFilter('')
                }}>
                    <span className="mx-1.5 inline-block translate-y-0.5">
                        <DeleteIcon />
                    </span>
                    Remove all filters
                </div>
            </div>
        </div>
    );
};

export default OrderTableHeader;

const filters: { title: string; filter: OrderTableFilter }[] = [
    {
        title: "View all",
        filter: "",
    },
    {
        title: "To pay",
        filter: "unpaid",
    },
    {
        title: "To ship",
        filter: "toShip",
    },
    {
        title: "Shipped",
        filter: "shipped",
    },
    {
        title: "Delivered",
        filter: "delivered",
    },
];

const date_filters: { title: string; value: OrderTableDateFilter }[] = [
    {
        title: "All time",
        value: "",
    },
    {
        title: "last 6 months",
        value: "last-6-months",
    },
    {
        title: "last 1 year",
        value: "last-1-year",
    },
    {
        title: "last 2 years",
        value: "last-2-years",
    },
];
