"use client";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function SizeLink({ size }: { size: string }) {
    const searchParams = useSearchParams();
    const params = new URLSearchParams(searchParams);
    const pathname = usePathname();

    const { replace } = useRouter();

    // Params
    const sizeQueryArray = searchParams.getAll("size");

    const existed_size = sizeQueryArray.find((s) => s === size);

    const handleSizeChange = (size: string) => {
        if (existed_size) {
            // Remove only the selected size from params
            const newSizes = sizeQueryArray.filter((s) => s !== size);
            params.delete("size"); // Delete all size params
            newSizes.forEach((size) => params.append("size", size)); // Add back the remaining sizes
        } else {
            params.append("size", size); // Add the selected size to params
        }
        replaceParams();
    };

    const replaceParams = () => {
        replace(`${pathname}?${params.toString()}`);
    };

    return (
        <label className="flex cursor-pointer select-none items-center whitespace-nowrap text-left"
        onClick={()=> handleSizeChange(size)}>
            <span
                className={cn(
                    "relative mr-2 flex size-3 cursor-pointer items-center justify-center rounded-full border border-[#ccc]",
                    {
                        "border-black bg-black text-white":
                            size === existed_size,
                    }
                )}
            >
                {size === existed_size && <Check className="w-2" />}
            </span>
            <div className="inline-block flex-1 overflow-visible text-clip whitespace-normal text-xs">
                {size}
            </div>
        </label>
    );
}
