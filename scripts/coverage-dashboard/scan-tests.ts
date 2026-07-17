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
// it.each / test.each は実行時にテーブル行数ぶんのテストへ展開される。
// BLOCK_PATTERN は `it(` 形式しか拾えず each を 0 件と数えてしまうため、別途展開する。
const EACH_PATTERN = /\b(it|test)\.each\b/g;

/** 空白・行コメント・ブロックコメントを読み飛ばし、次の有効文字の位置を返す */
function skipTrivia(content: string, start: number): number {
    let i = start;
    while (i < content.length) {
        const c = content[i];
        if (c === " " || c === "\t" || c === "\n" || c === "\r") {
            i++;
        } else if (c === "/" && content[i + 1] === "/") {
            const nl = content.indexOf("\n", i);
            if (nl === -1) return content.length;
            i = nl + 1;
        } else if (c === "/" && content[i + 1] === "*") {
            const end = content.indexOf("*/", i + 2);
            if (end === -1) return content.length;
            i = end + 2;
        } else {
            return i;
        }
    }
    return i;
}

/** クォート文字列の終端の次の位置を返す（エスケープを考慮） */
function skipString(content: string, start: number): number {
    const quote = content[start];
    let i = start + 1;
    while (i < content.length) {
        if (content[i] === "\\") {
            i += 2;
            continue;
        }
        if (content[i] === quote) return i + 1;
        i++;
    }
    return i;
}

/** `<...>` の型引数を釣り合いを取って読み飛ばす */
function skipGenerics(content: string, start: number): number {
    let depth = 0;
    let i = start;
    while (i < content.length) {
        const c = content[i];
        if (c === "<") depth++;
        else if (c === ">") {
            depth--;
            if (depth === 0) return i + 1;
        } else if (c === '"' || c === "'") {
            i = skipString(content, i);
            continue;
        }
        i++;
    }
    return i;
}

/**
 * `it.each([...])` の配列リテラルから、トップレベル要素数（= 展開されるテスト数）を数える。
 * 末尾カンマは要素として数えない。
 *
 * @param content - ファイル全体の内容
 * @param start - 配列の開始 `[` の位置
 */
function countArrayElements(content: string, start: number): number {
    let depth = 0;
    let elements = 0;
    let hasContent = false;
    let i = start;

    while (i < content.length) {
        const c = content[i];

        if (c === '"' || c === "'" || c === "`") {
            i = skipString(content, i);
            hasContent = true;
            continue;
        }
        if (c === "/" && (content[i + 1] === "/" || content[i + 1] === "*")) {
            i = skipTrivia(content, i);
            continue;
        }
        if (c === "[" || c === "{" || c === "(") {
            depth++;
            hasContent = true;
        } else if (c === "]" || c === "}" || c === ")") {
            depth--;
            if (depth === 0) {
                if (hasContent) elements++;
                return elements;
            }
            hasContent = true;
        } else if (c === "," && depth === 1) {
            if (hasContent) elements++;
            hasContent = false;
        } else if (!/\s/.test(c)) {
            hasContent = true;
        }
        i++;
    }
    return elements;
}

/**
 * テンプレートリテラル表（test.each の `a | b` 形式）のデータ行数を数える。
 * 先頭行はヘッダのため除外する。
 *
 * @param content - ファイル全体の内容
 * @param start - 開始バッククォートの位置
 */
function countTemplateTableRows(content: string, start: number): number {
    let i = start + 1;
    const from = i;
    while (i < content.length) {
        if (content[i] === "\\") {
            i += 2;
            continue;
        }
        if (content[i] === "`") break;
        if (content[i] === "$" && content[i + 1] === "{") {
            let depth = 1;
            i += 2;
            while (i < content.length && depth > 0) {
                if (content[i] === "{") depth++;
                else if (content[i] === "}") depth--;
                i++;
            }
            continue;
        }
        i++;
    }

    const rows = content
        .slice(from, i)
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    // ヘッダ行を除いたデータ行数
    return Math.max(rows.length - 1, 0);
}

/**
 * ファイル内の `it.each` / `test.each` が実行時に展開されるテスト数の合計を返す。
 *
 * @param content - ファイル全体の内容
 */
function countEachCases(content: string): number {
    let total = 0;
    EACH_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = EACH_PATTERN.exec(content)) !== null) {
        let i = skipTrivia(content, match.index + match[0].length);

        // it.each<T>([...]) の型引数を読み飛ばす
        if (content[i] === "<") {
            i = skipGenerics(content, i);
            i = skipTrivia(content, i);
        }

        // test.each の テンプレートリテラル表
        if (content[i] === "`") {
            total += countTemplateTableRows(content, i);
            continue;
        }

        // it.each([...]) の配列リテラル
        if (content[i] === "(") {
            i = skipTrivia(content, i + 1);
            if (content[i] === "[") {
                total += countArrayElements(content, i);
            }
        }
    }
    return total;
}

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
            testCount:
                (content.match(BLOCK_PATTERN) ?? []).length +
                countEachCases(content),
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
