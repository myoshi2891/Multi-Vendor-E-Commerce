// React, Next.js
import { FC } from "react";
import Image from "next/image";

// Import of the image shown where are no images available
import NoImageImg from "../../../../public/assets/images/no_image_2.png"
import { cn } from "@/lib/utils";

interface ImagesPreviewGridProps {
	images: { url: string }[];
	onRemove: (url: string) => void;
}

const ImagesPreviewGrid: FC<ImagesPreviewGridProps> = ({
	images,
	onRemove,
}) => {
	// Calculate the number of images
	let imagesLength = images.length;
	// If there is no images, display a placeholder image
	if (imagesLength === 0) {
		return (
			<div>
				<Image
					src={NoImageImg}
					alt="No image available"
					width={500}
					height={600}
					className="rounded-md"
				/>
			</div>
		);
	} else {
		// if there are images, display them in a grid
		return (
			<div className="max-x-4xl">
				<div className={cn("grid grid-cols-2 h-[800px] overflow-hidden bg-white rounded-md")}>
					{images.map((image, index) => (
						<div key={index} className={cn("relative group h-full w-full border border-gray-300")}>
							{/* Image */}
							<Image
								src={image.url}
								alt={`Image ${index + 1}`}
								width={800}
								height={800}
								className="w-full h-full object-cover object-top"
								onClick={() => onRemove(image.url)}
							/>
						</div>
					))}
				</div>
			</div>
		);
	}
};

export default ImagesPreviewGrid;
