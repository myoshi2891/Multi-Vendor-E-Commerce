"use client";
import { SimpleProduct } from "@/lib/types";
import AnimatedImg from "@/public/assets/images/ads/animated-deals.gif";
import TopSellerImg from "@/public/assets/images/featured/most-popular.avif";
import TopRatedImg from "@/public/assets/images/featured/top-rated.jpg";
import Image from "next/image";
import Link from "next/link";
import MainSwiper from "../shared/swiper";
import Countdown from "../shared/countdown";
export default function AnimatedDeals({
    products,
}: {
    products: SimpleProduct[];
}) {
    return (
        <div className="relative w-full overflow-hidden rounded-md bg-[#ed3835]">
            <span className="absolute top-[53%] inline-block w-full text-center text-4xl font-semibold text-white outline-none">
                Up to 90%
            </span>
            <Image
                src={AnimatedImg}
                alt="animated deals"
                width={2000}
                height={330}
                className="h-[330px] w-full"
                priority
            />
            <Link
                href="/browse"
                className="absolute left-[7%] top-1/4 z-10 flex h-[181px] w-[140px] justify-center rounded-[24px] bg-[#ffaf00] min-[1070px]:left-[10%]"
            >
                <Image
                    src={TopSellerImg}
                    alt="top sellers"
                    width={150}
                    height={200}
                    className="mt-[-3px] h-[78%] w-4/5 rounded-[24px] object-cover align-middle"
                    priority
                />
                <span className="absolute top-[60%] mt-8 inline-block text-center text-[20px] font-semibold text-white">
                    Top Sellers
                </span>
            </Link>
            <Link
                href="/browse"
                className="absolute right-[7%] top-1/4 z-10 flex h-[181px] w-[140px] justify-center rounded-[24px] bg-[#ffaf00] min-[1070px]:right-[10%]"
            >
                <Image
                    src={TopRatedImg}
                    alt="top rated"
                    width={150}
                    height={200}
                    className="mt-[-3px] h-[78%] w-4/5 rounded-[24px] object-cover align-middle"
                    priority
                />
                <span className="absolute top-[60%] mt-8 inline-block text-center text-[20px] font-semibold text-white">
                    Top Rated
                </span>
            </Link>

            <div className="absolute left-1/2 top-[82%] flex -translate-x-1/2 items-center justify-center">
                <Countdown targetDate="2025-09-12T00:00:00.769Z" home_style />
            </div>
            <div className="absolute left-1/2 top-[3%] w-[300px] -translate-x-1/2 gap-[5px] min-[1100px]:w-[400px] min-[1400px]:w-[510px]">
                <MainSwiper
                    products={products}
                    type="simple"
                    slidesPerView={3}
                    spaceBetween={-5}
                    breakpoints={{
                        1100: { slidesPerView: 4 },
                        1400: { slidesPerView: 5 },
                    }}
                />
            </div>
        </div>
    );
}
