import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export type TestKind = "jest" | "playwright";

export interface ScannedTest {
    /** リポジトリルートからの POSIX 形式相対パス */
    relativePath: string;
    /** Jest なら "jest"、Playwright なら "playwright" */
    kind: TestKind;
    /** `.skip` / `xdescribe` / `xit` を含むか */
    hasSkip: boolean;
    /** ファイル内の `it(` / `test(` / `describe(` 呼び出し総数 */
    testCount: number;
}

const IGNORED_DIRS = new Set([
    "node_modules",
    ".git",
    ".next",
    ".turbo",
    "dist",
    "build",
    "coverage",
]);

const JEST_TEST_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$/;
const PLAYWRIGHT_DIR_FRAGMENT = `${sep}tests${sep}e2e${sep}`;
const SKIP_PATTERN = /\b(it|test|describe)\.skip\b|\b(xit|xdescribe)\b/;
// describe は wrapper のため testCount からは除外
const BLOCK_PATTERN = /\b(it|test)\s*\(/g;

async function walk(dir: string, acc: string[]): Promise<void> {
    let entries: Awaited<ReturnType<typeof readdir>>;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            await walk(full, acc);
        } else if (entry.isFile()) {
            acc.push(full);
        }
    }
}

function classify(absPath: string): TestKind | null {
    if (!JEST_TEST_PATTERN.test(absPath)) return null;
    return absPath.includes(PLAYWRIGHT_DIR_FRAGMENT) ? "playwright" : "jest";
}

async function inspectFile(absPath: string): Promise<{ hasSkip: boolean; testCount: number }> {
    try {
        const content = await readFile(absPath, "utf-8");
        return {
            hasSkip: SKIP_PATTERN.test(content),
            testCount: (content.match(BLOCK_PATTERN) ?? []).length,
        };
    } catch {
        return { hasSkip: false, testCount: 0 };
    }
}

function toPosix(path: string): string {
    return path.split(sep).join("/");
}

/**
 * 指定 root 配下を走査してテストファイル一覧を返す。
 * 結果は relativePath 昇順でソート済み。
 */
export async function scanTests(root: string): Promise<ScannedTest[]> {
    try {
        const rootStat = await stat(root);
        if (!rootStat.isDirectory()) return [];
    } catch {
        return [];
    }

    const files: string[] = [];
    await walk(root, files);

    const results: ScannedTest[] = [];
    for (const abs of files) {
        const kind = classify(abs);
        if (!kind) continue;
        const { hasSkip, testCount } = await inspectFile(abs);
        results.push({
            relativePath: toPosix(relative(root, abs)),
            kind,
            hasSkip,
            testCount,
        });
    }

    results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    return results;
}
