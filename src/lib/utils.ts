import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { PrismaClient } from "@prisma/client";
import ColorThief from "colorthief";
import { db } from "./db";
import { Country } from "./types";
import countries from "@/data/countries.json";

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

// Function to get prominent colors from an image
export const getDominantColors = (imgUrl: string): Promise<string[]> => {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "Anonymous";
		img.src = imgUrl;
		img.onload = () => {
			try {
				const colorThief = new ColorThief();
				const colors = colorThief.getPalette(img, 4).map((color) => {
					// Convert RGB array to hex string
					return `#${(
						(1 << 24) +
						(color[0] << 16) +
						(color[1] << 8) +
						color[2]
					)
						.toString(16)
						.slice(1)
						.toUpperCase()}`;
				});
				resolve(colors);
			} catch (error) {
				reject(error);
			}
		};
		img.onerror = () => {
			reject(new Error("Failed to load image"));
		};
	});
};

// Helper function to generate a unique slug
export const generateUniqueSlug = async (
	baseSlug: string,
	model: keyof PrismaClient,
	field: string = "slug",
	separator: string = "-"
) => {
	let slug = baseSlug;
	let suffix = 1;

	while (true) {
		const existingRecord = await (db[model] as any).findFirst({
			where: {
				[field]: slug,
			},
		});
		if (!existingRecord) {
			break;
		}
		slug = `${slug}${separator}${suffix++}`;
		suffix += 1;
	}

	return slug;
};

// the helper function to get the user country
// Define the default country
const DEFAULT_COUNTRY: Country = {
	name: "United States",
	code: "US",
	city: "",
	region: "",
};

export async function getUserCountry(): Promise<Country> {
	let userCountry: Country = DEFAULT_COUNTRY;
	try {
		// Attempt to detect country by IP
		const response = await fetch(
			`https://ipinfo.io/?token=${process.env.IPINFO_TOKEN}`
		);
		if (response.ok) {
			const data = await response.json();
			// if (data.country) {
			userCountry = {
				name:
					countries.find((country) => country.code === data.country)
						?.name || data.country,
				code: data.country,
				city: data.city,
				region: data.region,
			};
			// }
		}
	} catch (error) {
		console.error("Failed to get user's country", error);
		// Fall back to default country if IP lookup fails
		userCountry = DEFAULT_COUNTRY;
	}
	return userCountry;
}

// Function: getShippingDatesRange
// Description: Returns the shipping date range by adding the specified min and max days
// Parameters:
// - minDays: Number of days to add to the current date for the minimum shipping date.
// - maxDays: Number of days to add to the current date for the maximum shipping date.
// Returns: Shipping date range object containing the minimum and maximum shipping dates.

export const getShippingDatesRange = (
	minDays: number,
	maxDays: number
): { minDate: string; maxDate: string } => {
	// Get the current date
	const currentDate = new Date();

	// Calculate minDate by adding minDays to the current date
	const minDate = new Date(currentDate);
	minDate.setDate(currentDate.getDate() + minDays);

	// Calculate maxDate by adding maxDays to the current date
	const maxDate = new Date(currentDate);
	maxDate.setDate(currentDate.getDate() + maxDays);

	// Return an object containing the minimum and maximum shipping dates
	return {
		minDate: minDate.toDateString(),
		maxDate: maxDate.toDateString(),
	};
};
