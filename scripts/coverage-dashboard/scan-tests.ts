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
// describe は wrapper のため testCount からは除外。
//
// 修飾子は**列挙**する（`(\.\w+)?` のような総称形にしない）。理由は 2 つ:
//  - `test.describe(` / `test.step(` を拾ってしまう（wrapper・非テストブロック）
//  - `it.each(` を拾うと EACH_PATTERN の展開ぶんと二重計上になる
//
// 修飾子付きの一致は**宣言形と注釈形の 2 通りがある**ため、正規表現だけでは
// 計上を決められない（`countBlockDeclarations` が第 1 引数で判別する）:
//  - 宣言形 `test.skip('title', fn)` … 実行時に skipped なテストケースとして
//    reporter に出るので計上する
//  - 注釈形 `test.skip(cond, 'reason')` … Playwright のテスト**本体内**に置く
//    conditional modifier。囲みの `test('title')` が既に計上済みなので、
//    これを数えると二重計上になる
const BLOCK_PATTERN =
    /\b(it|test)(\.(skip|only|todo|failing|fails|fixme|concurrent))?\s*\(/g;
// it.each / test.each は実行時にテーブル行数ぶんのテストへ展開される。
// BLOCK_PATTERN は `it(` 形式しか拾えず each を 0 件と数えてしまうため、別途展開する。
//
// 修飾子は `.each` の**手前**に付く（`it.skip.each` / `test.only.each`）。
// BLOCK_PATTERN は `.skip` の直後が `(` でないため一致せず、ここが `it.each` 固定だと
// `it.skip.each` は両方をすり抜けてテーブル行数が丸ごと欠測する。
// BLOCK_PATTERN と同じ修飾子を**列挙**で許容する（総称形にしない理由は上のコメント参照）。
const EACH_PATTERN =
    /\b(it|test)(\.(skip|only|todo|failing|fails|fixme|concurrent))?\.each\b/g;

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
            // 配列そのものの開き括弧（depth 0 → 1）は「要素」ではない。
            // ここで hasContent を立てると `it.each([])` が 1 件に化ける。
            if (depth >= 1) hasContent = true;
            depth++;
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
 * ファイル内の `it(` / `test(` ブロック**宣言**の件数を返す。
 *
 * 修飾子付きの一致（`test.skip(` 等）は、第 1 引数が文字列リテラルかどうかで
 * 宣言形と注釈形を判別する:
 *
 * - `test.skip('title', fn)` → **宣言**。実行時に skipped なテストケースとして
 *   reporter に出るので計上する。
 * - `test.skip(cond, 'reason')` / `test.skip()` → **注釈**（Playwright の
 *   conditional modifier）。テスト本体の中に置かれ、囲みの `test('title')` が
 *   既に 1 件として計上されているため、数えると二重計上になる。
 *
 * 素の `it(` / `test(` は常に宣言なのでこの判別を通さない
 * （タイトルが変数・テンプレートリテラルの場合を落とさないため）。
 *
 * @param content - ファイル全体の内容
 */
function countBlockDeclarations(content: string): number {
    let total = 0;
    BLOCK_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = BLOCK_PATTERN.exec(content)) !== null) {
        // match[2] は `.skip` 等の修飾子部分。無ければ素の宣言なので無条件に計上。
        if (match[2] === undefined) {
            total++;
            continue;
        }

        // 修飾子付き: `(` の次の有効文字が引用符なら宣言（テストタイトル）。
        const argStart = skipTrivia(content, match.index + match[0].length);
        const first = content[argStart];
        if (first === '"' || first === "'" || first === "`") total++;
    }

    return total;
}

/**
 * `const <name> = [` / `export const <name>: T[] = [` の配列リテラル開始位置を返す。
 * 型注釈（`: readonly PaymentStatus[]`）をまたげるよう、`=` の後の最初の `[` を探す。
 *
 * @param content - 検索対象のファイル内容
 * @param name - 探す定数名
 * @returns 配列開始 `[` の位置。見つからなければ -1
 */
function findConstArrayStart(content: string, name: string): number {
    // 名前は識別子なので正規表現メタ文字を含まない（EACH_IDENT_PATTERN で抽出済み）。
    const declPattern = new RegExp(
        `\\b(?:export\\s+)?(?:const|let|var)\\s+${name}\\s*(?::[^=]*)?=`,
        "g"
    );
    const match = declPattern.exec(content);
    if (match === null) return -1;

    const i = skipTrivia(content, match.index + match[0].length);
    return content[i] === "[" ? i : -1;
}

/**
 * `import { <name> } from "<specifier>"` の指定子を返す。
 * default import / namespace import は対象外（テーブル定数は named export 前提）。
 *
 * @param content - 検索対象のファイル内容
 * @param name - 探すインポート名
 * @returns モジュール指定子。見つからなければ null
 */
function findImportSpecifier(content: string, name: string): string | null {
    const importPattern = /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
    let match: RegExpExecArray | null;

    while ((match = importPattern.exec(content)) !== null) {
        const named = match[1]
            .split(",")
            .map((entry) => entry.trim().split(/\s+as\s+/)[0].trim());
        if (named.includes(name)) return match[2];
    }
    return null;
}

/**
 * モジュール指定子をファイルパスへ解決する（**単一ホップのみ**）。
 *
 * 対応するのは `@/` エイリアス（→ `<root>/src/`）と相対パスだけ。
 * パッケージ名・多段 re-export・動的生成は追わない —— 推測で件数を盛るより、
 * 過小計上のまま残すほうが安全なため（静的走査の原理的限界）。
 *
 * @param specifier - `import ... from` の指定子
 * @param fromFile - import 元ファイルの絶対パス
 * @param root - 走査ルートの絶対パス
 * @returns 解決した絶対パス。解決できなければ null
 */
async function resolveModulePath(
    specifier: string,
    fromFile: string,
    root: string
): Promise<string | null> {
    let base: string;
    if (specifier.startsWith("@/")) {
        base = join(root, "src", specifier.slice(2));
    } else if (specifier.startsWith(".")) {
        base = join(fromFile, "..", specifier);
    } else {
        return null;
    }

    for (const candidate of [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        join(base, "index.ts"),
    ]) {
        try {
            if ((await stat(candidate)).isFile()) return candidate;
        } catch {
            // 存在しない候補は次へ。
        }
    }
    return null;
}

/**
 * `it.each(IDENT)` の識別子から、展開されるテーブル行数を解決する。
 *
 * 1. 同一ファイル内の `const IDENT = [...]`
 * 2. `import { IDENT } from "@/..."`（または相対パス）の単一ホップ先の
 *    `export const IDENT = [...]`
 *
 * どちらでも解決できなければ 0（過大計上しない fail-safe）。
 *
 * @param name - `it.each(` の引数として現れた識別子
 * @param content - 呼び出し元ファイルの内容
 * @param absPath - 呼び出し元ファイルの絶対パス
 * @param root - 走査ルートの絶対パス
 */
async function resolveIdentifierTableSize(
    name: string,
    content: string,
    absPath: string,
    root: string
): Promise<number> {
    const localStart = findConstArrayStart(content, name);
    if (localStart !== -1) return countArrayElements(content, localStart);

    const specifier = findImportSpecifier(content, name);
    if (specifier === null) return 0;

    const modulePath = await resolveModulePath(specifier, absPath, root);
    if (modulePath === null) return 0;

    try {
        const moduleContent = await readFile(modulePath, "utf-8");
        const start = findConstArrayStart(moduleContent, name);
        return start === -1 ? 0 : countArrayElements(moduleContent, start);
    } catch {
        return 0;
    }
}

/**
 * ファイル内の `it.each` / `test.each` が実行時に展開されるテスト数の合計を返す。
 *
 * @param content - ファイル全体の内容
 * @param absPath - 対象ファイルの絶対パス（識別子参照の import 解決に使う）
 * @param root - 走査ルートの絶対パス（`@/` エイリアス解決に使う）
 */
async function countEachCases(
    content: string,
    absPath: string,
    root: string
): Promise<number> {
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

        if (content[i] !== "(") continue;
        i = skipTrivia(content, i + 1);

        // it.each([...]) の配列リテラル
        if (content[i] === "[") {
            total += countArrayElements(content, i);
            continue;
        }

        // it.each(IDENT) の識別子参照。テーブルを名前付き定数へ括り出した形で、
        // ここを見ないとファイルのケース数が丸ごと過小計上される。
        const identMatch = /^[A-Za-z_$][\w$]*/.exec(content.slice(i));
        if (identMatch === null) continue;

        // 呼び出し `IDENT(...)` や メンバ参照 `IDENT.x` はテーブルではない。
        const after = skipTrivia(content, i + identMatch[0].length);
        if (content[after] !== ")") continue;

        total += await resolveIdentifierTableSize(
            identMatch[0],
            content,
            absPath,
            root
        );
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
 * @param root - 走査ルートの絶対パス（`it.each(IDENT)` の import 解決に使う）
 * @returns An object with `hasSkip`: `true` if the file contains skip markers (e.g., `.skip`, `xit`, `xdescribe`), `false` otherwise; and `testCount`: the number of `it(`/`test(` occurrences in the file. On read failure returns `{ hasSkip: false, testCount: 0 }`.
 */
async function inspectFile(
    absPath: string,
    root: string
): Promise<{ hasSkip: boolean; testCount: number }> {
    try {
        const content = await readFile(absPath, "utf-8");
        return {
            // hasSkip は「ファイルに skip マーカーが存在するか」の意味を維持する
            // （注釈形の条件付き skip も skip マーカーではあるため区別しない）。
            // testCount とは別の統計に紐づくので、意味を変えない。
            hasSkip: SKIP_PATTERN.test(content),
            testCount:
                countBlockDeclarations(content) +
                (await countEachCases(content, absPath, root)),
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
        const { hasSkip, testCount } = await inspectFile(abs, root);
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
