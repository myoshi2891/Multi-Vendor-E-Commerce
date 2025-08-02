import { cn } from "@/lib/utils";
import Image, { StaticImageData } from "next/image";
import Link from "next/link";
import { FC, ReactNode } from "react";

interface Props {
    link: string;
    image: StaticImageData;
    children?: ReactNode;
    className?: string;
    arrowClassName?: string;
    w_fit?: boolean;
}

const SlidelineItem: FC<Props> = ({
    link,
    image,
    children,
    className,
    arrowClassName,
    w_fit,
}) => {
    return (
        <Link href={link}>
            <div className="group relative mt-4 flex size-10 items-center justify-center hover:bg-[#ff4747]">
                <Image
                    src={image}
                    alt="Slide line Item"
                    width={35}
                    height={35}
                    priority
                />
                <div
                    className={cn(
                        "absolute -left-28 hidden group-hover:flex",
                        className,
                        {
                            "-left-20": w_fit,
                        }
                    )}
                >
                    <span className={cn("w-24 bg-[#373737] text-white px-4 py-[0.8rem] rounded-sm transition-all duration-500 ease-in", {
                        "!w-fit": w_fit,
                    })}>
                        {children}
                    </span>
                    <div className={cn("size-0 border-[12px] border-transparent border-l-[#373737] border-r-0 transition-all duration-500 ease-in-out mt-[11px]",
                        arrowClassName
                    )}/>
                </div>
            </div>
        </Link>
    );
};

export default SlidelineItem;
