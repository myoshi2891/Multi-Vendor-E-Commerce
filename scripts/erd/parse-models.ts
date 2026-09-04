// ---------------------------------------------------------------------------
// Prisma スキーマのパース（純関数）
//
// CLI 本体（generate-erd.ts）から切り出してある。あちらは import.meta / ファイル書き出しを
// 伴う実行スクリプトなので、テストから import すると副作用が走る。パーサだけを独立させ、
// 記法の回帰（複数行ブロック属性など）をユニットテストで固定できるようにする。
// ---------------------------------------------------------------------------

export interface Field {
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

export interface Model {
    name: string;
    fields: Field[];
    /** `@@unique([a, b])` の複合ユニーク */
    compositeUniques: string[][];
    /** `@@id([a, b])` の複合主キー（無い場合は空配列） */
    compositeId: string[];
}

/**
 * Remove complete block attributes (`@@id(...)` / `@@unique(...)` / `@@index(...)` ...) from a model body.
 *
 * ブロック属性は `parseModels` が本体一括の正規表現で先に処理済みだが、フィールド走査は
 * 行単位なので**複数行に跨るブロック属性の継続行が残る**。継続行はフィールド行と区別が
 * つかず、`@@id([` 改行 `  a, b` 改行 `], name: "pk")` は `a,`（型 `b`）と
 * `],`（型 `name:`）という**存在しないフィールド 2 本**を図に出してしまう。
 * ここで括弧の対応を数えてブロック全体を落とし、フィールド走査へ渡す。
 *
 * **`@@` は行頭（直前の改行以降が空白だけ）のときにだけブロック属性とみなす。**
 * 位置を問わず拾うと、行コメント中の `@@index(` のような**属性ではない出現**に
 * 反応して、そこから対応する `)` まで（閉じ括弧が無ければ本体末尾まで）を丸ごと
 * 捨てる。結果は「以降のフィールドが ER 図から黙って消える」という、差分を見ても
 * 気づきにくい壊れ方になる。Prisma のブロック属性は必ず行頭に置かれるので、
 * 行頭条件を課しても正当な記法は 1 つも落ちない。
 *
 * @param body - `model X { ... }` の中身
 * @returns ブロック属性を除去した本体（行数は変わりうる）
 */
/**
 * 行コメント（`//` / `///`）を落とす。
 *
 * ブロック属性（`@@id` / `@@unique`）はモデル本体一括で走査するため、
 * コメント中の記述（例: `// @@unique([a, b]) は Phase C で追加予定`）を
 * そのままでは本物と区別できない。走査前にコメントだけ空文字へ潰す。
 * 行構造は保つ（`\n` は残す）ので、後段の行単位処理には影響しない。
 *
 * 文字列リテラル内の `//`（`@default("http://x")` 等）はコメントではないため、
 * ダブルクォートの内外を数えながら走る。
 */
function stripLineComments(body: string): string {
    return body
        .split("\n")
        .map((line) => {
            let inString = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"' && line[i - 1] !== "\\") {
                    inString = !inString;
                    continue;
                }
                if (!inString && ch === "/" && line[i + 1] === "/") {
                    return line.slice(0, i);
                }
            }
            return line;
        })
        .join("\n");
}

function stripBlockAttributes(body: string): string {
    let out = "";
    let i = 0;
    // 直前の改行（または本体先頭）以降が空白だけか
    let atLineStart = true;
    while (i < body.length) {
        if (atLineStart && body.startsWith("@@", i)) {
            // 属性名を読み飛ばし、引数の `(` を探す（`@@map("x")` / `@@id([a])` 共通）
            let j = i + 2;
            while (j < body.length && /[\w.]/.test(body[j])) j++;
            let k = j;
            while (k < body.length && /[ \t]/.test(body[k])) k++;
            if (body[k] === "(") {
                // 括弧の対応を数えて閉じ位置まで飛ばす（`@@index([a], map: "m")` も 1 span）
                let depth = 0;
                while (k < body.length) {
                    if (body[k] === "(") depth++;
                    else if (body[k] === ")") {
                        depth--;
                        if (depth === 0) {
                            k++;
                            break;
                        }
                    }
                    k++;
                }
                i = k;
                atLineStart = false;
                continue;
            }
            // 引数無しのブロック属性（将来形）: 属性名だけ落とす
            i = j;
            atLineStart = false;
            continue;
        }
        const ch = body[i];
        out += ch;
        i++;
        if (ch === "\n") atLineStart = true;
        else if (ch !== " " && ch !== "\t" && ch !== "\r") atLineStart = false;
    }
    return out;
}

export function parseModels(src: string, modelNames: Set<string>): Model[] {
    const models: Model[] = [];
    const re = /model\s+(\w+)\s*\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
        const name = m[1];
        const body = m[2];
        const fields: Field[] = [];
        const compositeUniques: string[][] = [];
        let compositeId: string[] = [];

        // ブロック属性 (@@id / @@unique) は**モデル本体全体**に対して走査する。
        // 行単位で `@@id([...])` を要求すると 2 通りの正当な記法を取りこぼす:
        //  - オプション付き: `@@id([a, b], name: "pk")` … 閉じ括弧が `]` の直後に来ない
        //  - 複数行:         `@@id([` 改行 `a,` 改行 `b` 改行 `])` … 1 行に収まらない
        // モデル本体は `[^{}]*` で切り出しており入れ子が無いため、本体一括で安全に拾える。
        // `[^\]]` は改行にも一致するので複数行形式もそのまま取れる。
        const splitFieldList = (raw: string): string[] =>
            raw
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0);

        // ただし**コメントは先に落とす**。本体一括で走査する以上、
        // `// @@unique([a, b])` のような説明・コメントアウトされた属性まで
        // 一致してしまい、実在しない複合キーが図に描かれる。
        const attributeBody = stripLineComments(body);

        for (const uq of attributeBody.matchAll(
            /@@unique\s*\(\s*\[([^\]]*)\]/g
        )) {
            compositeUniques.push(splitFieldList(uq[1]));
        }
        const pk = attributeBody.match(/@@id\s*\(\s*\[([^\]]*)\]/);
        if (pk) {
            compositeId = splitFieldList(pk[1]);
        }

        // ブロック属性は上で本体一括から取り出し済み。フィールド走査へ渡す前に
        // **ブロック全体**（複数行形式の継続行・`], name: "pk")` の閉じ行を含む）を落とす。
        // 行頭 `@@` の skip だけでは継続行が残り、偽のフィールドとして描画されてしまう。
        const fieldBody = stripBlockAttributes(body);

        for (const rawLine of fieldBody.split("\n")) {
            const line = rawLine.trim();
            if (line.length === 0) continue;
            // 行コメント（`//` と doc コメント `///`）はフィールドではない。
            // トークン化すると `//` が fieldName、次語が型として計上されてしまう。
            // 行末コメントは `rest` に残るだけなので、ここでは行頭のみ弾けばよい。
            if (line.startsWith("//")) continue;

            const tokens = line.split(/\s+/);
            if (tokens.length < 2) continue;
            const fieldName = tokens[0];
            const rawType = tokens[1];
            const rest = tokens.slice(2).join(" ");

            const isList = /\[\]/.test(rawType);
            const isOptional = /\?$/.test(rawType);
            const baseType = rawType.replace(/[[\]?]/g, "");

            // 表示型（Decimal(p,s) を反映）
            let displayType =
                baseType + (isList ? "[]" : "") + (isOptional ? "?" : "");
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
                    fields: fieldsM
                        ? fieldsM[1].split(",").map((s) => s.trim())
                        : [],
                    references: refsM
                        ? refsM[1].split(",").map((s) => s.trim())
                        : [],
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

        models.push({ name, fields, compositeUniques, compositeId });
    }
    return models;
}
