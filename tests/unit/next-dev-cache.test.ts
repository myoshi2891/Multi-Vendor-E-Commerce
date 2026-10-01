import { execFileSync } from "node:child_process";

function distDir(mode: "development" | "production", override?: string) {
    const env = { ...process.env, NODE_ENV: mode };
    delete (env as Record<string, string | undefined>).NEXT_DEV_DIST_DIR;
    if (override)
        (env as Record<string, string | undefined>).NEXT_DEV_DIST_DIR =
            override;
    return execFileSync(
        process.execPath,
        [
            "--input-type=module",
            "-e",
            "import config from './next.config.mjs'; process.stdout.write(config.distDir || '.next');",
        ],
        { cwd: process.cwd(), env, encoding: "utf8" }
    );
}

test("development cache can be isolated from another running server", () => {
    expect(distDir("development", ".next/cart-preview")).toBe(
        ".next/cart-preview"
    );
});
test("default and production builds retain their existing output directory", () => {
    expect(distDir("development")).toBe(".next");
    expect(distDir("production", ".next/cart-preview")).toBe(".next");
});
