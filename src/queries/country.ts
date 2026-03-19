"use server";

import { db } from "@/lib/db";

export const getAllCountries = async () => {
    try {
        const countries = await db.country.findMany({
            orderBy: { name: "asc" },
        });
        return countries;
    } catch (error) {
        console.error("Error retrieving countries:", error);
        throw new Error("Failed to retrieve countries.");
    }
};
