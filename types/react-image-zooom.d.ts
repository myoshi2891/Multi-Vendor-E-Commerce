// react-image-zooom.d.ts
declare module "react-image-zooom" {
	import { FC } from "react";

	interface ImageZoomProps {
		className?: string; // Optional className for styling
		id?: string; // Optional id for the image element
		src: string; // The image URL, required
		zoom?: number; // Optional zoom factor, default is 200
		alt?: string; // Optional alt text for the image, default is "This is an imageZoom image"
		width?: string | number; // Optional width, default is "100%"
		height?: string | number; // Optional height, default is "auto"
	}

	// Declare the component and its props
	const ImageZoom: FC<ImageZoomProps>;

	export default ImageZoom;
}
