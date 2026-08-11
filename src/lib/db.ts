import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const createPrismaClient = () =>
	new PrismaClient().$extends(withAccelerate());

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

declare global {
	var prisma: ExtendedPrismaClient | undefined;
}

let client: ExtendedPrismaClient | undefined;

/**
 * Prisma クライアントを初回アクセス時にだけ生成する。
 *
 * `withAccelerate()` を適用したクライアントは **生成した時点で接続を試みる**ため、
 * モジュール評価時に生成すると DB 到達性に依存してしまう。`next build` の
 * "Collecting page data" は全ルートのモジュールを評価するので、page → `@/queries/*`
 * → 本モジュール の import チェーンだけで（クエリを 1 本も実行しなくても）
 * ルート数ぶんの接続が走り、CI（DATABASE_URL は到達不能な stub）では
 * unhandled rejection が積み上がって build worker が SIGSEGV で落ちる。
 * 生成を遅延させることで、実際にクエリを実行するまで接続を張らない。
 */
const getClient = (): ExtendedPrismaClient => {
	if (client) return client;

	client = globalThis.prisma ?? createPrismaClient();
	if (process.env.NODE_ENV !== "production") globalThis.prisma = client;

	return client;
};

export const db = new Proxy({} as ExtendedPrismaClient, {
	get(_target, property) {
		const instance = getClient();
		const value: unknown = Reflect.get(instance, property);
		// Prisma のメソッドはレシーバに依存するため、Proxy ではなく実体に束縛する
		return typeof value === "function" ? value.bind(instance) : value;
	},
});
