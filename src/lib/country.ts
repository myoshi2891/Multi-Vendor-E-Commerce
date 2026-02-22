import countries from "@/data/countries.json";
import { Country } from "./types";

// デフォルト国
const DEFAULT_COUNTRY: Country = {
    name: "United States",
    code: "US",
    city: "",
    region: "",
};

// IP アドレスからユーザーの国を検出する
// Edge Runtime 互換（DB 依存なし）
export async function getUserCountry(): Promise<Country> {
    let userCountry: Country = DEFAULT_COUNTRY;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        try {
            const response = await fetch(
                `https://ipinfo.io/?token=${process.env.IPINFO_TOKEN}`,
                { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            if (response.ok) {
                const data = await response.json();
                userCountry = {
                    name:
                        countries.find(
                            (country) => country.code === data.country
                        )?.name || data.country,
                    code: data.country,
                    city: data.city || "",
                    region: data.region || "",
                };
            }
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (error) {
        console.error("Failed to get user's country", error);
        userCountry = DEFAULT_COUNTRY;
    }
    return userCountry;
}
