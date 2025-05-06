import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Helper function to grid classnames depending on length
export const getGridClassName = (length: number) => {
	switch (length) {
		case 2:
			return "grid-cols-2";
		case 3:
			return "grid-cols-2 grid-rows-2";
		case 4:
			return "grid-cols-2 grid-rows-1";
		case 5:
			return "grid-cols-2 grid-rows-6";
		case 6:
			return "grid-cols-2";
		default:
			return "";
	}
};