/**
 * 基底seeder: Country, User, Category（ツリー）, SubCategory, OfferTag
 * 依存関係のない独立エンティティを投入する
 */

import { PrismaClient } from "@prisma/client";
import { SEED_COUNTRIES } from "../constants/countries";
import { SEED_USERS } from "../constants/users";
import { SEED_CATEGORIES } from "../constants/categories";
import { SEED_OFFER_TAGS } from "../constants/offer-tags";
import type { SeedMaps } from "../types";

export type BaseSeedResult = Pick<
    SeedMaps,
    "countries" | "users" | "categories" | "offerTags"
>;

/**
 * Seed base entities (countries, users, the category tree, and offer tags) and return maps of their record IDs.
 *
 * カテゴリは親→子の順に投入し、`path` / `depth` / `childCount` を計算して埋める。
 * Phase A では Product が旧 FK（`subCategoryId`）を必須で持つため、depth 1 のノードは
 * **同じ id を持つ legacy SubCategory 行**としても書き込む。id を共有させておくと、
 * マイグレーション A-3 が `s.id` を流用しているのと同じ状態になり、シード済み DB と
 * 移行済み DB が一致する。
 *
 * @returns An object with maps that associate canonical identifiers to record IDs:
 * - `countries`: country code -> country id
 * - `users`: user email -> user id
 * - `categories`: category URL -> category id（ルート・子を区別せず全ノード）
 * - `offerTags`: offer tag URL -> offer tag id
 *
 * @throws Error if a category references a `parentUrl` that does not exist, or if the tree is deeper than Phase A can mirror into the legacy SubCategory table.
 */
export async function seedBase(prisma: PrismaClient): Promise<BaseSeedResult> {
    // Country（並列化）
    const countryRecords = await Promise.all(
        SEED_COUNTRIES.map((c) =>
            prisma.country.upsert({
                where: { code: c.code },
                update: { name: c.name },
                create: { name: c.name, code: c.code },
            })
        )
    );
    const countries = new Map(
        SEED_COUNTRIES.map((c, i) => [c.code, countryRecords[i].id])
    );

    // User（並列化）
    const userRecords = await Promise.all(
        SEED_USERS.map((u) =>
            prisma.user.upsert({
                where: { email: u.email },
                update: { name: u.name, picture: u.picture, role: u.role },
                create: {
                    name: u.name,
                    email: u.email,
                    picture: u.picture,
                    role: u.role,
                },
            })
        )
    );
    const users = new Map(
        SEED_USERS.map((u, i) => [u.email, userRecords[i].id])
    );

    // Category ツリー（親→子の順に逐次投入する）
    //
    // 親が先に無いと path も parentId も決まらないので、depth 順に並べ替えてから回す。
    // 並列化しないのはそのため（ノードは O(10) 件で、並列化の利得より順序の保証が重要）。
    const depthOf = (url: string, seen = new Set<string>()): number => {
        const node = SEED_CATEGORIES.find((c) => c.url === url);
        if (!node) throw new Error(`カテゴリが見つかりません: ${url}`);
        if (!node.parentUrl) return 0;
        if (seen.has(url))
            throw new Error(`カテゴリツリーが循環しています: ${url}`);
        seen.add(url);
        return depthOf(node.parentUrl, seen) + 1;
    };

    const ordered = [...SEED_CATEGORIES].sort(
        (a, b) => depthOf(a.url) - depthOf(b.url)
    );

    const categories = new Map<string, string>();
    const paths = new Map<string, string>();

    for (const cat of ordered) {
        const depth = depthOf(cat.url);
        if (depth > 1) {
            // Phase A の Product は subCategoryId（= ルート直下のみ表現できる）が必須なので、
            // depth 2 以上のリーフは legacy FK に落とせない。黙って壊れるより先に落とす。
            throw new Error(
                `Phase A では depth 1 までしか投入できません: ${cat.url}（depth ${depth}）`
            );
        }

        let parentId: string | null = null;
        let path = cat.url;
        if (cat.parentUrl) {
            const resolvedParentId = categories.get(cat.parentUrl);
            const parentPath = paths.get(cat.parentUrl);
            if (!resolvedParentId || !parentPath) {
                throw new Error(
                    `親カテゴリが見つかりません: ${cat.parentUrl}（カテゴリ: ${cat.name}）`
                );
            }
            parentId = resolvedParentId;
            path = `${parentPath}/${cat.url}`;
        }

        const record = await prisma.category.upsert({
            where: { url: cat.url },
            update: {
                name: cat.name,
                image: cat.image,
                featured: cat.featured,
                parentId,
                path,
                depth,
            },
            create: {
                name: cat.name,
                url: cat.url,
                image: cat.image,
                featured: cat.featured,
                parentId,
                path,
                depth,
            },
        });
        categories.set(cat.url, record.id);
        paths.set(cat.url, path);

        // legacy SubCategory ミラー（Phase C = plan 068 で削除する）。
        // Category ノードと id を共有させるのが要点。
        if (cat.parentUrl && parentId) {
            await prisma.subCategory.upsert({
                where: { url: cat.url },
                update: {
                    name: cat.name,
                    image: cat.image,
                    featured: cat.featured,
                    categoryId: parentId,
                },
                create: {
                    id: record.id,
                    name: cat.name,
                    url: cat.url,
                    image: cat.image,
                    featured: cat.featured,
                    categoryId: parentId,
                },
            });
        }
    }

    // childCount は非正規化列なので、投入のたびに宣言データから再計算して合わせる
    for (const cat of SEED_CATEGORIES) {
        const childCount = SEED_CATEGORIES.filter(
            (c) => c.parentUrl === cat.url
        ).length;
        await prisma.category.update({
            where: { url: cat.url },
            data: { childCount },
        });
    }

    // OfferTag（並列化）
    const offerTagRecords = await Promise.all(
        SEED_OFFER_TAGS.map((tag) =>
            prisma.offerTag.upsert({
                where: { url: tag.url },
                update: { name: tag.name },
                create: { name: tag.name, url: tag.url },
            })
        )
    );
    const offerTags = new Map(
        SEED_OFFER_TAGS.map((tag, i) => [tag.url, offerTagRecords[i].id])
    );

    return { countries, users, categories, offerTags };
}
