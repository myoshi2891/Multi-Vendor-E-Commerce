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
// 4. ドメイン分類とレイアウト
// ---------------------------------------------------------------------------
const DOMAINS: { title: string; models: string[]; fill: string; stroke: string }[] = [
    {
        title: "ユーザー / 店舗",
        models: ["User", "Store"],
        fill: "#E3F2FD",
        stroke: "#1565C0",
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
    },
    { title: "カート", models: ["Cart", "CartItem"], fill: "#F3E5F5", stroke: "#6A1B9A" },
    { title: "クーポン", models: ["Coupon"], fill: "#FCE4EC", stroke: "#AD1457" },
    {
        title: "注文 / 決済",
        models: ["Order", "OrderGroup", "OrderItem", "PaymentDetails"],
        fill: "#FFEBEE",
        stroke: "#C62828",
    },
    {
        title: "レビュー / ウィッシュリスト",
        models: ["Review", "ReviewImage", "Wishlist"],
        fill: "#E0F7FA",
        stroke: "#00838F",
    },
];

const ENTITY_WIDTH = 250;
const ROW_HEIGHT = 16;
const HEADER_HEIGHT = 26;
const DOMAIN_GAP_X = 300;
const ENTITY_GAP_Y = 28;
const DOMAIN_TOP_Y = 90;

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

    const modelById = new Map<string, Model>();
    models.forEach((m) => modelById.set(m.name, m));

    // --- レイアウト計算 ---
    const pos = new Map<string, { x: number; y: number; w: number; h: number }>();
    DOMAINS.forEach((domain, di) => {
        const x = 40 + di * DOMAIN_GAP_X;
        let y = DOMAIN_TOP_Y;
        for (const name of domain.models) {
            const model = modelById.get(name);
            if (!model) continue;
            const h = entityHeight(model);
            pos.set(name, { x, y, w: ENTITY_WIDTH, h });
            y += h + ENTITY_GAP_Y;
        }
    });

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
        )}" style="text;html=1;fontSize=12;fontColor=#555555;align=left;verticalAlign=middle;" vertex="1" parent="1"><mxGeometry x="40" y="52" width="1100" height="20" as="geometry"/></mxCell>`
    );

    // ドメイン背景 + ヘッダ
    DOMAINS.forEach((domain, di) => {
        const x = 40 + di * DOMAIN_GAP_X;
        const present = domain.models.filter((n) => modelById.has(n));
        if (present.length === 0) return;
        const last = present[present.length - 1];
        const lastPos = pos.get(last)!;
        const bottom = lastPos.y + lastPos.h;
        const bgId = nextId();
        cells.push(
            `<mxCell id="${bgId}" value="" style="rounded=1;fillColor=${domain.fill};strokeColor=${domain.stroke};strokeWidth=1;opacity=40;dashed=1;" vertex="1" parent="1"><mxGeometry x="${
                x - 16
            }" y="${DOMAIN_TOP_Y - 36}" width="${ENTITY_WIDTH + 32}" height="${
                bottom - (DOMAIN_TOP_Y - 36) + 16
            }" as="geometry"/></mxCell>`
        );
        cells.push(
            `<mxCell id="${nextId()}" value="${esc(domain.title)}" style="text;html=1;fontSize=14;fontStyle=1;fontColor=${domain.stroke};align=left;verticalAlign=middle;" vertex="1" parent="1"><mxGeometry x="${
                x - 8
            }" y="${DOMAIN_TOP_Y - 34}" width="${ENTITY_WIDTH}" height="24" as="geometry"/></mxCell>`
        );
    });

    // エンティティ
    const domainOf = new Map<string, (typeof DOMAINS)[number]>();
    DOMAINS.forEach((d) => d.models.forEach((n) => domainOf.set(n, d)));

    for (const model of models) {
        const p = pos.get(model.name);
        if (!p) continue;
        const d = domainOf.get(model.name);
        const fill = "#FFFFFF";
        const stroke = d ? d.stroke : "#666666";
        cells.push(
            `<mxCell id="${model.name}" value="${esc(
                entityLabel(model)
            )}" style="rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=8;spacingTop=4;spacingRight=6;fillColor=${fill};strokeColor=${stroke};strokeWidth=1.5;fontSize=11;" vertex="1" parent="1"><mxGeometry x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" as="geometry"/></mxCell>`
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
        const stroke = e.cascade ? "#C62828" : "#666666";
        const label = e.cascade ? `${e.label} ⛓` : e.label;
        cells.push(
            `<mxCell id="${nextId()}" value="${esc(
                label
            )}" style="edgeStyle=entityRelationEdgeStyle;rounded=0;html=1;fontSize=10;fontColor=#444444;startArrow=${startArrow};startFill=0;endArrow=${endArrow};endFill=0;strokeColor=${stroke};strokeWidth=1.2;" edge="1" parent="1" source="${e.parent}" target="${e.child}"><mxGeometry relative="1" as="geometry"/></mxCell>`
        );
    }

    // 列挙型（Enum）ボックス（最右列にまとめる）
    const enumX = 40 + DOMAINS.length * DOMAIN_GAP_X;
    let enumY = DOMAIN_TOP_Y;
    cells.push(
        `<mxCell id="${nextId()}" value="${esc(
            "列挙型 (Enums)"
        )}" style="text;html=1;fontSize=14;fontStyle=1;fontColor=#37474F;align=left;" vertex="1" parent="1"><mxGeometry x="${
            enumX - 8
        }" y="${DOMAIN_TOP_Y - 34}" width="${ENTITY_WIDTH}" height="24" as="geometry"/></mxCell>`
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
                )}" style="rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=8;spacingTop=4;fillColor=#ECEFF1;strokeColor=#37474F;strokeWidth=1;fontSize=11;dashed=1;" vertex="1" parent="1"><mxGeometry x="${enumX}" y="${enumY}" width="${ENTITY_WIDTH}" height="${h}" as="geometry"/></mxCell>`
        );
        enumY += h + ENTITY_GAP_Y;
    }

    // 凡例
    const legend = [
        "<b>凡例 (Legend)</b>",
        "🔑 主キー (Primary Key)",
        "◆ 外部キー (Foreign Key)",
        "• 通常カラム　　<i>U</i> = unique",
        "⊕ 複合ユニーク制約",
        "──◀ ER 記法: ｜=1, ⪪=多(N), ○=任意(0..1)",
        "<font color='#C62828'>赤線 ⛓ = ON DELETE CASCADE（親削除で子も削除）</font>",
        "破線の枠 = 機能ドメイン分類",
    ].join("<br/>");
    cells.push(
        `<mxCell id="legend" value="${esc(
            legend
        )}" style="rounded=1;whiteSpace=wrap;html=1;align=left;verticalAlign=top;spacingLeft=8;spacingTop=6;fillColor=#FFFDE7;strokeColor=#F9A825;strokeWidth=1;fontSize=11;" vertex="1" parent="1"><mxGeometry x="40" y="20" width="360" height="0" as="geometry"/></mxCell>`
    );
    // 凡例は左上のタイトルと重ならないよう最下部へ配置し直す
    const maxBottom = Math.max(
        ...[...pos.values()].map((p) => p.y + p.h),
        enumY
    );
    cells[cells.length - 1] = cells[cells.length - 1].replace(
        `<mxGeometry x="40" y="20" width="360" height="0" as="geometry"/>`,
        `<mxGeometry x="40" y="${maxBottom + 40}" width="420" height="150" as="geometry"/>`
    );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" type="device">
  <diagram id="data-model" name="Data Model">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2400" pageHeight="1800" math="0" shadow="0">
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
    console.error(`[ERD] output: ${OUTPUT_PATH}`);
    if (orphans.length) {
        console.error(
            `[ERD] WARNING: 未分類モデル（DOMAINS に追記してください）: ${orphans.join(", ")}`
        );
    }
}

main();
