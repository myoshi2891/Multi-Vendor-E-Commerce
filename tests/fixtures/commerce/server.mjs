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
    output = mkdtempSync(join(tmpdir(), "commerce-browser-"));
const mocks = {
    "next/navigation": `export function useRouter(){return {push(){},refresh(){}}}`,
    "next/link": `import React from 'react'; export default function Link({children,...props}){return React.createElement('a',props,children)}`,
    "next/image": `import React from 'react'; export default function Image({priority,fill,unoptimized,...props}){return React.createElement('img',props)}`,
    "@stripe/stripe-js": `export function loadStripe(){return Promise.resolve(null)}`,
    "@stripe/react-stripe-js": `import React from 'react'; export function Elements({children}){return children} export function useStripe(){return {}} export function useElements(){return {}} export function PaymentElement(){return React.createElement('div',null,'Card provider fixture')}`,
    "@paypal/react-paypal-js": `import React from 'react'; export const DISPATCH_ACTION={RESET_OPTIONS:'resetOptions'}; export function PayPalScriptProvider({children}){return children} export function usePayPalScriptReducer(){return [{isPending:false,isRejected:false,options:{}},()=>{}]} export function PayPalButtons({disabled,onError}){return React.createElement('button',{disabled,onClick:()=>onError(new Error('fixture provider failure'))},'PayPal fixture')}`,
};
await build({
    entryPoints: [resolve(root, "tests/fixtures/commerce/preview.tsx")],
    outdir: output,
    bundle: true,
    format: "esm",
    jsx: "automatic",
    sourcemap: true,
    tsconfig: resolve(root, "tsconfig.json"),
    define: {
        "process.env": "{}",
        "process.env.NODE_ENV": '"development"',
        "process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY": '"pk_test_fixture"',
    },
    plugins: [
        {
            name: "browser-only-adapters",
            setup(builder) {
                builder.onResolve(
                    {
                        filter: /^(next\/(navigation|image|link)|@stripe\/(stripe-js|react-stripe-js)|@paypal\/react-paypal-js)$/,
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
                path.endsWith(".png") ? "image/png" : "image/jpeg"
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
        '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Commerce browser fixture</title><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/preview.css"></head><body><div id="root"></div><script type="module" src="/preview.js"></script></body></html>'
    );
});
server.listen(3107, "127.0.0.1");
function close() {
    server.close(() => {
        rmSync(output, { recursive: true, force: true });
        process.exit(0);
    });
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
