// Stub implementation — replaced in the GREEN commit by the real auth-guards.
// This file exists so that auth-guards.test.ts can be authored and committed
// as a RED step (rule 02: TDD Red → Green → Refactor with separate commits).

export async function requireUser(): Promise<never> {
    throw new Error("auth-guards: NOT_IMPLEMENTED");
}

export async function requireAdmin(): Promise<never> {
    throw new Error("auth-guards: NOT_IMPLEMENTED");
}

export async function requireSeller(): Promise<never> {
    throw new Error("auth-guards: NOT_IMPLEMENTED");
}

export async function requireStoreOwner(_storeUrl: string): Promise<never> {
    throw new Error("auth-guards: NOT_IMPLEMENTED");
}
