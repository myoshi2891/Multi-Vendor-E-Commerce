"use server"

import { ProductSize, ProductType, SimpleProduct } from "@/lib/types"

type Format = "simple" | "full"

type Param = {
    property: "category" | "subCategory" | "offer"
    value: string
    type: Format
}

type PropertyMapping = {
    [key: string]: string
}

export const getHomeDataDynamic = async (params: Param[]): Promise<Record<string, SimpleProduct[] | ProductType>> => { 
    if (!Array.isArray(params) || params.length === 0) {
        throw new Error("Invalid input: Params array is empty")
    }

    // Define mapping for property names to database fields
    const propertyMapping: PropertyMapping = {
        category: "category.url",
        subCategory: "category.subCategory",
        offer: "offer.offer",
    }

    const mapProperty = (property: string): string => {
        if (!propertyMapping[property]) {
            throw new Error(`Invalid input: Unknown property '${property}'. Must be one of: category, subCategory, offer`)
        }
        return propertyMapping[property]
    }

    // Get Cheapest size
    const getCheapestSize = (size: ProductSize[]): { discountedPrice: number } => { 
        const sizesWithDiscount = size.map((size) => ({
            ...size,
            discountedPrice: size.price * (1 - size.discount / 100),
        }))

        return sizesWithDiscount.sort((a, b) => a.discountedPrice - b.discountedPrice)[0]
    }
}