export interface LcovEntry {
    linesFound: number;
    linesHit: number;
    linePct: number;
}

export interface ParseLcovOptions {
    /** 与えられた場合、絶対パスはこのプレフィックスを剥がしてリポジトリ相対化する */
    repoRoot?: string;
}

/**
 * Normalize path separators and, when a repository root is provided, return the path relative to that root.
 *
 * @param rawPath - The original file path; backslashes are converted to forward slashes.
 * @param repoRoot - Optional repository root; if provided it is normalized and, when `rawPath` starts with that prefix, the prefix is removed to produce a repository-relative path.
 * @returns The path with forward slashes; if `repoRoot` was provided and matched, the returned path is the repository-relative remainder, otherwise the normalized original path.
 */
function normalizePath(rawPath: string, repoRoot?: string): string {
    if (!repoRoot) return rawPath;
    const normalizedRoot = repoRoot.replace(/\\/g, "/");
    const normalizedPath = rawPath.replace(/\\/g, "/");
    const prefix = normalizedRoot.endsWith("/") ? normalizedRoot : `${normalizedRoot}/`;
    return normalizedPath.startsWith(prefix) ? normalizedPath.slice(prefix.length) : normalizedPath;
}

/**
 * Parse LCOV-formatted text into a map from file path to coverage metrics.
 *
 * @param content - LCOV report text to parse
 * @param options - Optional parsing settings
 * @param options.repoRoot - If provided, absolute paths that begin with this prefix are normalized (backslashes converted to slashes and trailing slash handled) and the prefix is removed to produce repository-relative file paths
 * @returns A Map whose keys are normalized file paths and whose values are `LcovEntry` objects containing `linesFound`, `linesHit`, and `linePct`
 */
export function parseLcov(content: string, options: ParseLcovOptions = {}): Map<string, LcovEntry> {
    const map = new Map<string, LcovEntry>();
    if (!content) return map;

    const lines = content.split(/\r?\n/);
    let currentFile: string | null = null;
    let linesFound = 0;
    let linesHit = 0;

    for (const line of lines) {
        if (line.startsWith("SF:")) {
            currentFile = normalizePath(line.slice(3).trim(), options.repoRoot);
            linesFound = 0;
            linesHit = 0;
        } else if (line.startsWith("LF:") && currentFile) {
            linesFound = Number(line.slice(3).trim()) || 0;
        } else if (line.startsWith("LH:") && currentFile) {
            linesHit = Number(line.slice(3).trim()) || 0;
        } else if (line.startsWith("end_of_record") && currentFile) {
            const pct = linesFound > 0 ? Math.round((linesHit / linesFound) * 100) : 0;
            map.set(currentFile, { linesFound, linesHit, linePct: pct });
            currentFile = null;
        }
    }

    return map;
}
