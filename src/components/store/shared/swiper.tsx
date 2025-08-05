"use client";
import { ProductType, SimpleProduct } from "@/lib/types";
import { FC, ReactNode } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import ProductCard from "../cards/product/product-card";
import { Navigation, Pagination } from "swiper/modules";
import ProductCardSimple from "../cards/product/simple-card";

interface Props {
    children?: ReactNode;
    products: SimpleProduct[] | ProductType[];
    type: "main" | "curved" | "simple";
    slidesPerView?: number;
    breakpoints?: any;
    spaceBetween?: number;
}

const MainSwiper: FC<Props> = ({
    children,
    products,
    type,
    slidesPerView = 1,
    breakpoints = {
        500: { slidesPerView: 2 },
        750: { slidesPerView: 3 },
        965: { slidesPerView: 4 },
        1200: { slidesPerView: 5 },
        1400: { slidesPerView: 6 },
    },
    spaceBetween = 30,
}) => {
    return (
        <div className="cursor-pointer rounded-md p-4">
            <Swiper
                modules={[Navigation, Pagination]}
                navigation
                spaceBetween={spaceBetween}
                slidesPerView={slidesPerView}
                breakpoints={breakpoints}
            >
                {products?.map((product, index) => (
                    <SwiperSlide key={index}>
                        {type === "simple" ? (
                            <ProductCardSimple
                                product={product as SimpleProduct}
                            />
                        ) : type === "curved" ? (
                            <div>curved card</div>
                        ) : (
                            <ProductCard
                                key={index}
                                product={product as ProductType}
                            />
                        )}
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
};

export default MainSwiper;
