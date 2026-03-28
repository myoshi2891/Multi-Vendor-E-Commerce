// React, Next.js
import Image from 'next/image'

// Import Swiper React component
import { Swiper, SwiperSlide, type SwiperRef } from 'swiper/react'
import { Autoplay } from 'swiper/modules'

// Import Swiper styles
import 'swiper/css'

//Types
import { ProductVariantImage } from '@prisma/client'
import { useEffect, useRef } from 'react'

/**
 * Renders a fixed-height image carousel for product variant images.
 *
 * Displays each image as a slide and controls autoplay: autoplay is started on mouse enter, stopped on mouse leave, and the carousel resets to the first slide when the cursor leaves.
 *
 * @param images - Array of product variant images to display in the carousel
 * @returns The JSX element containing the image Swiper carousel
 */
export default function ProductCardImageSwiper({
    images,
}: {
    images: ProductVariantImage[]
}) {
    const swiperRef = useRef<SwiperRef>(null)
    useEffect(() => {
        if (swiperRef.current && swiperRef.current.swiper) {
            swiperRef.current.swiper.autoplay.stop()
        }
    }, [swiperRef])
    return (
        <div
            className="relative mb-2 h-[200px] w-full overflow-hidden rounded-2xl bg-white contrast-[90%]"
            onMouseEnter={() => swiperRef.current?.swiper.autoplay.start()}
            onMouseLeave={() => {
                swiperRef.current?.swiper.autoplay.stop();
                swiperRef.current?.swiper.slideTo(0);
            }}
            // style={{ height: "200px" }}
        >
            <Swiper
                ref={swiperRef}
                modules={[Autoplay]}
                autoplay={{ delay: 500 }}
            >
                {images.map((img, index) => (
                    <SwiperSlide key={img.id ?? index}>
                        <Image
                            src={img.url}
                            alt={img.alt ?? img.id ?? "Product Image"}
                            width={400}
                            height={400}
                            className="block h-[200px] w-48 object-cover sm:w-52"
                            priority
                        />
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
}
