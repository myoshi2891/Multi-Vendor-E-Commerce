"use client";
import { SimpleProduct } from "@/lib/types";
import Link from "next/link";
import MainSwiper from "../../shared/swiper";
import { useEffect, useState } from "react";
import { useMediaQuery } from "react-responsive";

export default function Featured({ products }: { products: SimpleProduct[] }) {
    const is1170px = useMediaQuery({ query: "(min-width: 1170px)" });
    const is1700px = useMediaQuery({ query: "(min-width: 1700px)" });

    // State to store the current width of the screen
    const [screenWidth, setScreenWidth] = useState<number>(window.innerWidth);

    useEffect(() => {
        // Handler function to update screen width state when window is resized
        const handleResize = () => {
            setScreenWidth(window.innerWidth);
        };

        // Add event listener for window resize events
        window.addEventListener("resize", handleResize);

        // Cleanup function to remove event listener when component unmounts
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []); // Empty dependency array ensures this effect runs only once on mount

    return (
        <div className="relative overflow-hidden rounded-md">
            <div
                className="flex w-full items-center bg-cover bg-center bg-no-repeat"
                style={{
                    backgroundImage: "url(/assets/images/ads/featured.webp)",
                }}
            >
                {/* Coupon */}
                <Link href="/">
                    <div className="relative float-left h-[190px] w-52 px-3">
                        <div className="flex h-[103px] flex-col items-center justify-center">
                            <h3 className="my-1 w-full font-bold leading-5 text-white">
                                Welcome New Comers
                            </h3>
                            <p className="w-full text-sm text-white">
                                Enjoy shopping made easy like nothing before
                            </p>
                        </div>
                        <div
                            className="absolute bottom-[35px] h-[55px] w-[192px] overflow-hidden bg-contain bg-no-repeat pl-[14px] pr-[45px] text-left text-white"
                            style={{
                                backgroundImage:
                                    "url(/assets/images/ads/coupon.gif)",
                            }}
                        >
                            <h3 className="mb-1 mt-[11px] w-full text-[20px] leading-6 text-white">
                                use &apos;COUPON&apos;
                            </h3>
                            <p className="w-full -translate-y-1 overflow-hidden text-ellipsis text-xs">
                                for 87% off
                            </p>
                        </div>
                    </div>
                </Link>
                {/* Product swiper */}
                <div
                    className={is1700px ? "ml-10" : ""}
                    style={{
                        // Responsive width calculation:
                        // - Below 1170px: Use dynamic width (screen width minus 300px for coupon section)
                        // - Above 1700px: Fixed 750px width
                        // - Between 1170px-1700px: Responsive width using calc (500px + 5vw)
                        width: !is1170px
                            ? `${screenWidth - 300}px`
                            : is1700px
                              ? "750px"
                              : `calc(500px + 5vw)`,
                    }}
                >
                    <MainSwiper
                        products={products}
                        type="simple"
                        slidesPerView={1}
                        spaceBetween={-10}
                    />
                </div>
            </div>
        </div>
    );
}
