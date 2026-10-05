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
    output = mkdtempSync(join(tmpdir(), "seven-browser-"));
const mocks = {
    "next-cloudinary": `export function CldUploadWidget({children,onSuccess}){return children({open(){onSuccess({info:{secure_url:'/assets/images/default-user.jpg'}})}})}`,

    "@clerk/nextjs": `import React from 'react'; export function UserButton(){return React.createElement('button',{'aria-label':'User account'},'Account')} export function UserProfile(){return React.createElement('section',{'aria-label':'Clerk fixture'},'Clerk UserProfile adapter (real SDK verification pending)')} export function useUser(){return {user:{firstName:'Test',lastName:'Seller',fullName:'Test Seller',primaryEmailAddress:{emailAddress:'test@example.com'},imageUrl:'/assets/logo.png'},isLoaded:true,isSignedIn:!location.search.includes("guest")}}`,
    "next-themes": `export function useTheme(){return {setTheme(value){document.documentElement.classList.toggle('dark',value==='dark')}}}`,

    "@/queries/user": `export async function addToWishlist(){return true}`,
    "next/navigation": `const router={replace(url){history.replaceState(null,"",url)},push(url){location.assign(url)},refresh(){}}; export function useRouter(){return router}`,
    "next/link": `import React from 'react'; export default function Link({children,...props}){return React.createElement('a',props,children)}`,
    "next/image": `import React from 'react'; export default function Image({priority,fill,unoptimized,...props}){return React.createElement('img',props)}`,
};
await build({
    entryPoints: [resolve(root, "tests/fixtures/seven/preview.tsx")],
    outdir: output,
    bundle: true,
    loader: { ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
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
                        filter: /^(next-cloudinary|@clerk\/nextjs|next-themes|@\/queries\/user|next\/(navigation|image|link))$/,
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
        '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Seven-screen design fixture</title><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/preview.css"></head><body><div id="root"></div><script type="module" src="/preview.js"></script></body></html>'
    );
});
server.listen(3121, "127.0.0.1");
function close() {
    server.close(() => {
        rmSync(output, { recursive: true, force: true });
        process.exit(0);
    });
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
