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

/** 1 ページ分の override（ノード位置・エッジ配線）。 */
interface PageOverride {
    nodes: Record<string, NodeOverride>;
    edges: Record<string, EdgeOverride>;
}

/**
 * ページ別レイアウト override（マルチページ対応）。
 * キーは diagram id（`PAGES[].id`）。同一モデルがページ間で重複表示されるため、
 * 配置はページ単位で独立に上書きできる。
 */
interface LayoutOverrides {
    pages: Record<string, PageOverride>;
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

/**
 * Mark scalar fields that are used as foreign-key columns on their containing models.
 *
 * For each model, any field whose name appears in a relation's `fields` list will have its `isForeignKey` property set to `true`.
 *
 * @param models - Array of model definitions to update in place
 */
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
/**
 * Determines whether a value is a plain object suitable for use as a string-keyed record.
 *
 * @param v - The value to test
 * @returns `true` if `v` is an object, not `null`, and not an array; `false` otherwise.
 */
function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Determines whether a value is a finite number.
 *
 * @param v - The value to test
 * @returns `true` if `v` is a finite number, `false` otherwise.
 */
function isFiniteNumber(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v);
}

/**
 * Create a NodeOverride from an arbitrary value when it contains finite numeric `x`, `y`, `w`, or `h` properties.
 *
 * @param v - The value to parse for node override properties.
 * @returns A `NodeOverride` containing any of `x`, `y`, `w`, `h` that were finite numbers, or `null` if none were present or `v` is not a record.
 */
function parseNodeOverride(v: unknown): NodeOverride | null {
    if (!isRecord(v)) return null;
    const o: NodeOverride = {};
    if (isFiniteNumber(v.x)) o.x = v.x;
    if (isFiniteNumber(v.y)) o.y = v.y;
    if (isFiniteNumber(v.w)) o.w = v.w;
    if (isFiniteNumber(v.h)) o.h = v.h;
    return Object.keys(o).length > 0 ? o : null;
}

/**
 * Parses a raw value into an EdgeOverride when it contains valid numeric port coordinates or waypoints.
 *
 * @param v - The unknown input to validate and parse as an edge override object.
 * @returns An `EdgeOverride` containing any of `waypoints`, `exitX`, `exitY`, `entryX`, or `entryY` when those fields are valid numbers (and `waypoints` is a non-empty array of `{x,y}` points); `null` if no valid override fields are present.
 */
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
 * Normalize a raw page override object into a PageOverride, extracting valid node and edge overrides.
 *
 * Parses `nodes` and `edges` from the provided value and includes only entries that pass validation.
 *
 * @returns A PageOverride containing parsed `nodes` and `edges`. If the input is missing or malformed, returns an empty PageOverride (`{ nodes: {}, edges: {} }`).
 */
function parsePageOverride(v: unknown): PageOverride {
    const page: PageOverride = { nodes: {}, edges: {} };
    if (!isRecord(v)) return page;
    if (isRecord(v.nodes)) {
        for (const [k, nv] of Object.entries(v.nodes)) {
            const n = parseNodeOverride(nv);
            if (n) page.nodes[k] = n;
        }
    }
    if (isRecord(v.edges)) {
        for (const [k, ev] of Object.entries(v.edges)) {
            const e = parseEdgeOverride(ev);
            if (e) page.edges[k] = e;
        }
    }
    return page;
}

/**
 * Load and validate layout override definitions from the configured overrides file.
 *
 * Reads and parses the JSON at OVERRIDES_PATH and returns a `LayoutOverrides` object when it
 * conforms to the expected shape. If the file is missing, malformed, or does not match the
 * expected structure, this function returns an empty fallback (`{ pages: {} }`) so callers can
 * continue without overrides. Parse failures are reported to `console.error`.
 *
 * @returns A `LayoutOverrides` object parsed from the overrides file, or `{ pages: {} }` if no valid overrides are available.
 */
function loadLayoutOverrides(): LayoutOverrides {
    const empty: LayoutOverrides = { pages: {} };
    let raw: string;
    try {
        raw = readFileSync(OVERRIDES_PATH, "utf8");
    } catch {
        return empty; // ファイル無しは正常運用（後方互換）
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed) || !isRecord(parsed.pages)) return empty;
        const result: LayoutOverrides = { pages: {} };
        for (const [pageId, pageVal] of Object.entries(parsed.pages)) {
            result.pages[pageId] = parsePageOverride(pageVal);
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
 * Builds a stable identifier string for locating an edge's layout override.
 *
 * @param e - The edge for which to generate the override key
 * @returns A string in the form `<parent->child:identifier>`, where `identifier` is the edge's `label` if non-empty, otherwise its `relationName`
 */
function edgeOverrideKey(e: Edge): string {
    const disc = e.label && e.label.length > 0 ? e.label : e.relationName;
    return `${e.parent}->${e.child}:${disc}`;
}

// ---------------------------------------------------------------------------
// 4. ページ定義（DDD Bounded Context ごとのマルチページ構成）
// ---------------------------------------------------------------------------
// 1 つの .drawio を 8 ページへ分割し、各ページを 1 ドメインに対応させる（1 ページ ≤10 テーブル）。
// 同一モデルはページ間で重複表示される（例: User は overview/customer/cart/order/identity）。
// エッジは「両端が同一ページに存在する関係」だけを描く（生成器が edges をページ集合でフィルタ）。
// 配置は cells[model]=[gx,gy]（列・行インデックス）で宣言。x=gx*COL_PITCH、y=列内 gy 昇順の累積高さ。
// 注: 注文/決済の枠色は CASCADE 線の赤(#C62828)と紛らわしいため藍色(#283593)を使う。
type PageDetail = "full" | "name" | "enum";
interface PageDef {
    /** diagram id（サイドカーのページキー） */
    id: string;
    /** draw.io タブ名 */
    name: string;
    /** 背景コンテナ内の見出し */
    title: string;
    fill: string;
    stroke: string;
    /** full=全カラム / name=テーブル名のみ / enum=列挙型ページ */
    detail: PageDetail;
    /** 掲載モデル（enum ページは空） */
    models: string[];
    /** ページ内グリッド配置 model -> [列, 行] */
    cells: Record<string, readonly [number, number]>;
    /** リレーション線を持たない参照（注記のみ。例: CartItem/OrderItem の variantId スナップショット） */
    isolated?: string[];
}

const PAGES: PageDef[] = [
    {
        id: "overview",
        name: "1. System Overview",
        title: "System Overview",
        fill: "#ECEFF1",
        stroke: "#37474F",
        detail: "name",
        models: ["User", "Store", "Product", "Cart", "Order", "ShippingAddress"],
        cells: {
            Store: [0, 0],
            User: [0, 1],
            Product: [1, 0],
            Cart: [1, 1],
            Order: [2, 0],
            ShippingAddress: [2, 1],
        },
    },
    {
        id: "catalog",
        name: "2. Catalog",
        title: "Catalog Domain",
        fill: "#E8F5E9",
        stroke: "#2E7D32",
        detail: "full",
        models: [
            "Category",
            "SubCategory",
            "OfferTag",
            "Question",
            "Product",
            "ProductVariantImage",
            "Spec",
            "ProductVariant",
            "Color",
            "Size",
        ],
        cells: {
            SubCategory: [0, 0],
            Category: [0, 1],
            OfferTag: [0, 2],
            Question: [0, 3],
            Product: [1, 1],
            ProductVariantImage: [1, 2],
            Spec: [1, 3],
            ProductVariant: [2, 1],
            Color: [2, 2],
            Size: [3, 2],
        },
    },
    {
        id: "customer",
        name: "3. Customer Activity",
        title: "Customer Activity Domain",
        fill: "#E0F7FA",
        stroke: "#00838F",
        detail: "full",
        models: ["User", "Review", "ReviewImage", "Wishlist"],
        cells: {
            User: [0, 0],
            Review: [1, 1],
            ReviewImage: [1, 2],
            Wishlist: [2, 0],
        },
    },
    {
        id: "cart",
        name: "4. Cart",
        title: "Cart Domain",
        fill: "#F3E5F5",
        stroke: "#6A1B9A",
        detail: "full",
        models: ["User", "Cart", "CartItem", "Coupon", "ProductVariant"],
        cells: {
            User: [0, 1],
            Cart: [1, 1],
            Coupon: [2, 1],
            CartItem: [1, 2],
            ProductVariant: [1, 3],
        },
        isolated: ["ProductVariant"],
    },
    {
        id: "order",
        name: "5. Order",
        title: "Order Domain",
        fill: "#E8EAF6",
        stroke: "#283593",
        detail: "full",
        models: [
            "User",
            "OrderGroup",
            "Order",
            "OrderItem",
            "PaymentDetails",
            "ProductVariant",
        ],
        cells: {
            User: [0, 1],
            OrderGroup: [1, 0],
            Order: [1, 1],
            OrderItem: [1, 2],
            PaymentDetails: [2, 1],
            ProductVariant: [1, 3],
        },
        isolated: ["ProductVariant"],
    },
    {
        id: "shipping",
        name: "6. Shipping",
        title: "Shipping Domain",
        fill: "#FFF3E0",
        stroke: "#E65100",
        detail: "full",
        models: [
            "Order",
            "Country",
            "ShippingAddress",
            "ShippingRate",
            "FreeShipping",
            "FreeShippingCountry",
        ],
        cells: {
            Order: [0, 1],
            Country: [1, 0],
            ShippingAddress: [1, 1],
            ShippingRate: [2, 1],
            FreeShipping: [1, 2],
            FreeShippingCountry: [2, 2],
        },
    },
    {
        id: "identity",
        name: "7. Identity",
        title: "Identity Domain",
        fill: "#E3F2FD",
        stroke: "#1565C0",
        detail: "full",
        models: ["User", "Store"],
        cells: {
            User: [0, 0],
            Store: [1, 0],
        },
    },
    {
        id: "enums",
        name: "8. Enums",
        title: "Enums",
        fill: "#ECEFF1",
        stroke: "#455A64",
        detail: "enum",
        models: [],
        cells: {},
    },
];

const ENTITY_WIDTH = 240;
const ROW_HEIGHT = 17;
const HEADER_HEIGHT = 28;
const ENTITY_GAP_Y = 80; // enum 列の縦間隔
const NAME_W = 200; // name-only ボックス幅（Overview）
const NAME_H = 44; // name-only ボックス高さ
const COL_PITCH = ENTITY_WIDTH + 120; // ページ内の列ピッチ（= 360）
const ROW_GAP = 46; // ページ内・列内の縦間隔
const ORIGIN_X = 80; // ページ内エンティティ配置の原点 X
const ORIGIN_Y = 120; // ページ内エンティティ配置の原点 Y（上に見出し帯を確保）
const CONTAINER_PAD = 28; // ドメインコンテナの四辺パディング
const HEADING_BAND = 34; // コンテナ上辺に確保する見出し帯

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

/**
 * Compute the pixel height of a model's entity box for the diagram.
 *
 * @returns The total height in pixels including the header, one row per non-relation field and per composite-unique entry, plus vertical padding.
 */
function entityHeight(model: Model): number {
    const rowCount =
        model.fields.filter((f) => !f.isRelationObject).length +
        model.compositeUniques.length;
    return HEADER_HEIGHT + rowCount * ROW_HEIGHT + 8;
}

// ---------------------------------------------------------------------------
// 6. ページ描画ヘルパー（マルチページ）
// ---------------------------------------------------------------------------

interface Pos {
    x: number;
    y: number;
    w: number;
    h: number;
}

/**
 * Create an HTML label that shows only the model name (used for overview pages).
 *
 * @param model - The model whose name will be rendered
 * @returns An HTML string with the model name wrapped in a bold tag
 */
function entityNameLabel(model: Model): string {
    return `<b>${model.name}</b>`;
}

/**
 * Wraps a page's mxCell XML fragments into a <diagram> element containing an mxGraphModel.
 *
 * @param page - Page definition whose `id` and `name` are used for the diagram attributes
 * @param cells - Array of mxCell XML strings to be inserted into the diagram's root
 * @param pageWidth - Diagram page width in pixels
 * @param pageHeight - Diagram page height in pixels
 * @returns The complete `<diagram>` XML string for the given page
 */
function diagramXml(page: PageDef, cells: string[], pageWidth: number, pageHeight: number): string {
    return [
        `  <diagram id="${page.id}" name="${esc(page.name)}">`,
        `    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${pageWidth}" pageHeight="${pageHeight}" math="0" shadow="0">`,
        `      <root>`,
        `        <mxCell id="0" />`,
        `        <mxCell id="1" parent="0" />`,
        ...cells.map((c) => "        " + c),
        `      </root>`,
        `    </mxGraphModel>`,
        `  </diagram>`,
    ].join("\n");
}

/**
 * Create an mxCell XML string for the page legend box placed at the given coordinates.
 *
 * @param id - The mxCell id to assign to the legend cell
 * @param x - The left (x) position on the page in diagram units
 * @param y - The top (y) position on the page in diagram units
 * @returns The XML string for an `mxCell` representing the legend (fixed width 600 and height 135) containing HTML-formatted explanatory content
 */
function legendCell(id: string, x: number, y: number): string {
    const legend = [
        "<b>凡例 (Legend)</b>",
        "🔑 主キー (PK)　◆ 外部キー (FK)　<i>U</i> = unique　⊕ 複合ユニーク",
        "ER 記法 ─ 親側: ｜=1 / ○=任意(0..1)　／　子側: ⪪=多 (N)",
        "<font color='#C62828'><b>赤線 ⛓ = ON DELETE CASCADE</b>（親を消すと子も消える）</font>",
        "ボックスの塗り色・枠色 = ドメイン（見出しと対応）",
    ].join("<br/>");
    return `<mxCell id="${id}" value="${esc(legend)}" style="rounded=2;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=10;spacingTop=8;fillColor=#FFFDE7;strokeColor=#F9A825;strokeWidth=1.5;fontSize=12;fontColor=#10242E;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="600" height="135" as="geometry"/></mxCell>`;
}

/**
 * Create background container and heading mxCell XML strings positioned to enclose given member cells.
 *
 * Generates two cells (a rounded container and a heading band) whose geometry is computed from the bounding box of `members`; the returned `cells` are intended to be emitted before entity cells so they render behind them.
 *
 * @param page - Page metadata used for container styling and heading text (`title`, `fill`, `stroke`)
 * @param members - Array of positioned members whose x/y/w/h extents determine the container bounding box
 * @param idBox - mxCell id to use for the container cell
 * @param idHead - mxCell id to use for the heading cell
 * @returns An object containing `cells` (two mxCell XML strings: container then heading) and the computed container geometry `cx`, `cy`, `cw`, `ch` (x, y, width, height)
 */
function containerCells(
    page: PageDef,
    members: Pos[],
    idBox: string,
    idHead: string
): { cells: string[]; cx: number; cy: number; cw: number; ch: number } {
    const minX = Math.min(...members.map((p) => p.x));
    const minY = Math.min(...members.map((p) => p.y));
    const maxX = Math.max(...members.map((p) => p.x + p.w));
    const maxY = Math.max(...members.map((p) => p.y + p.h));
    const cx = Math.round(minX - CONTAINER_PAD);
    const cy = Math.round(minY - CONTAINER_PAD - HEADING_BAND);
    const cw = Math.round(maxX - minX + CONTAINER_PAD * 2);
    const ch = Math.round(maxY - minY + CONTAINER_PAD * 2 + HEADING_BAND);
    const cells = [
        `<mxCell id="${idBox}" value="" style="rounded=1;fillColor=${page.fill};opacity=20;strokeColor=${page.stroke};dashed=1;strokeWidth=1.5;verticalAlign=top;" vertex="1" parent="1"><mxGeometry x="${cx}" y="${cy}" width="${cw}" height="${ch}" as="geometry"/></mxCell>`,
        `<mxCell id="${idHead}" value="${esc(page.title)}" style="text;html=1;fontSize=16;fontStyle=1;fontColor=${page.stroke};align=left;verticalAlign=middle;" vertex="1" parent="1"><mxGeometry x="${cx + 12}" y="${cy + 6}" width="${cw - 24}" height="26" as="geometry"/></mxCell>`,
    ];
    return { cells, cx, cy, cw, ch };
}

/**
 * Build the draw.io diagram for the enums page (id = "enums").
 *
 * Generates a single-page diagram that lays out each enum vertically, includes enum values,
 * and annotates each enum with its referencing locations (e.g., "Reference: Table.field").
 * Relation edges are not drawn. Node position/size may be overridden by entries in
 * `overrides.pages[page.id].nodes`.
 *
 * @param page - Page definition for the enums page
 * @param enums - Array of enum definitions to render
 * @param enumUsage - Map from enum name to an array of "Model.field" strings that reference the enum
 * @param overrides - Layout overrides (per-page node/edge overrides) to apply when present
 * @returns The `<diagram>` XML (mxGraphModel) for the enums page as a string
 */
function buildEnumPage(page: PageDef, enums: EnumDef[], enumUsage: Map<string, string[]>, overrides: LayoutOverrides): string {
    const cells: string[] = [];
    const pageOv: PageOverride = overrides.pages[page.id] ?? { nodes: {}, edges: {} };
    let autoId = 1000;
    const nextId = () => `${page.id}_n${autoId++}`;

    const x = ORIGIN_X;
    let y = ORIGIN_Y;
    const enumCells: string[] = [];
    const members: Pos[] = [];
    for (const en of enums) {
        const ov = pageOv.nodes[en.name];
        const usage = enumUsage.get(en.name) ?? [];
        const usageLine = usage.length
            ? `<hr size="1"/>参照: <i>${esc(usage.join(", "))}</i>`
            : "";
        const label = `<b>«enum» ${en.name}</b><hr size="1"/>${en.values.join("<br/>")}${usageLine}`;
        const h = HEADER_HEIGHT + (en.values.length + (usage.length ? 1 : 0)) * ROW_HEIGHT + 8;
        const cx = ov?.x ?? x;
        const cy = ov?.y ?? y;
        const cw = ov?.w ?? ENTITY_WIDTH;
        const ch = ov?.h ?? h;
        members.push({ x: cx, y: cy, w: cw, h: ch });
        enumCells.push(
            `<mxCell id="${esc(en.name)}" value="${label
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(
                    /"/g,
                    "&quot;"
                )}" style="rounded=2;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=8;spacingTop=5;fillColor=${page.fill};strokeColor=${page.stroke};strokeWidth=1.5;fontSize=11;fontColor=#10242E;dashed=1;" vertex="1" parent="1"><mxGeometry x="${cx}" y="${cy}" width="${cw}" height="${ch}" as="geometry"/></mxCell>`
        );
        y += h + ENTITY_GAP_Y;
    }
    const cont = containerCells(page, members, nextId(), nextId());
    cells.push(...cont.cells);
    cells.push(
        `<mxCell id="${nextId()}" value="${esc(
            "リレーション線は描画しない。各 enum の「参照: Table.field」が参照元を示す。"
        )}" style="text;html=1;fontSize=11;fontColor=#546E7A;align=left;" vertex="1" parent="1"><mxGeometry x="${x}" y="${cont.cy + cont.ch + 8}" width="440" height="20" as="geometry"/></mxCell>`
    );
    cells.push(...enumCells);

    const pageWidth = Math.round(Math.max(cont.cx + cont.cw, x + 440) + 60);
    const pageHeight = Math.round(cont.cy + cont.ch + 80);
    return diagramXml(page, cells, pageWidth, pageHeight);
}

/**
 * Render a single non-enum ERD page (detail "full" or "name") into draw.io diagram XML.
 *
 * Applies optional page-specific layout overrides for node positions/sizes and edge wiring, and only includes edges whose both endpoints are present on the page.
 *
 * @param page - Page definition describing which models to place, layout grid, visual style, and isolated annotations.
 * @param ctx - Rendering context containing:
 *   - `modelById`: map of model name to parsed model metadata
 *   - `edges`: list of all relation edges between models
 *   - `enums`: parsed enum definitions (unused for non-enum pages)
 *   - `enumUsage`: map of enum name to usage locations (unused for non-enum pages)
 *   - `overrides`: layout overrides loaded from the sidecar JSON
 * @returns The generated draw.io diagram XML for the given page.
 */
function buildPage(
    page: PageDef,
    ctx: {
        modelById: Map<string, Model>;
        edges: Edge[];
        enums: EnumDef[];
        enumUsage: Map<string, string[]>;
        overrides: LayoutOverrides;
    }
): string {
    if (page.detail === "enum") {
        return buildEnumPage(page, ctx.enums, ctx.enumUsage, ctx.overrides);
    }

    const { modelById, edges, overrides } = ctx;
    const pageOv: PageOverride = overrides.pages[page.id] ?? { nodes: {}, edges: {} };
    const cells: string[] = [];
    let autoId = 1000;
    const nextId = () => `${page.id}_n${autoId++}`;

    const isName = page.detail === "name";
    const boxW = isName ? NAME_W : ENTITY_WIDTH;

    // --- 配置（cells: [gx,gy] → 列内 gy 昇順の累積高さ。可変高さでも重ならない） ---
    const pos = new Map<string, Pos>();
    const byCol = new Map<number, { name: string; gy: number }[]>();
    for (const name of page.models) {
        if (!modelById.has(name)) continue;
        const [gx, gy] = page.cells[name] ?? [0, 0];
        if (!byCol.has(gx)) byCol.set(gx, []);
        byCol.get(gx)!.push({ name, gy });
    }
    for (const [gx, list] of byCol) {
        list.sort((a, b) => a.gy - b.gy);
        let cursorY = ORIGIN_Y;
        for (const { name } of list) {
            const model = modelById.get(name)!;
            const h = isName ? NAME_H : entityHeight(model);
            pos.set(name, { x: ORIGIN_X + gx * COL_PITCH, y: cursorY, w: boxW, h });
            cursorY += h + ROW_GAP;
        }
    }
    // ノード位置 override（ページ別サイドカー）
    for (const [name, ov] of Object.entries(pageOv.nodes)) {
        const p = pos.get(name);
        if (!p) continue;
        if (ov.x !== undefined) p.x = ov.x;
        if (ov.y !== undefined) p.y = ov.y;
        if (ov.w !== undefined) p.w = ov.w;
        if (ov.h !== undefined) p.h = ov.h;
    }

    // --- 背景コンテナ＋見出し（先に push して背面化） ---
    const members = [...pos.values()];
    const cont = containerCells(page, members, nextId(), nextId());
    cells.push(...cont.cells);

    // --- エンティティ ---
    for (const name of page.models) {
        const p = pos.get(name);
        const model = modelById.get(name);
        if (!p || !model) continue;
        const label = isName ? entityNameLabel(model) : entityLabel(model);
        const align = isName ? "center" : "left";
        const valign = isName ? "middle" : "top";
        const fontSize = isName ? 13 : 11;
        cells.push(
            `<mxCell id="${esc(name)}" value="${esc(
                label
            )}" style="rounded=2;whiteSpace=wrap;html=1;align=${align};verticalAlign=${valign};spacingLeft=8;spacingTop=5;spacingRight=6;fillColor=${page.fill};strokeColor=${page.stroke};strokeWidth=1.5;fontSize=${fontSize};fontColor=#10242E;" vertex="1" parent="1"><mxGeometry x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" as="geometry"/></mxCell>`
        );
    }

    // --- 孤立モデルの注記（FK が無く線を引けない参照: variantId スナップショット等） ---
    for (const name of page.isolated ?? []) {
        const p = pos.get(name);
        if (!p) continue;
        cells.push(
            `<mxCell id="${nextId()}" value="${esc(
                "※ variantId で参照（非正規化スナップショット・FK 無し）"
            )}" style="text;html=1;fontSize=10;fontColor=#78909C;align=left;" vertex="1" parent="1"><mxGeometry x="${p.x}" y="${p.y + p.h + 4}" width="${p.w + 80}" height="18" as="geometry"/></mxCell>`
        );
    }

    // --- エッジ（両端が同一ページに存在する関係のみ） ---
    const present = new Set([...pos.keys()]);
    for (const e of edges) {
        if (!present.has(e.parent) || !present.has(e.child)) continue;
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

        // サイドカー（ページ別）の配線 override（固定ポート + 経由点）。
        const ov = pageOv.edges[edgeOverrideKey(e)];
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
        const geometry =
            ov?.waypoints && ov.waypoints.length > 0
                ? `<mxGeometry relative="1" as="geometry"><Array as="points">${ov.waypoints
                      .map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`)
                      .join("")}</Array></mxGeometry>`
                : `<mxGeometry relative="1" as="geometry"/>`;
        cells.push(
            `<mxCell id="${nextId()}" value="${esc(
                label
            )}" style="edgeStyle=entityRelationEdgeStyle;rounded=1;html=1;fontSize=10;fontColor=#10242E;labelBackgroundColor=#FFFFFF;jumpStyle=arc;jumpSize=10;${portStyleSuffix}startArrow=${startArrow};startFill=0;endArrow=${endArrow};endFill=0;strokeColor=${stroke};strokeWidth=1.4;" edge="1" parent="1" source="${esc(e.parent)}" target="${esc(e.child)}">${geometry}</mxCell>`
        );
    }

    // --- 凡例（コンテナ下） ---
    const legendY = cont.cy + cont.ch + 40;
    cells.push(legendCell(`${page.id}_legend`, cont.cx, legendY));

    const pageWidth = Math.round(Math.max(cont.cx + cont.cw, cont.cx + 600) + 80);
    const pageHeight = Math.round(legendY + 135 + 80);
    return diagramXml(page, cells, pageWidth, pageHeight);
}

// ---------------------------------------------------------------------------
// 7. メイン
/**
 * Generate a multi-page draw.io (mxGraphModel) XML from the Prisma schema and write it to the configured output file.
 *
 * Reads the schema file, parses enums and models, derives relations and foreign keys, applies optional layout overrides,
 * composes per-page diagrams, writes the combined .drawio XML to OUTPUT_PATH, and emits a compact summary and warnings to stderr.
 */
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

    // enum -> 参照箇所（Table.field）。enum ページの注記に使用。
    const enumUsage = new Map<string, string[]>();
    enums.forEach((en) => enumUsage.set(en.name, []));
    for (const model of models) {
        for (const f of model.fields) {
            if (enumUsage.has(f.baseType)) {
                enumUsage.get(f.baseType)!.push(`${model.name}.${f.name}`);
            }
        }
    }

    const ctx = { modelById, edges, enums, enumUsage, overrides };
    const diagrams = PAGES.map((page) => buildPage(page, ctx));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" type="device">
${diagrams.join("\n")}
</mxfile>
`;

    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, xml, "utf8");

    // --- サマリ出力（検証用） ---
    const nodeOvCount = Object.values(overrides.pages).reduce(
        (n, p) => n + Object.keys(p.nodes).length,
        0
    );
    const edgeOvCount = Object.values(overrides.pages).reduce(
        (n, p) => n + Object.keys(p.edges).length,
        0
    );
    console.error(
        `[ERD] pages=${PAGES.length} models=${models.length} enums=${enums.length} edges=${edges.length}`
    );
    if (nodeOvCount > 0 || edgeOvCount > 0) {
        console.error(`[ERD] layout-overrides applied: nodes=${nodeOvCount} edges=${edgeOvCount}`);
    }
    // どのページにも掲載されないモデルの検出（保険）
    const onSomePage = new Set(PAGES.flatMap((p) => p.models));
    const orphans = models.map((m) => m.name).filter((n) => !onSomePage.has(n));
    console.error(`[ERD] output: ${OUTPUT_PATH}`);
    if (orphans.length) {
        console.error(
            `[ERD] WARNING: どのページにも未掲載のモデル（PAGES に追記してください）: ${orphans.join(", ")}`
        );
    }
}

main();
