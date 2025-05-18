import { PrismaClient } from "@prisma/client";

declare global {
	var prisma: PrismaClient | undefined;
}

export const db = globalThis.prisma || new PrismaClient();

if (process.env.NODE_ENV === "production") globalThis.prisma = db;
// import { PrismaClient } from "@prisma/client";

// const globalForPrisma = globalThis as unknown as {
// 	prisma: PrismaClient | undefined;
// };

// export const db =
// 	globalForPrisma.prisma ??
// 	new PrismaClient({
// 		log: ["query"],
// 	});

// if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
