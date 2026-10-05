// Isolated browser harness. Output lives in the OS temp directory; no public app route is added.
// 各 suite の tests/fixtures/<suite>/server.mjs はこの関数に固有の mock と port を渡すだけにする。
// server.mjs をコピーして新設しないこと（.claude/rules/05-playwright-harness.md）。
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
// Use the bundler already required by the project's tsx tooling.
const { build } = createRequire(import.meta.resolve("tsx"))("esbuild");

/** 全 suite 共通のブラウザー用 adapter。suite 側の mocks で上書きできる。 */
const DEFAULT_MOCKS = {
    "next/link": `import React from 'react'; export default function Link({children,...props}){return React.createElement('a',props,children)}`,
    "next/image": `import React from 'react'; export default function Image({priority,fill,unoptimized,...props}){return React.createElement('img',props)}`,
};

const MIME_BY_EXTENSION = {
    ".svg": "image/svg+xml",
    ".png": "image/png",
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * preview.tsx を esbuild で bundle し、Tailwind の global.css と共に loopback で配信する。
 * SIGTERM / SIGINT（Playwright の webServer 終了）で tmp 出力を削除して終了する。
 *
 * @param {object} options
 * @param {string} options.name tmp ディレクトリ名の接頭辞
 * @param {string} options.entry リポジトリルートからの preview.tsx のパス
 * @param {number} options.port listen する port（playwright.design.config.ts の DESIGN_SUITES と一致させる）
 * @param {string} options.title HTML の <title>
 * @param {Record<string, string>} [options.mocks] モジュール名 → 差し替えるソース
 * @param {Record<string, string>} [options.loader] esbuild の追加 loader
 * @param {Record<string, string>} [options.define] esbuild の追加 define
 */
export async function startFixtureServer({
    name,
    entry,
    port,
    title,
    mocks = {},
    loader = {},
    define = {},
}) {
    const root = process.cwd();
    const output = mkdtempSync(join(tmpdir(), `${name}-browser-`));
    const adapters = { ...DEFAULT_MOCKS, ...mocks };
    const filter = new RegExp(
        `^(${Object.keys(adapters).map(escapeRegExp).join("|")})$`
    );

    await build({
        entryPoints: [resolve(root, entry)],
        outdir: output,
        bundle: true,
        loader,
        format: "esm",
        jsx: "automatic",
        sourcemap: true,
        tsconfig: resolve(root, "tsconfig.json"),
        define: {
            "process.env": "{}",
            "process.env.NODE_ENV": '"development"',
            ...define,
        },
        plugins: [
            {
                name: "browser-only-adapters",
                setup(builder) {
                    builder.onResolve({ filter }, (args) => ({
                        path: args.path,
                        namespace: "fixture",
                    }));
                    builder.onLoad(
                        { filter: /.*/, namespace: "fixture" },
                        (args) => ({
                            contents: adapters[args.path],
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

    const assets = {
        "/preview.js": ["text/javascript", join(output, "preview.js")],
        "/preview.css": ["text/css", join(output, "preview.css")],
        "/global.css": ["text/css", join(output, "global.css")],
    };
    const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/preview.css"></head><body><div id="root"></div><script type="module" src="/preview.js"></script></body></html>`;

    const server = createServer((request, response) => {
        const path = new URL(request.url, "http://localhost").pathname;
        if (assets[path]) {
            const [mime, file] = assets[path];
            response.setHeader("Content-Type", mime);
            response.end(readFileSync(file));
            return;
        }
        if (path.startsWith("/assets/")) {
            try {
                const extension = path.slice(path.lastIndexOf("."));
                response.setHeader(
                    "Content-Type",
                    MIME_BY_EXTENSION[extension] ?? "image/jpeg"
                );
                response.end(readFileSync(join(root, "public", path)));
            } catch {
                // public/ に無いアセットは 404 で返す（fixture の欠落画像はテスト対象外）
                response.statusCode = 404;
                response.end();
            }
            return;
        }
        response.setHeader("Content-Type", "text/html");
        response.end(html);
    });
    server.listen(port, "127.0.0.1");

    const close = () => {
        // keep-alive 接続が残ると server.close() のコールバックが呼ばれないため先に切断する
        server.closeAllConnections();
        server.close(() => {
            rmSync(output, { recursive: true, force: true });
            process.exit(0);
        });
    };
    process.on("SIGTERM", close);
    process.on("SIGINT", close);
}
