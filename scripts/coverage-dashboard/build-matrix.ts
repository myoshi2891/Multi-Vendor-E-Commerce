import { categorize, CATEGORIES, DOMAINS, type CategoryId, type DomainId } from "./categorize";
import type { LcovEntry } from "./parse-lcov";
import type { ScannedTest } from "./scan-tests";

export type CellStatus = "full" | "partial" | "missing";

export interface CellFile {
    path: string;
    testCount: number;
    hasSkip: boolean;
    /** 同名ソースのカバレッジ% (lcov 利用時のみ) */
    linePct: number | null;
}

export interface MatrixCell {
    category: CategoryId;
    domain: DomainId;
    status: CellStatus;
    testCount: number;
    files: CellFile[];
    /** ファイル群の平均ラインカバレッジ (null = lcov 情報なし) */
    avgLinePct: number | null;
}

export interface MatrixSummary {
    totalTestFiles: number;
    totalCells: number;
    coveredCells: number;
    coveragePct: number;
    byCategory: Record<CategoryId, number>;
    byDomain: Record<DomainId, number>;
}

export interface Matrix {
    cells: MatrixCell[];
    summary: MatrixSummary;
    cell(category: CategoryId, domain: DomainId): MatrixCell;
}

const COVERAGE_THRESHOLD = 60;

/**
 * カテゴリに対応する「ソース推定パス」を返す。
 * lcov の linePct を引くため、テストファイル → ソースファイルパスへの変換用。
 */
function sourceCandidates(testPath: string): string[] {
    return [
        testPath.replace(/\.test\.(ts|tsx|js|jsx)$/, ".$1"),
        testPath.replace(/\.spec\.(ts|tsx|js|jsx)$/, ".$1"),
    ];
}

function lookupCoverage(testPath: string, lcov: Map<string, LcovEntry>): number | null {
    if (lcov.size === 0) return null;
    for (const candidate of sourceCandidates(testPath)) {
        const hit = lcov.get(candidate);
        if (hit) return hit.linePct;
    }
    return null;
}

function decideStatus(files: CellFile[]): { status: CellStatus; avgLinePct: number | null } {
    if (files.length === 0) return { status: "missing", avgLinePct: null };

    const withCoverage = files.filter((f) => f.linePct !== null) as Array<CellFile & { linePct: number }>;
    const avg = withCoverage.length > 0
        ? Math.round(withCoverage.reduce((a, f) => a + f.linePct, 0) / withCoverage.length)
        : null;

    const hasSkip = files.some((f) => f.hasSkip);
    const lowCoverage = avg !== null && avg < COVERAGE_THRESHOLD;

    if (hasSkip || lowCoverage) return { status: "partial", avgLinePct: avg };
    return { status: "full", avgLinePct: avg };
}

export function buildMatrix(tests: ScannedTest[], lcov: Map<string, LcovEntry>): Matrix {
    // (category, domain) ごとのバケットを初期化
    const buckets = new Map<string, CellFile[]>();
    const key = (c: CategoryId, d: DomainId): string => `${c}|${d}`;

    for (const t of tests) {
        const { category, domain } = categorize(t);
        const cellKey = key(category, domain);
        const list = buckets.get(cellKey) ?? [];
        list.push({
            path: t.relativePath,
            testCount: t.testCount,
            hasSkip: t.hasSkip,
            linePct: lookupCoverage(t.relativePath, lcov),
        });
        buckets.set(cellKey, list);
    }

    // 全 (category × domain) セルを構築
    const cells: MatrixCell[] = [];
    const cellIndex = new Map<string, MatrixCell>();

    for (const cat of CATEGORIES) {
        for (const dom of DOMAINS) {
            const files = buckets.get(key(cat.id, dom.id)) ?? [];
            files.sort((a, b) => a.path.localeCompare(b.path));
            const { status, avgLinePct } = decideStatus(files);
            const testCount = files.reduce((sum, f) => sum + f.testCount, 0);
            const cell: MatrixCell = {
                category: cat.id,
                domain: dom.id,
                status,
                testCount,
                files,
                avgLinePct,
            };
            cells.push(cell);
            cellIndex.set(key(cat.id, dom.id), cell);
        }
    }

    // サマリ集計
    const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<CategoryId, number>;
    const byDomain = Object.fromEntries(DOMAINS.map((d) => [d.id, 0])) as Record<DomainId, number>;

    for (const t of tests) {
        const { category, domain } = categorize(t);
        byCategory[category]++;
        byDomain[domain]++;
    }

    const coveredCells = cells.filter((c) => c.status !== "missing").length;
    const summary: MatrixSummary = {
        totalTestFiles: tests.length,
        totalCells: cells.length,
        coveredCells,
        coveragePct: cells.length > 0 ? Math.round((coveredCells / cells.length) * 100) : 0,
        byCategory,
        byDomain,
    };

    return {
        cells,
        summary,
        cell(category: CategoryId, domain: DomainId): MatrixCell {
            const c = cellIndex.get(key(category, domain));
            if (!c) {
                throw new Error(`Cell not found: ${category}/${domain}`);
            }
            return c;
        },
    };
}
