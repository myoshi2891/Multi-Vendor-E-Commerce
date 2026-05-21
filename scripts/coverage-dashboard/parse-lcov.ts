export interface LcovEntry {
    linesFound: number;
    linesHit: number;
    linePct: number;
}

export interface ParseLcovOptions {
    /** 与えられた場合、絶対パスはこのプレフィックスを剥がしてリポジトリ相対化する */
    repoRoot?: string;
}

function normalizePath(rawPath: string, repoRoot?: string): string {
    if (!repoRoot) return rawPath;
    const normalizedRoot = repoRoot.replace(/\\/g, "/");
    const normalizedPath = rawPath.replace(/\\/g, "/");
    const prefix = normalizedRoot.endsWith("/") ? normalizedRoot : `${normalizedRoot}/`;
    return normalizedPath.startsWith(prefix) ? normalizedPath.slice(prefix.length) : normalizedPath;
}

/**
 * LCOV テキストを解釈し、ファイルパス → カバレッジ指標の Map を返す。
 * 不正な入力に対しては該当エントリのみスキップし、例外を投げない。
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
