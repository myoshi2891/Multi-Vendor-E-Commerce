"use client";
// React, Next.js
import Image from "next/image";
import { Dispatch, SetStateAction, useState } from "react";

// Utils
import { cn } from "@/lib/utils";

//Types
import { ProductVariantImage } from "@prisma/client";

// Image Zoom
import ImageZoom from "react-image-zooom";

export default function ProductSwiper({
	images,
	activeImage,
	setActiveImage,
}: {
	images: ProductVariantImage[];
	activeImage: ProductVariantImage | null;
	setActiveImage: Dispatch<SetStateAction<ProductVariantImage | null>>;
}) {
	// If no images are provided, exit early and don't render anything
	if (!images) return;

	return (
		<div className="relative">
			<div className="relative w-full flex flex-col-reverse xl:flex-row gap-2">
				{/* Thumbnails */}
				<div className="flex flex-wrap xl:flex-col gap-3">
					{images.map((img) => (
						<div
							key={img.url}
							className={cn(
								"w-16 h-16 rounded-md grid place-items-center overflow-hidden border border-gray-100 cursor-pointer transition-all duration-75 ease-in",
								{
									"border-main-primary": activeImage
										? activeImage.id === img.id
										: false,
								}
							)}
							onMouseEnter={() => setActiveImage(img)}
						>
							<Image
								src={img.url}
								alt={img.alt}
								width={80}
								height={80}
								className="object-cover rounded-md"
							/>
						</div>
					))}
				</div>
				{/* Image view */}
				<div className="relative rounded-lg overflow-hidden md:h-96 md:w-96 2xl:h-[600px] 2xl:w-[600px]">
					<ImageZoom
						src={activeImage ? activeImage.url : ""}
						zoom={200}
						className="!w-full rounded-lg"
					/>
				</div>
			</div>
		</div>
	);
}
