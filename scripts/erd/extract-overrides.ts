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

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_INPUT = resolve(ROOT, "docs/architecture/data-model.drawio");
const DEFAULT_OUTPUT = resolve(ROOT, "scripts/erd/layout-overrides.json");

// 生成器が割り振る自動 ID（n1234）・固定の補助セル。モデルノードはこれら以外。
const AUTO_ID = /^n\d+$/;
const NON_MODEL_IDS = new Set(["0", "1", "title", "subtitle", "legend"]);

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
interface LayoutOverrides {
    nodes: Record<string, NodeOverride>;
    edges: Record<string, EdgeOverride>;
}

/** mxCell 1 個分のブロックに分割（開きタグ <mxCell から次の <mxCell 直前まで）。 */
function splitCells(xml: string): string[] {
    return xml
        .split(/(?=<mxCell\b)/)
        .filter((b) => b.startsWith("<mxCell"));
}

/** ブロックの開きタグ（最初の '>' まで）から属性を取り出す。value/style は内部に '>' を含まない前提。 */
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

/** style 文字列から数値プロパティを取り出す（無ければ undefined）。 */
function styleNumber(style: string, key: string): number | undefined {
    const m = style.match(new RegExp(`${key}=([\\d.]+)`));
    if (!m) return undefined;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : undefined;
}

/** <Array as="points"> 内の経由点を抽出（ラベルオフセット等の他 mxPoint は拾わない）。 */
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

/** エッジラベル(value)から override キーの識別子を得る。末尾の CASCADE 記号 ⛓ を除去。 */
function labelToDiscriminator(value: string): string {
    return value.replace(/\s*⛓\s*$/, "").trim();
}

function main(): void {
    const argv = process.argv.slice(2);
    const includeNodes = argv.includes("--include-nodes");
    const positional = argv.filter((a) => !a.startsWith("--"));
    const inputPath = positional[0] ? resolve(ROOT, positional[0]) : DEFAULT_INPUT;
    const outputPath = positional[1] ? resolve(ROOT, positional[1]) : DEFAULT_OUTPUT;

    const xml = readFileSync(inputPath, "utf8");
    const blocks = splitCells(xml);

    const result: LayoutOverrides = { nodes: {}, edges: {} };

    for (const block of blocks) {
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
            result.edges[key] = ov;
            continue;
        }

        // --- ノード: --include-nodes 指定時のみ、モデルノードの座標を抽出 ---
        if (includeNodes && attrs.vertex === "1") {
            const id = attrs.id ?? "";
            if (!id || AUTO_ID.test(id) || NON_MODEL_IDS.has(id)) continue;
            const geo = block.match(
                /<mxGeometry\s+x="(-?[\d.]+)"\s+y="(-?[\d.]+)"\s+width="([\d.]+)"\s+height="([\d.]+)"/
            );
            if (!geo) continue;
            result.nodes[id] = {
                x: Number(geo[1]),
                y: Number(geo[2]),
                w: Number(geo[3]),
                h: Number(geo[4]),
            };
        }
    }

    if (!includeNodes) {
        // ノードを出力しない場合でも JSON 形状は固定（nodes は空オブジェクト）。
        result.nodes = {};
    }

    const json = JSON.stringify(result, null, 2) + "\n";
    writeFileSync(outputPath, json, "utf8");

    console.error(
        `[ERD:extract] input=${inputPath}\n[ERD:extract] output=${outputPath}\n[ERD:extract] edges=${Object.keys(result.edges).length} nodes=${Object.keys(result.nodes).length}${includeNodes ? "" : " (edges only; pass --include-nodes for positions)"}`
    );
}

main();
