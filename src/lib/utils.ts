import { clsx, type ClassValue } from "clsx";
import ColorThief from "colorthief";
import { differenceInDays, differenceInHours } from "date-fns";
import { twMerge } from "tailwind-merge";
import { CartProductType, Country } from "./types";

interface HasToNumber {
    toNumber: () => number;
}

function hasToNumber(value: unknown): value is HasToNumber {
    return (
        value !== null &&
        typeof value === "object" &&
        "toNumber" in value &&
        typeof (value as Record<string, unknown>).toNumber === "function"
    );
}

/**
 * Converts a numeric value or number-like object to a JavaScript number.
 *
 * @param value - The value to convert, including objects with a `toNumber()` method
 * @returns The converted number, or `0` when conversion produces an invalid number
 */
export function toNumberSafe(value: unknown): number {
    if (typeof value === "number") return value;
    if (hasToNumber(value)) {
        return value.toNumber();
    }
    const num = Number(value);
    return isNaN(num) ? 0 : num;
}

/**
 * ページ番号の上限。`skip = (page - 1) * pageSize` の暴走と DB の巨大 OFFSET を防ぐ。
 * Prisma の `skip` は Int（32bit）なので、上限が無いと `?page=1e21` のような
 * 入力がそのまま `skip` に到達して実行時エラーになる。
 */
export const MAX_PAGE = 10_000;

/**
 * Normalizes a raw URL parameter value to a positive integer.
 *
 * Array inputs use their first element. Invalid values use the fallback, decimal values are rounded down, and a specified maximum limits the result.
 *
 * @param raw - The raw URL parameter value.
 * @param options.fallback - The value to use when normalization fails; defaults to `1`.
 * @param options.max - The optional maximum allowed value.
 * @returns The normalized positive integer.
 */
export function normalizePositiveIntParam(
    raw: unknown,
    { fallback = 1, max }: { fallback?: number; max?: number } = {}
): number {
    const num = Number(Array.isArray(raw) ? raw[0] : raw);
    const normalized =
        Number.isFinite(num) && num >= 1 ? Math.floor(num) : fallback;
    // `max ? ...` だと max === 0 を falsy として取りこぼすため undefined 判定にする。
    return max !== undefined ? Math.min(normalized, max) : normalized;
}

/**
 * ページ番号専用のショートハンド（下限 1・上限 `MAX_PAGE`）。
 *
 * @param raw - URL から読んだ生のページ値
 * @param max - 上限（既定 `MAX_PAGE`）
 * @returns 1 以上 `max` 以下の整数
 */
export const normalizePageParam = (
    raw: unknown,
    max: number = MAX_PAGE
): number => normalizePositiveIntParam(raw, { fallback: 1, max });

/**
 * Merge multiple class name inputs into a single class string, resolving Tailwind utility conflicts.
 *
 * @param inputs - One or more class value inputs (strings, arrays, or objects) to merge
 * @returns The merged className string with Tailwind utility conflicts resolved
 */
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

// Function: getShippingDatesRange
// Description: Returns the shipping date range by adding the specified min and max days
// Parameters:
// - minDays: Number of days to add to the current date for the minimum shipping date.
// - maxDays: Number of days to add to the current date for the maximum shipping date.
// Returns: Shipping date range object containing the minimum and maximum shipping dates.

export const getShippingDatesRange = (
    minDays: number,
    maxDays: number,
    date?: Date
): { minDate: string; maxDate: string } => {
    // Get the current date
    const currentDate = date ? new Date(date) : new Date();

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

// Function to validate the product data before adding it to the cart
export const isProductValidToAdd = (product: CartProductType): boolean => {
    // check that all required fields are filled
    const {
        productId,
        variantId,
        productSlug,
        variantSlug,
        name,
        variantName,
        image,
        variantImage,
        sizeId,
        size,
        quantity,
        price,
        stock,
        weight,
        shippingMethod,
        shippingService,
        shippingFee,
        extraShippingFee,
        deliveryTimeMin,
        deliveryTimeMax,
    } = product;

    // Ensure that all necessary fields have values
    if (
        !productId ||
        !variantId ||
        !productSlug ||
        !variantSlug ||
        !name ||
        !variantName ||
        !image ||
        !variantImage ||
        !sizeId || // Ensure sizeId is not empty
        !size || // Ensure size is not empty
        quantity <= 0 ||
        price <= 0 ||
        stock <= 0 ||
        weight <= 0 ||
        !shippingMethod ||
        // !shippingService ||
        shippingFee < 0 || // Shipping fee should be a positive number
        // !extraShippingFee ||
        deliveryTimeMin < 0 ||
        deliveryTimeMax < deliveryTimeMin // Ensure delivery times are valid
    ) {
        return false; // Validation failed
    }
    return true; // Product is valid
};

// Function to censor names
type CensorReturn = {
    firstName: string;
    lastName: string;
    fullName: string;
};
export function censorName(firstName: string, lastName: string): CensorReturn {
    const censor = (name: string): string => {
        if (name.length <= 2) return name; // Return short names as is

        // Get the first and last characters
        const firstChar = name[0];
        const lastChar = name[name.length - 1];

        // Create a mask with the middle characters
        // const mask = Array(name.length - 2).fill("*").join("");

        // Calculate how many characters to censor
        const middleLength = name.length - 2; // Length of middle characters to censor

        // Create censored version
        return `${firstChar}${"*".repeat(middleLength)}${lastChar}`;
    };

    const censoredFullName = `${firstName[0]}***${lastName[lastName.length - 1]}`;

    return {
        firstName: censor(firstName),
        lastName: censor(lastName),
        fullName: censoredFullName,
    };
}

export const getTimeUntil = (
    targetDate: string
): { days: number; hours: number } => {
    // Convert the date string to a Date object
    const target = new Date(targetDate);
    const now = new Date();

    // Ensure the target date is in the future
    if (target <= now) return { days: 0, hours: 0 };

    // Calculate days and hours left
    const totalDays = differenceInDays(target, now);
    const totalHours = differenceInHours(target, now) % 24;

    return { days: totalDays, hours: totalHours };
};

export const downloadBlobAsFile = (blob: Blob, filename: string) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
};

export const printPDF = (blob: Blob) => {
    const pdfUrl = URL.createObjectURL(blob);
    const iframe = document.createElement("iframe");

    iframe.style.position = "fixed";
    iframe.style.width = "0px";
    iframe.style.height = "0px";
    iframe.style.visibility = "hidden";
    iframe.src = pdfUrl;

    iframe.onload = () => {
        const printWindow = iframe.contentWindow;

        if (printWindow) {
            printWindow.focus();
            printWindow.print();
        }

        // 印刷完了後にクリーンアップ（印刷に多少時間がかかるため delay 付き）
        // contentWindow が無い場合でもリソースリークを防ぐためにクリーンアップする
        setTimeout(() => {
            URL.revokeObjectURL(pdfUrl);
            iframe.remove();
        }, 2000); // 2秒待ってからクリーンアップ（必要に応じて調整可）
    };

    document.body.appendChild(iframe);
};

const DEFAULT_COUNTRY: Country = {
    name: "United States",
    code: "US",
    city: "",
    region: "",
};

/**
 * Type guard that verifies a value conforms to the Country shape.
 *
 * @param value - The value to validate.
 * @returns `true` if `value` is an object with string `name`, `code`, `city`, and `region` properties, `false` otherwise.
 */
export function isCountry(value: unknown): value is Country {
    if (typeof value !== "object" || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
        typeof obj.name === "string" &&
        typeof obj.code === "string" &&
        typeof obj.city === "string" &&
        typeof obj.region === "string"
    );
}

/**
 * Parse a stored user country cookie and return a valid Country object, falling back to a default on error or invalid data.
 *
 * @param cookieValue - Raw cookie string expected to contain a JSON-encoded Country, or undefined if missing
 * @returns The parsed `Country` when valid, otherwise `DEFAULT_COUNTRY`
 */
export function parseUserCountryCookie(
    cookieValue: string | undefined
): Country {
    if (!cookieValue) return DEFAULT_COUNTRY;
    try {
        const parsed: unknown = JSON.parse(cookieValue);
        return isCountry(parsed) ? parsed : DEFAULT_COUNTRY;
    } catch {
        return DEFAULT_COUNTRY;
    }
}

// Handle product history in localStorage
export const updateProductHistory = (variantId: string) => {
    // Fetch existing product history from localStorage
    let productHistory: string[] = [];
    const historyString = localStorage.getItem("productHistory");

    if (historyString) {
        try {
            productHistory = JSON.parse(historyString);
        } catch (error) {
            productHistory = [];
        }
    }

    // Update the history: Remove the product if it exists, and add it to the front
    productHistory = productHistory.filter((id) => id !== variantId);
    productHistory.unshift(variantId);

    // Check storage limit (manage max number of products)
    const MAX_PRODUCTS = 100;
    if (productHistory.length > MAX_PRODUCTS) {
        productHistory.pop(); // Remove the oldest product
    }

    // Save updated history to localStorage
    localStorage.setItem("productHistory", JSON.stringify(productHistory));
};

/** 在庫ステータス（バッジ表示の色分けに使用）。 */
export type StockStatus = "out" | "low" | "ok";

/**
 * 在庫数としきい値から在庫ステータスを判定する純粋関数（F2-5）。
 *
 * UI（stock-status-badge.tsx）とサマリー集計（inventory-alert-summary.tsx）で
 * 共有するため src/queries/ ではなくここに置く。判定順序は「在庫切れ優先」:
 * threshold=0 のとき quantity=0 は "low" ではなく "out" となる。
 *
 * @param quantity 現在庫数（Size.quantity）
 * @param threshold 店舗の過小在庫しきい値（Store.lowStockThreshold）
 * @returns "out"（在庫切れ・赤） / "low"（過小在庫・橙） / "ok"（十分・通常）
 */
export function getStockStatus(
    quantity: number,
    threshold: number
): StockStatus {
    if (quantity <= 0) return "out"; // 在庫切れ（赤）
    if (quantity <= threshold) return "low"; // 過小在庫（橙）
    return "ok"; // 十分（通常）
}
