// Isolated browser harness. Output lives in the OS temp directory; no public app route is added.
import { createRequire } from "node:module";
// Use the bundler already required by the project's tsx tooling.
const { build } = createRequire(import.meta.resolve("tsx"))("esbuild");
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const root = process.cwd(),
    output = mkdtempSync(join(tmpdir(), "priority-browser-"));
const mocks = {
    "@/queries/user": `export async function addToWishlist(){return true}`,
    "next/navigation": `const router={replace(url){history.replaceState(null,"",url)},push(url){location.assign(url)},refresh(){}}; export function useRouter(){return router}`,
    "next/link": `import React from 'react'; export default function Link({children,...props}){return React.createElement('a',props,children)}`,
    "next/image": `import React from 'react'; export default function Image({priority,fill,unoptimized,...props}){return React.createElement('img',props)}`,
};
await build({
    entryPoints: [resolve(root, "tests/fixtures/priority/preview.tsx")],
    outdir: output,
    bundle: true,
    format: "esm",
    jsx: "automatic",
    sourcemap: true,
    tsconfig: resolve(root, "tsconfig.json"),
    define: {
        "process.env": "{}",
        "process.env.NODE_ENV": '"development"',
    },
    plugins: [
        {
            name: "browser-only-adapters",
            setup(builder) {
                builder.onResolve(
                    {
                        filter: /^(@\/queries\/user|next\/(navigation|image|link))$/,
                    },
                    (args) => ({ path: args.path, namespace: "fixture" })
                );
                builder.onLoad(
                    { filter: /.*/, namespace: "fixture" },
                    (args) => ({
                        contents: mocks[args.path],
                        loader: "js",
                        resolveDir: root,
                    })
                );
            },
        },
    ],
});
execFileSync(
    resolve(root, "node_modules/.bin/tailwindcss"),
    ["-i", "src/app/globals.css", "-o", join(output, "global.css")],
    { cwd: root, stdio: "pipe" }
);
const server = createServer((request, response) => {
    const path = new URL(request.url, "http://localhost").pathname;
    const assets = {
        "/preview.js": ["text/javascript", join(output, "preview.js")],
        "/preview.css": ["text/css", join(output, "preview.css")],
        "/global.css": ["text/css", join(output, "global.css")],
    };
    if (assets[path]) {
        const [mime, file] = assets[path];
        response.setHeader("Content-Type", mime);
        response.end(readFileSync(file));
        return;
    }
    if (path.startsWith("/assets/")) {
        try {
            response.setHeader(
                "Content-Type",
                path.endsWith(".svg")
                    ? "image/svg+xml"
                    : path.endsWith(".png")
                      ? "image/png"
                      : "image/jpeg"
            );
            response.end(readFileSync(join(root, "public", path)));
            return;
        } catch {
            response.statusCode = 404;
            response.end();
            return;
        }
    }
    response.setHeader("Content-Type", "text/html");
    response.end(
        '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Priority design browser fixture</title><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/preview.css"></head><body><div id="root"></div><script type="module" src="/preview.js"></script></body></html>'
    );
});
server.listen(3110, "127.0.0.1");
function close() {
    server.close(() => {
        rmSync(output, { recursive: true, force: true });
        process.exit(0);
    });
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
