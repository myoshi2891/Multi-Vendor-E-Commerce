/**
 * ============================================================================
 *  ERD (Entity-Relationship Diagram) Generator
 * ============================================================================
 *
 * `prisma/schema.prisma`（データモデルの Single Source of Truth）をパースし、
 * draw.io / diagrams.net で開ける `.drawio`（mxGraphModel XML）を生成する。
 *
 * 【設計意図】
 *   モデル図を手書きするとスキーマと必ず乖離する。本スクリプトはスキーマを
 *   直接読み取って図を生成するため、`schema.prisma` を変更したら本スクリプトを
 *   再実行するだけで図が実態と一致する（= "変更が図に伝播する" 仕組み）。
 *
 * 【実行】
 *   bun run erd:generate
 *   （= bun run scripts/erd/generate-erd.ts）
 *
 * 【出力】
 *   docs/architecture/data-model.drawio
 *
 * 関連: specs/multi-vendor-ecommerce/03-data-model.md
 *       .claude/rules/03-data-model-diagram-sync.md
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// 0. パス定義
// ---------------------------------------------------------------------------
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SCHEMA_PATH = resolve(ROOT, "prisma/schema.prisma");
const OUTPUT_PATH = resolve(ROOT, "docs/architecture/data-model.drawio");
/** レイアウト override サイドカー（任意・存在しなくても生成は成立する） */
const OVERRIDES_PATH = resolve(ROOT, "scripts/erd/layout-overrides.json");

// ---------------------------------------------------------------------------
// 1. 型定義
// ---------------------------------------------------------------------------
interface Field {
    name: string;
    /** `[]` / `?` を除いた素の型名 */
    baseType: string;
    isList: boolean;
    isOptional: boolean;
    isId: boolean;
    isUnique: boolean;
    /** `@db.Decimal(p,s)` が付いている場合の表示型（例: "Decimal(12,2)"） */
    displayType: string;
    /** リレーションオブジェクトフィールドか（baseType が model 名） */
    isRelationObject: boolean;
    /** このフィールドが外部キースカラーか */
    isForeignKey: boolean;
    /** `@relation(...)` の中身（owning 側のみ） */
    relation?: {
        name: string;
        fields: string[];
        references: string[];
        onDelete?: string;
    };
}

interface Model {
    name: string;
    fields: Field[];
    /** `@@unique([a, b])` の複合ユニーク */
    compositeUniques: string[][];
}

interface EnumDef {
    name: string;
    values: string[];
}

type Cardinality = "1:1" | "1:N" | "N:M";

/**
 * レイアウト override サイドカー（`scripts/erd/layout-overrides.json`）の型。
 * 構造（モデル・リレーション）は `schema.prisma` が SSOT、**配置と配線**はこのファイルが SSOT。
 * draw.io で視覚調整した結果を `bun run erd:extract` で還流し、再生成時に決定論的へ再適用する。
 */
interface NodeOverride {
    x?: number;
    y?: number;
    w?: number;
    h?: number;
}

interface EdgeOverride {
    /** 経由点（draw.io の絶対座標）。線をボックスに重ねず配線するための折れ点 */
    waypoints?: { x: number; y: number }[];
    /** 接続元/接続先の固定ポート（0..1 の相対座標）。未指定なら entityRelationEdgeStyle の自動選択 */
    exitX?: number;
    exitY?: number;
    entryX?: number;
    entryY?: number;
}

interface LayoutOverrides {
    nodes: Record<string, NodeOverride>;
    edges: Record<string, EdgeOverride>;
}

interface Edge {
    parent: string; // "1" 側 / 参照される側
    child: string; // "N" 側 / FK を持つ側
    cardinality: Cardinality;
    /** 親が任意（FK が optional） */
    optionalParent: boolean;
    /** ON DELETE CASCADE か */
    cascade: boolean;
    /** エッジに表示する FK カラム名（学習用） */
    label: string;
    relationName: string;
}

// ---------------------------------------------------------------------------
// 2. スキーマのパース
// ---------------------------------------------------------------------------

/** 行頭〜の `//` コメントを除去（スキーマ内の文字列に `//` は無い前提） */
function stripComments(src: string): string {
    return src
        .split("\n")
        .map((line) => {
            const idx = line.indexOf("//");
            return idx >= 0 ? line.slice(0, idx) : line;
        })
        .join("\n");
}

function parseEnums(src: string): EnumDef[] {
    const enums: EnumDef[] = [];
    const re = /enum\s+(\w+)\s*\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
        const name = m[1];
        const values = m[2]
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && /^\w+$/.test(l));
        enums.push({ name, values });
    }
    return enums;
}

function parseModels(src: string, modelNames: Set<string>): Model[] {
    const models: Model[] = [];
    const re = /model\s+(\w+)\s*\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
        const name = m[1];
        const body = m[2];
        const fields: Field[] = [];
        const compositeUniques: string[][] = [];

        for (const rawLine of body.split("\n")) {
            const line = rawLine.trim();
            if (line.length === 0) continue;

            // ブロック属性 (@@unique / @@index / @@map ...)
            if (line.startsWith("@@")) {
                const uq = line.match(/@@unique\(\[([^\]]+)\]\)/);
                if (uq) {
                    compositeUniques.push(uq[1].split(",").map((s) => s.trim()));
                }
                continue;
            }

            const tokens = line.split(/\s+/);
            if (tokens.length < 2) continue;
            const fieldName = tokens[0];
            const rawType = tokens[1];
            const rest = tokens.slice(2).join(" ");

            const isList = /\[\]/.test(rawType);
            const isOptional = /\?$/.test(rawType);
            const baseType = rawType.replace(/[[\]?]/g, "");

            // 表示型（Decimal(p,s) を反映）
            let displayType = baseType + (isList ? "[]" : "") + (isOptional ? "?" : "");
            const dec = rest.match(/@db\.Decimal\((\d+),\s*(\d+)\)/);
            if (dec) displayType = `Decimal(${dec[1]},${dec[2]})`;

            const relMatch = rest.match(/@relation\(([^)]*)\)/);
            let relation: Field["relation"];
            if (relMatch) {
                const inner = relMatch[1];
                const nameM = inner.match(/"([^"]+)"/);
                const fieldsM = inner.match(/fields:\s*\[([^\]]+)\]/);
                const refsM = inner.match(/references:\s*\[([^\]]+)\]/);
                const onDeleteM = inner.match(/onDelete:\s*(\w+)/);
                relation = {
                    name: nameM ? nameM[1] : "",
                    fields: fieldsM ? fieldsM[1].split(",").map((s) => s.trim()) : [],
                    references: refsM ? refsM[1].split(",").map((s) => s.trim()) : [],
                    onDelete: onDeleteM ? onDeleteM[1] : undefined,
                };
            }

            fields.push({
                name: fieldName,
                baseType,
                isList,
                isOptional,
                isId: /@id\b/.test(rest),
                isUnique: /@unique\b/.test(rest),
                displayType,
                isRelationObject: modelNames.has(baseType),
                isForeignKey: false, // 後で確定
                relation,
            });
        }

        models.push({ name, fields, compositeUniques });
    }
    return models;
}

// ---------------------------------------------------------------------------
// 3. リレーション（エッジ）の導出
// ---------------------------------------------------------------------------
function buildEdges(models: Model[]): Edge[] {
    const edges: Edge[] = [];

    // relationName -> 両端の情報を収集（暗黙 M:N 判定用）
    const relMap = new Map<
        string,
        { model: string; isList: boolean; hasFields: boolean }[]
    >();

    for (const model of models) {
        for (const f of model.fields) {
            if (!f.isRelationObject || !f.relation) continue;
            const key = f.relation.name;
            if (!relMap.has(key)) relMap.set(key, []);
            relMap.get(key)!.push({
                model: model.name,
                isList: f.isList,
                hasFields: f.relation.fields.length > 0,
            });
        }
    }

    // FK 側（fields: を持つ側）からエッジを 1 本生成
    for (const model of models) {
        for (const f of model.fields) {
            if (!f.isRelationObject || !f.relation) continue;
            if (f.relation.fields.length === 0) continue; // back-reference 側はスキップ

            // FK スカラーをマーク
            const fkField = model.fields.find((x) => x.name === f.relation!.fields[0]);
            const fkUnique = fkField?.isUnique ?? false;
            const fkOptional = fkField?.isOptional ?? false;

            const cardinality: Cardinality = fkUnique ? "1:1" : "1:N";
            edges.push({
                parent: f.baseType,
                child: model.name,
                cardinality,
                optionalParent: fkOptional,
                cascade: f.relation.onDelete === "Cascade",
                label: f.relation.fields.join(", "),
                relationName: f.relation.name,
            });
        }
    }

    // 暗黙 M:N（両端 list・どちらも fields: なし）
    for (const [relName, ends] of relMap) {
        if (ends.length === 2 && ends.every((e) => e.isList && !e.hasFields)) {
            edges.push({
                parent: ends[0].model,
                child: ends[1].model,
                cardinality: "N:M",
                optionalParent: false,
                cascade: false,
                label: "join table",
                relationName: relName,
            });
        }
    }

    return edges;
}

/** 全モデルの FK スカラー集合を確定（属性表示用） */
function markForeignKeys(models: Model[]): void {
    const fkByModel = new Map<string, Set<string>>();
    for (const model of models) {
        const set = new Set<string>();
        for (const f of model.fields) {
            if (f.relation?.fields.length) {
                f.relation.fields.forEach((name) => set.add(name));
            }
        }
        fkByModel.set(model.name, set);
    }
    for (const model of models) {
        const set = fkByModel.get(model.name)!;
        for (const f of model.fields) {
            if (set.has(f.name)) f.isForeignKey = true;
        }
    }
}

// ---------------------------------------------------------------------------
// 3.5 レイアウト override サイドカーの読み込み（外部入力 = unknown + 型ガード）
// ---------------------------------------------------------------------------
function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v);
}

function parseNodeOverride(v: unknown): NodeOverride | null {
    if (!isRecord(v)) return null;
    const o: NodeOverride = {};
    if (isFiniteNumber(v.x)) o.x = v.x;
    if (isFiniteNumber(v.y)) o.y = v.y;
    if (isFiniteNumber(v.w)) o.w = v.w;
    if (isFiniteNumber(v.h)) o.h = v.h;
    return Object.keys(o).length > 0 ? o : null;
}

function parseEdgeOverride(v: unknown): EdgeOverride | null {
    if (!isRecord(v)) return null;
    const o: EdgeOverride = {};
    if (Array.isArray(v.waypoints)) {
        const pts: { x: number; y: number }[] = [];
        for (const p of v.waypoints) {
            if (isRecord(p) && isFiniteNumber(p.x) && isFiniteNumber(p.y)) {
                pts.push({ x: p.x, y: p.y });
            }
        }
        if (pts.length > 0) o.waypoints = pts;
    }
    if (isFiniteNumber(v.exitX)) o.exitX = v.exitX;
    if (isFiniteNumber(v.exitY)) o.exitY = v.exitY;
    if (isFiniteNumber(v.entryX)) o.entryX = v.entryX;
    if (isFiniteNumber(v.entryY)) o.entryY = v.entryY;
    return Object.keys(o).length > 0 ? o : null;
}

/**
 * `layout-overrides.json` を読む。ファイル欠如・パース失敗・型不一致はいずれも
 * 「override 無し」へフォールバックし、生成自体は止めない（CI 安定性を優先）。
 */
function loadLayoutOverrides(): LayoutOverrides {
    const empty: LayoutOverrides = { nodes: {}, edges: {} };
    let raw: string;
    try {
        raw = readFileSync(OVERRIDES_PATH, "utf8");
    } catch {
        return empty; // ファイル無しは正常運用（後方互換）
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) return empty;
        const result: LayoutOverrides = { nodes: {}, edges: {} };
        if (isRecord(parsed.nodes)) {
            for (const [k, v] of Object.entries(parsed.nodes)) {
                const n = parseNodeOverride(v);
                if (n) result.nodes[k] = n;
            }
        }
        if (isRecord(parsed.edges)) {
            for (const [k, v] of Object.entries(parsed.edges)) {
                const e = parseEdgeOverride(v);
                if (e) result.edges[k] = e;
            }
        }
        return result;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[ERD:loadOverrides] Failed to parse layout-overrides.json", {
            error: message,
            stack: error instanceof Error ? error.stack : undefined,
        });
        return empty;
    }
}

/**
 * エッジ override の検索キー。同一ペア間の多重辺（例: User→Store の FK と暗黙 M:N）を
 * 区別するため FK カラム名(label) を第一識別子に用いる。label が空なら relationName を使う。
 */
function edgeOverrideKey(e: Edge): string {
    const disc = e.label && e.label.length > 0 ? e.label : e.relationName;
    return `${e.parent}->${e.child}:${disc}`;
}

// ---------------------------------------------------------------------------
// 4. ドメイン分類とレイアウト
// ---------------------------------------------------------------------------
// row=0 はメイン購買フロー（左→右）、row=1 はメインフローを邪魔しないサブ機能を下段へ。
// 並びは業務フロー（User/Store → Catalog → Cart → Coupon → Order → Shipping）に沿うため、
// クロスドメインのエッジ距離が短くなり線交差が減る。
// 注: 注文/決済の枠色は CASCADE 線の赤(#C62828)と紛らわしいため藍色を使う。
const DOMAINS: {
    title: string;
    models: string[];
    fill: string;
    stroke: string;
    row: 0 | 1;
}[] = [
    {
        title: "ユーザー / 店舗",
        models: ["User", "Store"],
        fill: "#E3F2FD",
        stroke: "#1565C0",
        row: 0,
    },
    {
        title: "カタログ（商品階層）",
        models: [
            "Category",
            "SubCategory",
            "OfferTag",
            "Product",
            "ProductVariant",
            "Size",
            "Color",
            "ProductVariantImage",
            "Spec",
            "Question",
        ],
        fill: "#E8F5E9",
        stroke: "#2E7D32",
        row: 0,
    },
    {
        title: "カート",
        models: ["Cart", "CartItem"],
        fill: "#F3E5F5",
        stroke: "#6A1B9A",
        row: 0,
    },
    {
        title: "クーポン",
        models: ["Coupon"],
        fill: "#FCE4EC",
        stroke: "#AD1457",
        row: 0,
    },
    {
        title: "注文 / 決済",
        models: ["Order", "OrderGroup", "OrderItem", "PaymentDetails"],
        fill: "#E8EAF6",
        stroke: "#283593",
        row: 0,
    },
    {
        title: "配送 / 地域",
        models: [
            "Country",
            "ShippingRate",
            "FreeShipping",
            "FreeShippingCountry",
            "ShippingAddress",
        ],
        fill: "#FFF3E0",
        stroke: "#E65100",
        row: 0,
    },
    {
        title: "レビュー / ウィッシュリスト",
        models: ["Review", "ReviewImage", "Wishlist"],
        fill: "#E0F7FA",
        stroke: "#00838F",
        row: 1,
    },
];

const ENTITY_WIDTH = 240;
const ROW_HEIGHT = 17;
const HEADER_HEIGHT = 28;
const ENTITY_GAP_Y = 80; // 縦間隔（横走エッジの通り道を確保）
const SUBCOL_GAP = 90; // ドメイン内の列間隔
const DOMAIN_GAP_X = 240; // ドメイン間の間隔（クロスドメイン・エッジの通り道）
const DOMAIN_TOP_Y = 120;
const MAX_PER_COL = 6; // 1 列あたりの最大エンティティ数（超過で折り返し）
const ROW_GAP_Y = 120; // メインフロー行(row=0)とサブ機能行(row=1)の縦間隔

// ---------------------------------------------------------------------------
// 5. XML 生成ヘルパー
// ---------------------------------------------------------------------------
function esc(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** モデル -> 属性 HTML ラベル */
function entityLabel(model: Model): string {
    const rows: string[] = [];
    for (const f of model.fields) {
        if (f.isRelationObject) continue; // リレーションはエッジで表現
        let marker = "•";
        if (f.isId) marker = "🔑";
        else if (f.isForeignKey) marker = "◆";
        const uniq = f.isUnique && !f.isId ? " <i>U</i>" : "";
        rows.push(`${marker} ${f.name} : ${f.displayType}${uniq}`);
    }
    const cu = model.compositeUniques
        .map((c) => `⊕ unique(${c.join(", ")})`)
        .join("<br/>");
    const body = rows.join("<br/>") + (cu ? `<br/>${cu}` : "");
    return `<b>${model.name}</b><hr size="1"/>${body}`;
}

function entityHeight(model: Model): number {
    const rowCount =
        model.fields.filter((f) => !f.isRelationObject).length +
        model.compositeUniques.length;
    return HEADER_HEIGHT + rowCount * ROW_HEIGHT + 8;
}

// ---------------------------------------------------------------------------
// 6. メイン
// ---------------------------------------------------------------------------
function main(): void {
    const raw = readFileSync(SCHEMA_PATH, "utf8");
    const src = stripComments(raw);

    const enums = parseEnums(src);
    // model 名を先に集める（フィールドが model 参照かを判定するため）
    const modelNameMatches = [...src.matchAll(/model\s+(\w+)\s*\{/g)].map((m) => m[1]);
    const modelNames = new Set(modelNameMatches);

    const models = parseModels(src, modelNames);
    markForeignKeys(models);
    const edges = buildEdges(models);
    const overrides = loadLayoutOverrides();

    const modelById = new Map<string, Model>();
    models.forEach((m) => modelById.set(m.name, m));

    // --- レイアウト計算（ドメイン横並び＋多列折り返し、2 段ロー対応） ---
    // row=0 をメイン購買フローとして上段に左→右で配置し、row=1 を下段サブ機能行として
    // 上段の最下端 + ROW_GAP_Y の位置から再び左→右で配置する。これにより
    // Review/Wishlist 等のサブ機能が購買フローの線を横断しなくなる。
    const pos = new Map<string, { x: number; y: number; w: number; h: number }>();
    const domainMeta: {
        domain: (typeof DOMAINS)[number];
        x: number;
        topY: number;
        width: number;
    }[] = [];

    const layoutRow = (rowIndex: 0 | 1, topY: number): { cursorX: number; bottomY: number } => {
        let cursorX = 60;
        let bottomY = topY;
        for (const domain of DOMAINS) {
            if (domain.row !== rowIndex) continue;
            const present = domain.models.filter((n) => modelById.has(n));
            if (present.length === 0) continue;
            const cols = Math.ceil(present.length / MAX_PER_COL);
            const width = cols * ENTITY_WIDTH + (cols - 1) * SUBCOL_GAP;
            // 各サブ列ごとに縦方向カーソルを持つ（エンティティ高さが可変のため）
            const colY = new Array<number>(cols).fill(topY);
            present.forEach((name, i) => {
                const model = modelById.get(name);
                if (!model) return;
                const c = Math.floor(i / MAX_PER_COL);
                const h = entityHeight(model);
                pos.set(name, {
                    x: cursorX + c * (ENTITY_WIDTH + SUBCOL_GAP),
                    y: colY[c],
                    w: ENTITY_WIDTH,
                    h,
                });
                colY[c] += h + ENTITY_GAP_Y;
            });
            bottomY = Math.max(bottomY, ...colY);
            domainMeta.push({ domain, x: cursorX, topY, width });
            cursorX += width + DOMAIN_GAP_X;
        }
        return { cursorX, bottomY };
    };

    const row0 = layoutRow(0, DOMAIN_TOP_Y);
    const row1 = layoutRow(1, row0.bottomY + ROW_GAP_Y);
    const canvasRight = Math.max(row0.cursorX, row1.cursorX); // enum 列の開始 x

    // --- ノード位置 override の適用（サイドカー = レイアウト SSOT） ---
    // 自動配置で重なる/見づらいエンティティを手調整した結果を再適用する。
    // ページ寸法は後段で pos の実寸から再計算されるため、override 後の座標に追従する。
    for (const [name, ov] of Object.entries(overrides.nodes)) {
        const p = pos.get(name);
        if (!p) continue; // スキーマから消えたモデルの override は無視
        if (ov.x !== undefined) p.x = ov.x;
        if (ov.y !== undefined) p.y = ov.y;
        if (ov.w !== undefined) p.w = ov.w;
        if (ov.h !== undefined) p.h = ov.h;
    }

    // 分類漏れモデルの検出（スキーマに新モデルが増えた場合の保険）
    const classified = new Set(DOMAINS.flatMap((d) => d.models));
    const orphans = models.map((m) => m.name).filter((n) => !classified.has(n));

    // --- XML 構築 ---
    const cells: string[] = [];
    let autoId = 1000;
    const nextId = () => `n${autoId++}`;

    // タイトル
    cells.push(
        `<mxCell id="title" value="${esc(
            "Multi-Vendor E-Commerce — データモデル (ER 図)"
        )}" style="text;html=1;fontSize=22;fontStyle=1;align=left;verticalAlign=middle;" vertex="1" parent="1"><mxGeometry x="40" y="20" width="900" height="30" as="geometry"/></mxCell>`
    );
    cells.push(
        `<mxCell id="subtitle" value="${esc(
            "自動生成: prisma/schema.prisma が SSOT。スキーマ変更後は『bun run erd:generate』で再生成すること。"
        )}" style="text;html=1;fontSize=12;fontColor=#37474F;align=left;verticalAlign=middle;" vertex="1" parent="1"><mxGeometry x="40" y="52" width="1100" height="20" as="geometry"/></mxCell>`
    );

    // ドメインタイトル（半透明背景帯は廃止し、文字の視認性を優先）
    for (const meta of domainMeta) {
        cells.push(
            `<mxCell id="${nextId()}" value="${esc(
                meta.domain.title
            )}" style="text;html=1;fontSize=15;fontStyle=1;fontColor=${meta.domain.stroke};align=left;verticalAlign=middle;" vertex="1" parent="1"><mxGeometry x="${meta.x}" y="${meta.topY - 38}" width="${meta.width}" height="26" as="geometry"/></mxCell>`
        );
    }

    // エンティティ
    const domainOf = new Map<string, (typeof DOMAINS)[number]>();
    DOMAINS.forEach((d) => d.models.forEach((n) => domainOf.set(n, d)));

    for (const model of models) {
        const p = pos.get(model.name);
        if (!p) continue;
        const d = domainOf.get(model.name);
        const fill = d ? d.fill : "#FFFFFF"; // ドメイン色で淡く塗りグルーピングを明示
        const stroke = d ? d.stroke : "#455A64";
        cells.push(
            `<mxCell id="${model.name}" value="${esc(
                entityLabel(model)
            )}" style="rounded=2;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=8;spacingTop=5;spacingRight=6;fillColor=${fill};strokeColor=${stroke};strokeWidth=1.5;fontSize=11;fontColor=#10242E;" vertex="1" parent="1"><mxGeometry x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" as="geometry"/></mxCell>`
        );
    }

    // エッジ
    for (const e of edges) {
        if (!pos.has(e.parent) || !pos.has(e.child)) continue;
        let startArrow: string;
        let endArrow: string;
        if (e.cardinality === "N:M") {
            startArrow = "ERmany";
            endArrow = "ERmany";
        } else if (e.cardinality === "1:1") {
            startArrow = e.optionalParent ? "ERzeroToOne" : "ERone";
            endArrow = "ERone";
        } else {
            // 1:N
            startArrow = e.optionalParent ? "ERzeroToOne" : "ERone";
            endArrow = "ERmany";
        }
        const stroke = e.cascade ? "#C62828" : "#5B6B7B";
        const label = e.cascade ? `${e.label} ⛓` : e.label;

        // サイドカーの配線 override（固定ポート + 経由点）を引く。
        const ov = overrides.edges[edgeOverrideKey(e)];
        // 固定ポートが指定された場合のみ exit/entry を付与（未指定は entityRelationEdgeStyle の自動選択に委ねる）。
        const portStyle = ov
            ? [
                  ov.exitX !== undefined ? `exitX=${ov.exitX}` : "",
                  ov.exitY !== undefined ? `exitY=${ov.exitY}` : "",
                  ov.exitX !== undefined || ov.exitY !== undefined ? "exitDx=0;exitDy=0" : "",
                  ov.entryX !== undefined ? `entryX=${ov.entryX}` : "",
                  ov.entryY !== undefined ? `entryY=${ov.entryY}` : "",
                  ov.entryX !== undefined || ov.entryY !== undefined ? "entryDx=0;entryDy=0" : "",
              ]
                  .filter((s) => s.length > 0)
                  .join(";")
            : "";
        const portStyleSuffix = portStyle ? portStyle + ";" : "";
        // 経由点（waypoints）があれば <mxGeometry> 内に <Array as="points"> を埋め込む。
        const geometry =
            ov?.waypoints && ov.waypoints.length > 0
                ? `<mxGeometry relative="1" as="geometry"><Array as="points">${ov.waypoints
                      .map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`)
                      .join("")}</Array></mxGeometry>`
                : `<mxGeometry relative="1" as="geometry"/>`;
        // entityRelationEdgeStyle = エンティティ左右からの ER 配線。
        // jumpStyle=arc で交差線を「飛び越え」表示し重なりを判別可能にする。
        // labelBackgroundColor で線上のラベルを白背景化して可読性を確保。
        cells.push(
            `<mxCell id="${nextId()}" value="${esc(
                label
            )}" style="edgeStyle=entityRelationEdgeStyle;rounded=1;html=1;fontSize=10;fontColor=#10242E;labelBackgroundColor=#FFFFFF;jumpStyle=arc;jumpSize=10;${portStyleSuffix}startArrow=${startArrow};startFill=0;endArrow=${endArrow};endFill=0;strokeColor=${stroke};strokeWidth=1.4;" edge="1" parent="1" source="${e.parent}" target="${e.child}">${geometry}</mxCell>`
        );
    }

    // 列挙型（Enum）ボックス（最右列にまとめる）
    const enumX = canvasRight;
    let enumY = DOMAIN_TOP_Y;
    cells.push(
        `<mxCell id="${nextId()}" value="${esc(
            "列挙型 (Enums)"
        )}" style="text;html=1;fontSize=15;fontStyle=1;fontColor=#37474F;align=left;" vertex="1" parent="1"><mxGeometry x="${enumX}" y="${DOMAIN_TOP_Y - 38}" width="${ENTITY_WIDTH}" height="26" as="geometry"/></mxCell>`
    );
    // enum -> 使用箇所
    const enumUsage = new Map<string, string[]>();
    enums.forEach((en) => enumUsage.set(en.name, []));
    for (const model of models) {
        for (const f of model.fields) {
            if (enumUsage.has(f.baseType)) {
                enumUsage.get(f.baseType)!.push(`${model.name}.${f.name}`);
            }
        }
    }
    for (const en of enums) {
        const usage = enumUsage.get(en.name) ?? [];
        const usageLine = usage.length
            ? `<hr size="1"/><i>${esc(usage.join(", "))}</i>`
            : "";
        const label = `<b>«enum» ${en.name}</b><hr size="1"/>${en.values.join("<br/>")}${usageLine}`;
        const h = HEADER_HEIGHT + (en.values.length + (usage.length ? 1 : 0)) * ROW_HEIGHT + 8;
        cells.push(
            `<mxCell id="${nextId()}" value="${label
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(
                    /"/g,
                    "&quot;"
                )}" style="rounded=2;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=8;spacingTop=5;fillColor=#ECEFF1;strokeColor=#455A64;strokeWidth=1.5;fontSize=11;fontColor=#10242E;dashed=1;" vertex="1" parent="1"><mxGeometry x="${enumX}" y="${enumY}" width="${ENTITY_WIDTH}" height="${h}" as="geometry"/></mxCell>`
        );
        enumY += h + ENTITY_GAP_Y;
    }

    // 凡例（最下部に配置）
    const legend = [
        "<b>凡例 (Legend)</b>",
        "🔑 主キー (PK)　◆ 外部キー (FK)　<i>U</i> = unique　⊕ 複合ユニーク",
        "ER 記法 ─ 親側: ｜=1 / ○=任意(0..1)　／　子側: ⪪=多 (N)",
        "<font color='#C62828'><b>赤線 ⛓ = ON DELETE CASCADE</b>（親を消すと子も消える）</font>",
        "エンティティの塗り色・枠色 = 機能ドメイン（タイトルの色と対応）",
    ].join("<br/>");
    // エンティティ・enum 列の最下端（凡例配置の基準）
    const contentBottom = Math.max(
        ...[...pos.values()].map((p) => p.y + p.h),
        enumY
    );
    // 凡例ボックスの寸法・配置（下端基準 + 余白 50px）
    const LEGEND_X = 60;
    const LEGEND_Y = contentBottom + 50;
    const LEGEND_WIDTH = 600;
    const LEGEND_HEIGHT = 135;
    cells.push(
        `<mxCell id="legend" value="${esc(
            legend
        )}" style="rounded=2;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=10;spacingTop=8;fillColor=#FFFDE7;strokeColor=#F9A825;strokeWidth=1.5;fontSize=12;fontColor=#10242E;" vertex="1" parent="1"><mxGeometry x="${LEGEND_X}" y="${LEGEND_Y}" width="${LEGEND_WIDTH}" height="${LEGEND_HEIGHT}" as="geometry"/></mxCell>`
    );

    // ページ寸法をコンテンツ実寸から算出（ハードコード値ではオーバーフローするため）。
    // 右端: エンティティ列 / enum 列 / 凡例 の最大 x、下端: 凡例下端を採用し、PADDING で余白を確保。
    const PADDING = 80;
    const maxRight = Math.max(
        ...[...pos.values()].map((p) => p.x + p.w),
        enumX + ENTITY_WIDTH,
        LEGEND_X + LEGEND_WIDTH
    );
    const maxBottom = LEGEND_Y + LEGEND_HEIGHT;
    const pageWidth = Math.max(1200, Math.round(maxRight + PADDING));
    const pageHeight = Math.max(800, Math.round(maxBottom + PADDING));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" type="device">
  <diagram id="data-model" name="Data Model">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${pageWidth}" pageHeight="${pageHeight}" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
${cells.map((c) => "        " + c).join("\n")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;

    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, xml, "utf8");

    // --- サマリ出力（検証用） ---
    console.error(`[ERD] models=${models.length} enums=${enums.length} edges=${edges.length}`);
    const nodeOvCount = Object.keys(overrides.nodes).length;
    const edgeOvCount = Object.keys(overrides.edges).length;
    if (nodeOvCount > 0 || edgeOvCount > 0) {
        console.error(`[ERD] layout-overrides applied: nodes=${nodeOvCount} edges=${edgeOvCount}`);
    }
    console.error(`[ERD] output: ${OUTPUT_PATH}`);
    if (orphans.length) {
        console.error(
            `[ERD] WARNING: 未分類モデル（DOMAINS に追記してください）: ${orphans.join(", ")}`
        );
    }
}

main();
