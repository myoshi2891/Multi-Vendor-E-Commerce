/**
 * ============================================================================
 *  ERD レイアウト override 抽出ツール（draw.io 手調整 → サイドカー還流）
 * ============================================================================
 *
 * 【役割】
 *   `data-model.drawio` を draw.io で**視覚調整した結果**（エッジの経由点・接続ポート、
 *   任意でノード位置）を読み取り、`scripts/erd/layout-overrides.json` 形式へ機械抽出する。
 *   これにより「draw.io で線を動かす → 抽出 → サイドカー確定 → 再生成で決定論的に再現」
 *   という往復を、手書き転記のミスなく回せる。
 *
 *   ※ `.drawio` は生成物のため直接コミットしない。調整意図は必ずサイドカーへ還流すること
 *     （[.claude/rules/03-data-model-diagram-sync.md] / erd-diagram-adjust スキル）。
 *
 * 【実行】
 *   bun run erd:extract                       # data-model.drawio → layout-overrides.json（エッジ配線のみ）
 *   bun run erd:extract -- --include-nodes     # ノード位置も抽出（移動したエンティティを固定したい場合）
 *   bun run erd:extract -- <input.drawio> <output.json>
 *
 * 【設計意図】
 *   既定はエッジ配線（waypoints / exit・entry ポート）のみを抽出する。ノード位置を
 *   全件固定すると生成器の自動レイアウトが死ぬため、`--include-nodes` を明示した時だけ
 *   ノードを出力する（その場合も移動有無に関わらず全モデルを書き出す点に注意）。
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_INPUT = resolve(ROOT, "docs/architecture/data-model.drawio");
const DEFAULT_OUTPUT = resolve(ROOT, "scripts/erd/layout-overrides.json");

// 生成器が割り振る補助セルの ID パターン（`<pageId>_n####` / `<pageId>_legend`）。
// モデル/enum ノードの ID はこれら以外（= スキーマ上の名前）。
const AUTO_ID = /_n\d+$/;
const LEGEND_ID = /_legend$/;
const NON_MODEL_IDS = new Set(["0", "1"]);

interface NodeOverride {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
}
interface EdgeOverride {
    waypoints?: { x: number; y: number }[];
    exitX?: number;
    exitY?: number;
    entryX?: number;
    entryY?: number;
}
interface PageOverride {
    nodes: Record<string, NodeOverride>;
    edges: Record<string, EdgeOverride>;
}
/** ページ別レイアウト override（マルチページ）。キーは diagram id。 */
interface LayoutOverrides {
    pages: Record<string, PageOverride>;
}

/**
 * Split a draw.io XML string into individual `<mxCell>` blocks.
 *
 * Each returned entry begins with `<mxCell` and contains the content up to (but not including) the next `<mxCell` start.
 *
 * @param xml - The complete draw.io XML text to split
 * @returns An array of `<mxCell...>` blocks as strings
 */
function splitCells(xml: string): string[] {
    return xml
        .split(/(?=<mxCell\b)/)
        .filter((b) => b.startsWith("<mxCell"));
}

/**
 * Extracts key="value" attributes from the opening tag of an XML/HTML-like block.
 *
 * Parses the substring from the start of `block` up to the first `>` and returns a record
 * mapping attribute names to their unescaped string values. Assumes attribute values do not
 * contain `"` characters and that `value`/`style` content does not contain `>`.
 *
 * @param block - The full element text (e.g. an `<mxCell ...>` block)
 * @returns A map of attribute names to attribute values found in the opening tag
 */
function parseAttrs(block: string): Record<string, string> {
    const head = block.slice(0, block.indexOf(">"));
    const attrs: Record<string, string> = {};
    const re = /(\w+)="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(head)) !== null) {
        attrs[m[1]] = m[2];
    }
    return attrs;
}

/**
 * Extracts a numeric property value from a style string.
 *
 * @param style - The style string to search for the property (e.g. `"...;exitX=0.5;..."`).
 * @param key - The property name to look up (the function searches for `key=<number>`).
 * @returns The numeric value of the property if present and finite, `undefined` otherwise.
 */
function styleNumber(style: string, key: string): number | undefined {
    const m = style.match(new RegExp(`${key}=([\\d.]+)`));
    if (!m) return undefined;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : undefined;
}

/**
 * Extracts waypoint coordinates from an `<Array as="points">` fragment inside an mxCell block.
 *
 * @param block - The mxCell XML fragment to search for an `<Array as="points">` element
 * @returns An array of `{ x, y }` objects parsed from `<mxPoint x="..." y="..."/>` entries; empty if none found
 */
function parseWaypoints(block: string): { x: number; y: number }[] {
    const arr = block.match(/<Array\s+as="points">([\s\S]*?)<\/Array>/);
    if (!arr) return [];
    const pts: { x: number; y: number }[] = [];
    const re = /<mxPoint\s+x="(-?[\d.]+)"\s+y="(-?[\d.]+)"\s*\/?>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(arr[1])) !== null) {
        const x = Number(m[1]);
        const y = Number(m[2]);
        if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
    }
    return pts;
}

/**
 * Produce a discriminator string from an edge label by removing a trailing cascade symbol.
 *
 * @param value - The edge label text
 * @returns The label with a trailing `⛓` (and surrounding whitespace) removed and trimmed
 */
function labelToDiscriminator(value: string): string {
    return value.replace(/\s*⛓\s*$/, "").trim();
}

/**
 * Extract routing information and, optionally, node coordinates from a single `<diagram>` XML body.
 *
 * @param body - The inner XML content of a single `<diagram>` element to parse.
 * @param includeNodes - If true, extract vertex node geometries; otherwise omit node coordinates.
 * @returns A PageOverride object whose `edges` maps `source->target:discriminator` to routing overrides (only populated when waypoints or exit/entry coordinates are present) and whose `nodes` maps node IDs to `{x,y,w,h}` (only populated when `includeNodes` is true and a vertex has a valid mxGeometry and is not an auto/legend/non-model id).
 */
function extractDiagram(body: string, includeNodes: boolean): PageOverride {
    const page: PageOverride = { nodes: {}, edges: {} };
    for (const block of splitCells(body)) {
        const attrs = parseAttrs(block);
        const style = attrs.style ?? "";

        // --- エッジ: 配線情報（waypoints / exit・entry）がある場合のみ抽出 ---
        if (attrs.edge === "1" && attrs.source && attrs.target) {
            const waypoints = parseWaypoints(block);
            const exitX = styleNumber(style, "exitX");
            const exitY = styleNumber(style, "exitY");
            const entryX = styleNumber(style, "entryX");
            const entryY = styleNumber(style, "entryY");
            const hasRouting =
                waypoints.length > 0 ||
                exitX !== undefined ||
                exitY !== undefined ||
                entryX !== undefined ||
                entryY !== undefined;
            if (!hasRouting) continue;

            const disc = labelToDiscriminator(attrs.value ?? "");
            const key = `${attrs.source}->${attrs.target}:${disc}`;
            const ov: EdgeOverride = {};
            if (waypoints.length > 0) ov.waypoints = waypoints;
            if (exitX !== undefined) ov.exitX = exitX;
            if (exitY !== undefined) ov.exitY = exitY;
            if (entryX !== undefined) ov.entryX = entryX;
            if (entryY !== undefined) ov.entryY = entryY;
            page.edges[key] = ov;
            continue;
        }

        // --- ノード: --include-nodes 指定時のみ、モデル/enum ノードの座標を抽出 ---
        if (includeNodes && attrs.vertex === "1") {
            const id = attrs.id ?? "";
            if (!id || AUTO_ID.test(id) || LEGEND_ID.test(id) || NON_MODEL_IDS.has(id)) continue;
            const geo = block.match(
                /<mxGeometry\s+x="(-?[\d.]+)"\s+y="(-?[\d.]+)"\s+width="([\d.]+)"\s+height="([\d.]+)"/
            );
            if (!geo) continue;
            page.nodes[id] = {
                x: Number(geo[1]),
                y: Number(geo[2]),
                w: Number(geo[3]),
                h: Number(geo[4]),
            };
        }
    }
    return page;
}

/**
 * Read a draw.io ERD XML file, extract per-diagram layout override information (edge routing and optionally node positions), and write the result as a JSON file.
 *
 * Command-line behavior:
 * - Accepts `--include-nodes` to include node `x,y,width,height` entries; otherwise only edge routing is extracted.
 * - Accepts optional positional arguments: first is the input path (defaults to `DEFAULT_INPUT`), second is the output path (defaults to `DEFAULT_OUTPUT`).
 *
 * Effects:
 * - Reads the input XML, parses each `<diagram id="...">...</diagram">` and collects per-page overrides.
 * - Omits pages that have neither edge nor node overrides.
 * - Writes a prettified JSON file to the output path (creating parent directories as needed).
 * - Emits a summary line to stderr with input/output paths, page count, edge count, node count, and a note when nodes were not included.
 */
function main(): void {
    const argv = process.argv.slice(2);
    const includeNodes = argv.includes("--include-nodes");
    const positional = argv.filter((a) => !a.startsWith("--"));
    const inputPath = positional[0] ? resolve(ROOT, positional[0]) : DEFAULT_INPUT;
    const outputPath = positional[1] ? resolve(ROOT, positional[1]) : DEFAULT_OUTPUT;

    const xml = readFileSync(inputPath, "utf8");
    // <diagram id="..." ...> ... </diagram> ごとに分割し、diagram id をページキーにする。
    const diagrams = [...xml.matchAll(/<diagram\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/diagram>/g)];

    const result: LayoutOverrides = { pages: {} };
    let edgeCount = 0;
    let nodeCount = 0;
    for (const dm of diagrams) {
        const id = dm[1];
        const page = extractDiagram(dm[2], includeNodes);
        edgeCount += Object.keys(page.edges).length;
        nodeCount += Object.keys(page.nodes).length;
        // override の無いページは出力しない（サイドカーを最小に保つ）。
        if (Object.keys(page.edges).length > 0 || Object.keys(page.nodes).length > 0) {
            result.pages[id] = page;
        }
    }

    const json = JSON.stringify(result, null, 2) + "\n";
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, json, "utf8");

    console.error(
        `[ERD:extract] input=${inputPath}\n[ERD:extract] output=${outputPath}\n[ERD:extract] pages=${Object.keys(result.pages).length} edges=${edgeCount} nodes=${nodeCount}${includeNodes ? "" : " (edges only; pass --include-nodes for positions)"}`
    );
}

main();
