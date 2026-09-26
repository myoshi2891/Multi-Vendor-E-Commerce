/**
 * カテゴリ別属性定義の**純粋な**ヘルパー（plan 069 / design.md §3「継承」）。
 *
 * `"use client"` の商品フォームからも import されるため、`@/lib/db` に依存しないこと
 * （`category-path.ts` と同じ理由 —— Prisma クライアントがクライアントバンドルへ入る）。
 */
import type { AttributeScope, AttributeType } from "@prisma/client";

/**
 * `Category.path` から祖先パス集合（自ノードを含む・浅い順）を作る。
 *
 * @example ancestorPathsOf("electronics/camera") → ["electronics", "electronics/camera"]
 */
export const ancestorPathsOf = (path: string): string[] =>
    path.split("/").map((_, i, segments) => segments.slice(0, i + 1).join("/"));

/** 解決規則が読む最小の形。 */
export interface ResolvableDefinition {
    key: string;
    category: { path: string };
}

/**
 * 継承チェーン上の同一 `key` を解決する: **最も深いノードの定義が勝つ**（design.md §3）。
 *
 * 読み取り・書き込み検証・Zod 生成のすべてがこの関数を通すこと（規則を 1 箇所に閉じる）。
 * 同じ深さに同じ `key` が並ぶことは部分 UNIQUE（ノード内のアクティブ行で一意）と
 * 「祖先パス上の各深さにノードは 1 つ」から起こらない。
 *
 * @returns 入力順を保った、`key` ごとに 1 件へ畳んだ配列
 */
export const resolveEffectiveDefinitions = <T extends ResolvableDefinition>(
    defs: readonly T[]
): T[] => {
    const winners = new Map<string, T>();
    for (const def of defs) {
        const current = winners.get(def.key);
        if (
            !current ||
            def.category.path.length > current.category.path.length
        ) {
            winners.set(def.key, def);
        }
    }
    const winnerSet = new Set(winners.values());
    return defs.filter((def) => winnerSet.has(def));
};

/** フォーム・表示が消費する属性定義 DTO（`getEffectiveAttributeDefinitions` の戻り値）。 */
export interface AttributeDefinitionDTO {
    id: string;
    key: string;
    name: string;
    type: AttributeType;
    scope: AttributeScope;
    unit: string | null;
    required: boolean;
    multiValued: boolean;
    options: AttributeOptionDTO[];
}

export interface AttributeOptionDTO {
    id: string;
    value: string;
    label: string;
}

/** 商品フォームの属性値 1 件（フォーム state / 初期値 / 送信 payload の共通形）。 */
export type AttributeFormValue = string | boolean | string[] | null;

/** キーは definitionId。 */
export type AttributeFormValues = Record<string, AttributeFormValue>;

/** バリアント編集対象の現在値に含まれるアーカイブ済み選択肢（A-11: レコード単位）。 */
export type ArchivedCurrentOptions = Record<string, AttributeOptionDTO[]>;
