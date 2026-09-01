/**
 * マイグレーション SQL を「本体を SSOT として」テストから実行するための共有ヘルパー。
 *
 * SQL をテスト側に写経すると、片方だけ直したときに「テストは緑だが本番の移行は
 * 壊れている」状態になる。マイグレーション本体にマーカーで**再実行可能な区間**を
 * 宣言し、テストはそこを読み出すだけにする。
 *
 * 利用者:
 * - `category-tree-migration.test.ts`（Phase A / `PHASE_A_DATA_MOVE`）
 * - `category-tree-resync.test.ts`（Phase B / `PHASE_B_RESYNC`）
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";

/**
 * Read the full SQL of the migration whose directory name ends with the given suffix.
 *
 * @param suffix - マイグレーションディレクトリ名の末尾（例: `_category_tree_phase_a`）
 * @returns migration.sql の全文
 */
export function readMigrationSql(suffix: string): string {
    const root = join(process.cwd(), "prisma", "migrations");
    const dir = readdirSync(root).find((d) => d.endsWith(suffix));
    if (!dir) {
        throw new Error(`${suffix} のマイグレーションが見つかりません`);
    }
    return readFileSync(join(root, dir, "migration.sql"), "utf-8");
}

/**
 * マーカーで囲まれた DML 区間だけを抜き出す。
 *
 * DDL を巻き込むと 2 回目の実行が `CREATE TYPE ... already exists` で落ちるため、
 * 「再実行できる区間」をマイグレーション側で明示している前提に依存している。
 *
 * @param sql - migration.sql の全文
 * @param marker - マーカー名（例: `PHASE_A_DATA_MOVE`）
 * @returns マーカーに挟まれた SQL
 */
export function extractMarkedSection(sql: string, marker: string): string {
    const startMarker = `-- >>> ${marker} >>>`;
    const endMarker = `-- <<< ${marker} <<<`;
    const start = sql.indexOf(startMarker);
    const end = sql.indexOf(endMarker);
    if (start === -1 || end === -1) {
        throw new Error(`${marker} マーカーが見つかりません`);
    }
    return sql.slice(start + startMarker.length, end);
}

/**
 * SQL を文単位に分割する。
 *
 * Prisma の `$executeRawUnsafe` は 1 呼び出し 1 文しか受け付けない。素朴に `;` で
 * split すると A-3 の `DO $PHASE_A$ ... $PHASE_A$` が内部のセミコロンで刻まれるので、
 * ドル引用符・単一引用符・行コメントを跨がない位置でだけ切る。
 */
export function splitStatements(sql: string): string[] {
    const statements: string[] = [];
    let buffer = "";
    let dollarTag: string | null = null;
    let inSingleQuote = false;
    let inLineComment = false;
    let i = 0;

    while (i < sql.length) {
        const rest = sql.slice(i);
        const char = sql[i];

        if (inLineComment) {
            buffer += char;
            if (char === "\n") inLineComment = false;
            i += 1;
            continue;
        }
        if (dollarTag !== null) {
            if (rest.startsWith(dollarTag)) {
                buffer += dollarTag;
                i += dollarTag.length;
                dollarTag = null;
                continue;
            }
            buffer += char;
            i += 1;
            continue;
        }
        if (inSingleQuote) {
            buffer += char;
            if (char === "'") inSingleQuote = false;
            i += 1;
            continue;
        }
        if (rest.startsWith("--")) {
            inLineComment = true;
            buffer += char;
            i += 1;
            continue;
        }
        if (char === "'") {
            inSingleQuote = true;
            buffer += char;
            i += 1;
            continue;
        }
        const dollarOpen = /^\$[A-Za-z_]*\$/.exec(rest);
        if (dollarOpen) {
            dollarTag = dollarOpen[0];
            buffer += dollarTag;
            i += dollarTag.length;
            continue;
        }
        if (char === ";") {
            statements.push(buffer);
            buffer = "";
            i += 1;
            continue;
        }
        buffer += char;
        i += 1;
    }
    statements.push(buffer);

    return statements
        .map((s) => s.trim())
        .filter((s) => {
            const withoutComments = s
                .split("\n")
                .filter((line) => !line.trim().startsWith("--"))
                .join("\n")
                .trim();
            return withoutComments.length > 0;
        });
}


/**
 * Run a marked migration section statement by statement.
 *
 * `$executeRawUnsafe` は 1 呼び出し 1 文しか受け付けないため分割して流す。
 *
 * @param db - テスト用 PrismaClient
 * @param statements - `splitStatements` の結果
 */
export async function runStatements(
    db: PrismaClient,
    statements: readonly string[]
): Promise<void> {
    for (const statement of statements) {
        await db.$executeRawUnsafe(statement);
    }
}
