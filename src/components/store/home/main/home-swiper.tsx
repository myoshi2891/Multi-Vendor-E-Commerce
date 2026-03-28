"use client";

import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Img1 from "@/public/assets/images/swiper/1.webp";
import Img2 from "@/public/assets/images/swiper/2.webp";
import Img3 from "@/public/assets/images/swiper/3.webp";
import Img4 from "@/public/assets/images/swiper/4.webp";
import Image from "next/image";

export default function HomeMainSwiper() {
    const [emblaRef] = useEmblaCarousel({ loop: true }, [
        Autoplay({ delay: 6000, stopOnInteraction: false }),
    ]);

    return (
        <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
                {images.map((image) => (
                    <div
                        key={image.id}
                        className="min-w-0 flex-[0_0_100%]"
                    >
                        <Image
                            src={image.url}
                            alt="Product Image"
                            width={600}
                            height={400}
                            priority
                            style={{
                                width: "100%",
                                height: "auto",
                                objectFit: "cover",
                            }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

const images = [
    { id: 1, url: Img1 },
    { id: 2, url: Img2 },
    { id: 3, url: Img3 },
    { id: 4, url: Img4 },
];
