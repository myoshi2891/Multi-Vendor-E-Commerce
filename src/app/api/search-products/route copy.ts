// import client from "@/lib/elastic-search";
// import { NextResponse } from "next/server";

// // Define product type
// interface Product {
//     name: string;
// }

// export async function GET(req: Request) {
//     const { searchParams } = new URL(req.url);
//     const q = searchParams.get("search");

//     if (!q || typeof q !== "string") {
//         return NextResponse.json(
//             {
//                 message: "Invalid search query",
//             },
//             { status: 400 }
//         );
//     }

//     try {
//         const response = await client.search<{ _source: Product }>({
//             index: "products",
//             body: {
//                 query: {
//                     match_phrase_prefix: {
//                         name: q,
//                     },
//                 },
//             },
//         });
//         const results = response.hits.hits.map((hit: any) => hit._source);
//         return NextResponse.json(results);
//     } catch (error: any) {
//         console.error("Error fetching products:", error);
//         return NextResponse.json(
//             {
//                 message: "Failed to fetch products",
//             },
//             { status: 500 }
//         );
//     }
// }

// import { db } from "@/lib/db";
// import { NextResponse } from "next/server";

// // Define product type
// interface Product {
//     name: string;
// }

// export async function GET(req: Request) {
//     const { searchParams } = new URL(req.url);
//     const q = searchParams.get("search");

//     if (!q || typeof q !== "string") {
//         return NextResponse.json(
//             { message: "Invalid search query" },
//             { status: 400 }
//         );
//     }

//     try {
//         // MySQL（Prisma）で部分一致検索
//         const products = await db.product.findMany({
//             where: {
//                 name: {
//                     contains: q, // 部分一致
//                     // mode: "insensitive", // 大文字小文字無視
//                 },
//             },
//             select: {
//                 name: true,
//             },
//             take: 50, // 最大件数制限
//         });

//         return NextResponse.json(products);
//     } catch (error: any) {
//         console.error("Error fetching products:", error);
//         return NextResponse.json(
//             { message: "Failed to fetch products" },
//             { status: 500 }
//         );
//     }
// }

import mysql from "mysql2/promise";
import { NextResponse } from "next/server";

// MySQL 接続設定（環境変数を利用）
const dbConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("search");

    if (!q || typeof q !== "string") {
        return NextResponse.json(
            { message: "Invalid search query" },
            { status: 400 }
        );
    }

    try {
        const connection = await mysql.createConnection(dbConfig);

        // 部分一致検索（前後にワイルドカード）
        const [rows] = await connection.execute(
            `SELECT name FROM products WHERE name LIKE ?`,
            [`%${q}%`]
        );

        await connection.end();

        return NextResponse.json(rows);
    } catch (error: any) {
        console.error("Error fetching products:", error);
        return NextResponse.json(
            { message: "Failed to fetch products" },
            { status: 500 }
        );
    }
}
