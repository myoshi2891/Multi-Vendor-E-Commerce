// React, Next.js
import { FC } from "react";
import Image from "next/image";

// Import of the image shown where are no images available
import NoImageImg from "../../../../public/assets/images/no_image_2.png"
import { cn, getGridClassName } from "@/lib/utils";

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

	// Get the grid class name based on the number of images
	const GridClassName = getGridClassName(imagesLength);
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
				<div
					className={cn(
						"grid h-[800px] overflow-hidden bg-white rounded-md",
						GridClassName
					)}
				>
					{images.map((image, index) => (
						<div
							key={index}
							className={cn(
								"relative group h-full w-full border border-gray-300",
								`grid_${imagesLength}_image_${index + 1}`,
								{
									"h-[266.66px]": images.length === 6,
								}
							)}
						>
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
