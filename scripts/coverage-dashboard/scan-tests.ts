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

/**
 * Recursively collects file paths under a directory into the provided accumulator.
 *
 * @param dir - Directory path to traverse
 * @param acc - Array that will be populated with discovered file paths (absolute)
 */
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

/**
 * Determine the test framework kind for an absolute file path or indicate that the path is not a test file.
 *
 * @param absPath - Absolute file path to classify
 * @returns `'jest'` or `'playwright'` when `absPath` matches the test filename pattern, `null` otherwise
 */
function classify(absPath: string): TestKind | null {
    if (!JEST_TEST_PATTERN.test(absPath)) return null;
    return absPath.includes(PLAYWRIGHT_DIR_FRAGMENT) ? "playwright" : "jest";
}

/**
 * Determines whether a test file contains skip markers and counts test blocks.
 *
 * @param absPath - Absolute path to the file to inspect
 * @returns An object with `hasSkip`: `true` if the file contains skip markers (e.g., `.skip`, `xit`, `xdescribe`), `false` otherwise; and `testCount`: the number of `it(`/`test(` occurrences in the file. On read failure returns `{ hasSkip: false, testCount: 0 }`.
 */
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

/**
 * Convert an OS-native file path to POSIX-style by replacing platform separators with `/`.
 *
 * @param path - The input file system path
 * @returns The input path with OS-specific separators replaced by `/`
 */
function toPosix(path: string): string {
    return path.split(sep).join("/");
}

/**
 * Scan a directory tree and produce metadata for discovered test files.
 *
 * @param root - Path of the directory to scan for test files
 * @returns An array of ScannedTest objects (each with `relativePath`, `kind`, `hasSkip`, and `testCount`), sorted by `relativePath` in ascending order. Returns an empty array if `root` does not exist or is not a directory.
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
