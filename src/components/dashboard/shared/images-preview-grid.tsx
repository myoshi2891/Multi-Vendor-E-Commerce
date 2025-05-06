// React, Next.js
import { Dispatch, FC, SetStateAction, useEffect, useState } from "react";
import Image from "next/image";

// Import of the image shown where are no images available
import NoImageImg from "../../../../public/assets/images/no_image_2.png";

// Utils
import { cn, getDominantColors, getGridClassName } from "@/lib/utils";

// Icons
import { Trash } from "lucide-react";

interface ImagesPreviewGridProps {
	images: { url: string }[]; // Array of image objects with { url: string }
	onRemove: (url: string) => void; // Callback Function to remove an image
	colors?: { colors: string }[]; // Array of color objects with { colors: string[] }
	setColors: Dispatch<SetStateAction<{ color: string }[]>>; // Setter function for color objects
}

const ImagesPreviewGrid: FC<ImagesPreviewGridProps> = ({
	images,
	onRemove,
	colors,
	setColors,
}) => {
	// Calculate the number of images
	let imagesLength = images.length;
	// Get the grid class name based on the number of images
	const GridClassName = getGridClassName(imagesLength);

	// Extract images colors
	const [colorPalette, setColorPalette] = useState<string[][]>([]);

	useEffect(() => {
		const fetchColors = async () => {
			const palettes = await Promise.all(
				images.map(async (img) => {
					try {
						const colors = await getDominantColors(img.url);
						return colors;
					} catch (error) {
						console.log(error);
						return [];
					}
				})
			);
			setColorPalette(palettes);
		};

		if (imagesLength > 0) {
			fetchColors();
		}
	}, [images]);

	console.log("colorPalette:", colorPalette);

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
					{images.map((image, i) => (
						<div
							key={i}
							className={cn(
								"relative group h-full w-full border border-gray-300",
								`grid_${imagesLength}_image_${i + 1}`,
								{
									"h-[266.66px]": images.length === 6,
								}
							)}
						>
							{/* Image */}
							<Image
								src={image.url}
								alt={`Image ${i + 1}`}
								width={800}
								height={800}
								className="w-full h-full object-cover object-top"
								onClick={() => onRemove(image.url)}
							/>
							{/* Actions */}
							<div
								className={cn(
									"absolute top-0 left-0 right-0 bottom-0 hidden group-hover:flex bg-white/55 cursor-pointer  items-center justify-center flex-col gap-y-3 transition-all duration-500",
									{
										"!pb-[40%]": imagesLength === 1,
									}
								)}
							>
								{/* Color palette (Extract colors) */}
								{/* Delete Button */}
								<button
									className="Btn"
									type="button"
									onClick={() => onRemove(image.url)}
								>
									<div className="sign">
										<Trash
											size={18}
											className="text-white"
										/>
									</div>
									<div className="text">Delete</div>
								</button>
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}
};

export default ImagesPreviewGrid;
