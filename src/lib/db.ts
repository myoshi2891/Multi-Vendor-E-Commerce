import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const createPrismaClient = () =>
	new PrismaClient().$extends(withAccelerate());

declare global {
	var prisma: ReturnType<typeof createPrismaClient> | undefined;
}

export const db = globalThis.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalThis.prisma = db;
