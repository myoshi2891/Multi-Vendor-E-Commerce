"use server";

// 認可ガード (src/lib/auth-guards.ts) を経由してロール検証を集約する
import { requireAdmin } from "@/lib/auth-guards";

// DB
import { db } from "@/lib/db";

// Prisma model
import { Category, CategoryAliasSource, Prisma } from "@prisma/client";

// カテゴリツリー（materialized path）の共通ヘルパー
import {
    buildCategoryTree,
    depthOfPath,
    isWithinSubtree,
    rebasePath,
    MAX_CATEGORY_DEPTH,
} from "@/lib/category-tree";

// カテゴリツリー（plan 066–068）の入力型。
// Prisma のモデル型は DB default の有無に関わらず全スカラーを必須プロパティにするため、
// `Category` をそのまま引数にすると列を 1 つ足すたびにフォーム側のリテラルが壊れる。
//
// `path` / `depth` / `childCount` は**ツリーから導出される値**なので入力から受け取らない
// （親と url が決まれば一意に決まり、外から与えられると不変条件が壊れる）。
// 逆に `parentId` / `sortOrder` は **admin が編集する列**なので受け取る（plan 068）。
// 既存の呼び出し側を壊さないよう、この 2 つは任意プロパティにしてある。
type CategoryUpsertInput = Omit<
    Category,
    "parentId" | "path" | "depth" | "sortOrder" | "childCount"
> & {
    parentId?: string | null;
    sortOrder?: number;
};

// ツリーから導出される列。admin フォームからは書かせず、ここで計算して補う。
const DERIVED_TREE_FIELDS = ["path", "depth", "childCount"] as const;

// db.$transaction のコールバックが受け取る tx の型（Accelerate 拡張済みクライアント）。
// 素の Prisma.TransactionClient とは非互換のため、$transaction から導出する
// （`order.ts` の OrderTransactionClient と同じ理由・同じ形）。
type CategoryTransactionClient = Parameters<
    Parameters<typeof db.$transaction>[0]
>[0];

/** `SELECT … FOR UPDATE` で読むノードの最小形。 */
interface LockedCategoryNode {
    id: string;
    path: string;
    depth: number;
}

/** ロック取得後に読み直す「対象ノードの現在の姿」。 */
interface CurrentCategoryNode {
    id: string;
    parentId: string | null;
    path: string;
    depth: number;
    url: string;
}

/**
 * 導出列を実行時に落とす。
 *
 * `CategoryUpsertInput` の `Omit` はコンパイル時にしか効かない —— 余剰プロパティ検査は
 * オブジェクトリテラルにしか働かないため、DB から読み戻した `Category` をそのまま渡す
 * 経路は型検査を通過し、`path` / `depth` / `childCount` が Prisma まで素通りしてツリーの
 * 不変条件を壊す。境界で実際に捨てておく。
 */
const stripDerivedTreeFields = (
    category: CategoryUpsertInput
): CategoryUpsertInput => {
    const sanitized: Record<string, unknown> = { ...category };
    for (const field of DERIVED_TREE_FIELDS) {
        delete sanitized[field];
    }
    return sanitized as CategoryUpsertInput;
};

/**
 * ロック集合が安定するまでの読み直し上限。
 *
 * 通常は 2 周（掴む → 掴んだ状態で読み直して変化なし）で収束する。並行編集で
 * 対象が動き続けた場合に無限ループへ落ちないための上限であり、超過は失敗として扱う
 * （中途半端な path を書くより、admin にリトライさせるほうが安全）。
 */
const MAX_LOCK_CONVERGENCE_ATTEMPTS = 4;

const CONCURRENT_TREE_EDIT_MESSAGE =
    "The category tree is being modified concurrently. Please retry.";

/** ロケール非依存（UTF-16 コード単位順）の id 比較。詳細は `orderedLockTargets` の注記。 */
const compareIds = (a: string, b: string): number => {
    if (a < b) return -1;
    return a > b ? 1 : 0;
};

/**
 * ロック対象の親 id を**重複排除して決定論的な順序に並べる**。
 *
 * 比較は **`localeCompare` ではなく素の `<` / `>`**（UTF-16 コード単位順）で行う。
 * localeCompare の順序は ICU のロケール・照合設定に依存するため、環境が違う 2 つの
 * プロセスが**別々の順序**を導き、順序固定という前提そのものが崩れうる。ここで欲しいのは
 * 人間向けの読みやすさではなく「どこで実行しても同一」であることなので、
 * コード単位順が正しい選択である。
 *
 * 順序を固定しないと相互デッドロックになる —— 旧親 A・新親 B を掴む再親子化と、
 * 旧親 B・新親 A を掴む再親子化が並行したとき、それぞれ片方を持って他方を待つ。
 * id 昇順は「どのトランザクションから見ても同じ」唯一の基準である。
 */
const orderedLockTargets = (ids: readonly (string | null)[]): string[] =>
    [...new Set(ids.filter((id): id is string => !!id))].sort(compareIds);

/**
 * 指定ノードを `FOR UPDATE` で掴む（`orderedLockTargets` の順に 1 行ずつ）。
 *
 * `WHERE id = ANY(...)` の 1 クエリにまとめないのは、複数行を返すクエリの
 * **ロック取得順がプランに依存する**ため。順序の保証は本ヘルパーの存在意義そのもの
 * なので、実行計画に委ねずループで明示する（admin 操作なので往復増は許容範囲）。
 */
const lockCategoryNodesForUpdate = async (
    tx: CategoryTransactionClient,
    orderedIds: readonly string[]
): Promise<LockedCategoryNode[]> => {
    const locked: LockedCategoryNode[] = [];
    for (const id of orderedIds) {
        // Prisma の fluent API はロック句を表現できないため $queryRaw を使う
        // （値は常にパラメータ化される）。
        const rows = await tx.$queryRaw<LockedCategoryNode[]>`
            SELECT "id", "path", "depth" FROM "Category" WHERE "id" = ${id} FOR UPDATE
        `;
        const row = rows[0];
        if (row) locked.push(row);
    }
    return locked;
};

/**
 * subtree（`rootPath` の子孫。自ノードは含まない）を `FOR UPDATE` で掴んでから読む。
 *
 * **非ロック読みのままにしてはならない。** 子孫の path 追随は read-modify-write で、
 * READ COMMITTED では「読んだ後・書く前」に並行トランザクションが子孫を subtree の
 * **外へ**動かせる。すると本トランザクションは、既に別の親に付け替わった行へ
 * 「自分の subtree 配下」の path を書き戻し、`path` と `parentId` が矛盾する。
 * 導出列である path はこの矛盾から自力復帰できない。
 *
 * 収束の根拠: 掴んだ後にもう一度数え直し、新しい id が出なくなるまで繰り返す。
 * 子孫を動かす側は自ノード行を、子を足す側は親行を掴むので（`upsertCategory` の
 * ロック集合）、一度全子孫を掴めば新規の出入りは起きない。
 * それでも収束しない場合は無限ループでトランザクションを溶かすより明示的に失敗させる。
 */
const lockDescendantsForUpdate = async (
    tx: CategoryTransactionClient,
    rootPath: string
): Promise<{ id: string; path: string }[]> => {
    const locked = new Set<string>();
    for (let attempt = 0; attempt < MAX_LOCK_CONVERGENCE_ATTEMPTS; attempt++) {
        const descendants = await tx.category.findMany({
            where: { path: { startsWith: `${rootPath}/` } },
            select: { id: true, path: true },
        });
        const ids = orderedLockTargets(descendants.map((node) => node.id));
        // 新しく掴むものが無い = 前回のロック以降に subtree が変わっていない
        if (ids.every((id) => locked.has(id))) return descendants;
        await lockCategoryNodesForUpdate(tx, ids);
        for (const id of ids) locked.add(id);
    }
    throw new Error(CONCURRENT_TREE_EDIT_MESSAGE);
};

/**
 * 指定した親ノードの `childCount` を実数から再計算する。
 *
 * **片側だけ増減させないこと。** 再親子化は旧親と新親の両方を動かすため、片方だけ
 * 更新すると「子がいないのに `childCount > 0`」が残り、リーフ強制（V-5）が正当な
 * リーフへの商品紐づけを拒否しはじめる。
 *
 * **count → update の間に行ロックが要る。** これは read-modify-write であり、
 * READ COMMITTED では並行トランザクションの未コミットな付け替えが `count` から
 * 見えない。両者が同じ親を触ると「古い数を数え、後勝ちで書く」lost update になり、
 * `childCount` が実数からドリフトする。`childCount` は 068 でリーフ強制の判定材料に
 * なったため、ドリフトすると**その親には二度と商品を紐づけられない**（導出列なので
 * admin フォームからは復旧できない）。親行を先に `FOR UPDATE` で掴んで直列化する。
 */
const recomputeChildCounts = async (
    tx: CategoryTransactionClient,
    parentIds: readonly (string | null)[]
): Promise<void> => {
    const targets = orderedLockTargets(parentIds);
    // 呼び出し側が既に同じ行を同じ順序で掴んでいる場合、この再取得は待ちを生まない。
    await lockCategoryNodesForUpdate(tx, targets);
    for (const id of targets) {
        const childCount = await tx.category.count({ where: { parentId: id } });
        await tx.category.update({ where: { id }, data: { childCount } });
    }
};

// Function: upsertCategory
// Description: Upserts a category into the database, updating if it exists or creating a new one if not.
//              Derives `path` / `depth` from the parent node, rejects cycles and over-deep trees,
//              rebases all descendants when a node is re-parented, and recomputes `childCount`
//              on both the old and the new parent.
// Permission Level: Admin only
// Parameters:
//   - category: Category object containing details of the category to be upserted.
// Returns: Updated or newly created category details.

/**
 * 同名 / 同 URL の別カテゴリが既に居ないことを確かめる。
 *
 * 自分自身は `NOT id` で除外する（更新時に自分とぶつかって常に失敗するのを防ぐ）。
 */
const assertCategoryNameAndUrlAreFree = async (
    category: CategoryUpsertInput
): Promise<void> => {
    const existingCategory = await db.category.findFirst({
        where: {
            AND: [
                {
                    OR: [{ name: category.name }, { url: category.url }],
                },
                {
                    NOT: {
                        id: category.id,
                    },
                },
            ],
        },
    });
    if (!existingCategory) return;

    if (existingCategory.name === category.name) {
        throw new Error("A category with the same name already exists");
    }
    if (existingCategory.url === category.url) {
        throw new Error("A category with the same URL already exists");
    }
    // 到達不能（上の `OR` がどちらかの一致を保証する）。それでも黙って通さないのは、
    // 照合順序の変更などで前提が崩れたときに重複を素通りさせないため。
    // 元実装の「空メッセージで throw」をそのまま踏襲する。
    throw new Error("");
};

/**
 * 旧親・新親・**自ノード**を 1 つの昇順集合としてまとめて掴み、掴んだ状態で読み直す。
 *
 * 旧親と新親を同じ順序体系で掴む理由: 新親だけを先に掴んで旧親を
 * `recomputeChildCounts` まで遅らせると、旧親 A・新親 B の付け替えと
 * 旧親 B・新親 A の付け替えが交差してデッドロックする。
 * 掴む行は `assertLeafCategoryNode`（upsertProduct の V-5）と同一であることが
 * 直列化の条件 —— 別々の行をロックしたのでは「商品をリーフ L に紐づける」と
 * 「L の子を作る」の競合を検出できない。
 *
 * **自ノードを含めるのが子孫追随の前提。** subtree を動かす本処理と、その subtree の
 * 中の子孫を動かす並行 upsert は、親だけを掴んでいると一度も同じ行で出会わない
 * （後者が掴むのは subtree 内の親行）。自ノードを掴んで初めて両者が直列化し、
 * `lockDescendantsForUpdate` の収束も成立する。
 *
 * 掴んだ**後に読み直す**。ロック待ちの間に旧親が変わりうるため、待つ前に読んだ
 * `current` は既に古い。読み直して対象が増えたら掴み直す。
 */
const acquireCategoryTreeLocks = async (
    tx: CategoryTransactionClient,
    categoryId: string,
    nextParentId: string | null
): Promise<{
    current: CurrentCategoryNode | null;
    lockedParents: LockedCategoryNode[];
}> => {
    let current: CurrentCategoryNode | null = null;
    let lockedParents: LockedCategoryNode[] = [];
    const lockedIds = new Set<string>();
    for (let attempt = 0; attempt < MAX_LOCK_CONVERGENCE_ATTEMPTS; attempt++) {
        // 更新の場合のみ現在の姿が取れる（create では null）
        current = await tx.category.findUnique({
            where: { id: categoryId },
            select: {
                id: true,
                parentId: true,
                path: true,
                depth: true,
                url: true,
            },
        });
        const targets = orderedLockTargets([
            categoryId,
            current?.parentId ?? null,
            nextParentId,
        ]);
        if (targets.every((id) => lockedIds.has(id))) {
            return { current, lockedParents };
        }
        lockedParents = await lockCategoryNodesForUpdate(tx, targets);
        for (const id of targets) lockedIds.add(id);
    }
    throw new Error(CONCURRENT_TREE_EDIT_MESSAGE);
};

/**
 * 新しい親ノードを確定し、親側の不変条件（V-7c / V-7 / V-5 の裏側）を検証する。
 *
 * @returns 新親ノード。ルートへ置く場合は `null`。
 */
const resolveNextParentNode = async (
    tx: CategoryTransactionClient,
    params: {
        lockedParents: readonly LockedCategoryNode[];
        nextParentId: string | null;
        current: CurrentCategoryNode | null;
    }
): Promise<LockedCategoryNode | null> => {
    const { lockedParents, nextParentId, current } = params;
    if (nextParentId === null) return null;

    const parent =
        lockedParents.find((node) => node.id === nextParentId) ?? null;
    if (!parent) throw new Error("Parent category not found.");

    // V-7c: 子孫への再親子化。判定は境界文字 `/` を含む前置一致
    // （`isWithinSubtree`）で行う —— 素の startsWith だと
    // `electronics/camera` に対して**兄弟の** `electronics/camera-bags` まで
    // 子孫と誤判定し、正当な付け替えを拒否してしまう。
    if (current && isWithinSubtree(parent.path, current.path)) {
        throw new Error("A category cannot be moved under its own descendant.");
    }

    // V-7: 深さ上限
    if (parent.depth + 1 > MAX_CATEGORY_DEPTH) {
        throw new Error(`Category depth cannot exceed ${MAX_CATEGORY_DEPTH}.`);
    }

    // V-5 の裏側。リーフ強制は**双方向**でなければ成立しない ——
    // upsertProduct 側（`assertLeafCategoryNode`）は「非リーフに商品を
    // 紐づける」経路だけを塞ぐので、逆向きの「商品を持つノードの下に子を
    // 作る」をここで塞がないと、順に実行するだけで不変条件が破れる。
    // 上の FOR UPDATE と同じ行を掴んでいるため、並行実行も直列化される。
    //
    // 判定は**新たに P の子になる場合だけ**に限る。既に P の子である
    // ノードの改名・並び替えまで弾くと、移行期に残っている
    // 「商品を持つ非リーフ」（product.ts の V-5c 参照）配下の既存カテゴリが
    // 編集不能になる。
    const becomesNewChild =
        current === null || current.parentId !== nextParentId;
    if (!becomesNewChild) return parent;

    const productsOnParent = await tx.product.count({
        where: { categoryNodeId: parent.id },
    });
    if (productsOnParent > 0) {
        throw new Error(
            "A category with products cannot have child categories."
        );
    }
    return parent;
};

/**
 * V-7d: 子孫の追随先 path を算出する。
 *
 * **書き込む前に**上限を検証する —— `parent.depth + 1` は移動するノード自身しか
 * 見ておらず、3 段の子を持つノードを深い親へ移すと子孫が上限を突破する。
 *
 * @returns 追随が必要な子孫の `{ id, path }`。移動していなければ空配列。
 */
const computeRebasedDescendants = async (
    tx: CategoryTransactionClient,
    movedFrom: string | null,
    nextPath: string
): Promise<{ id: string; path: string }[]> => {
    if (movedFrom === null) return [];

    const descendants = await lockDescendantsForUpdate(tx, movedFrom);
    const rebased = descendants.map((descendant) => ({
        id: descendant.id,
        path: rebasePath(descendant.path, movedFrom, nextPath),
    }));
    for (const descendant of rebased) {
        if (depthOfPath(descendant.path) > MAX_CATEGORY_DEPTH) {
            throw new Error(
                `Category depth cannot exceed ${MAX_CATEGORY_DEPTH}.`
            );
        }
    }
    return rebased;
};

/**
 * rename 時に旧 slug の到達性を別名表へ退避する。
 *
 * 旧 slug の到達性は別名表だけが担保する。移行で温存された url（大文字・`_` 等）は
 * フォーム側で正準形へ寄せられるため、**通常の運用で rename が起きる**。
 */
const recordSlugAliasOnRename = async (
    tx: CategoryTransactionClient,
    current: CurrentCategoryNode | null,
    nextUrl: string,
    categoryId: string
): Promise<void> => {
    if (!current || current.url === nextUrl) return;

    await tx.categorySlugAlias.createMany({
        data: [
            {
                entityType: CategoryAliasSource.CATEGORY,
                oldSlug: current.url,
                categoryId,
            },
        ],
        // 旧 slug が既に**別ノードの**別名になっている場合は先着を残す。
        // 奪うと、生きている外部リンクの行き先が黙って変わる。
        skipDuplicates: true,
    });
};

/**
 * ツリーの書き換え本体（1 トランザクション内で完結させる部分）。
 *
 * 上限違反や循環で throw した場合に**部分適用された path を残さない**ことが、
 * ここでの唯一の要件である。
 */
const applyCategoryTreeUpsert = async (
    tx: CategoryTransactionClient,
    safeCategory: CategoryUpsertInput,
    nextParentId: string | null
): Promise<Category> => {
    const { current, lockedParents } = await acquireCategoryTreeLocks(
        tx,
        safeCategory.id,
        nextParentId
    );

    const parent = await resolveNextParentNode(tx, {
        lockedParents,
        nextParentId,
        current,
    });

    const path = parent
        ? `${parent.path}/${safeCategory.url}`
        : safeCategory.url;
    const depth = parent ? parent.depth + 1 : 0;

    const movedFrom =
        current !== null && current.path !== path ? current.path : null;
    const rebased = await computeRebasedDescendants(tx, movedFrom, path);

    const treeColumns = { path, depth };
    const categoryDetails = await tx.category.upsert({
        where: {
            id: safeCategory.id,
        },
        update: { ...safeCategory, ...treeColumns },
        create: { ...safeCategory, ...treeColumns },
    });

    for (const descendant of rebased) {
        await tx.category.update({
            where: { id: descendant.id },
            data: {
                path: descendant.path,
                depth: depthOfPath(descendant.path),
            },
        });
    }

    await recordSlugAliasOnRename(
        tx,
        current,
        safeCategory.url,
        safeCategory.id
    );

    await recomputeChildCounts(tx, [current?.parentId ?? null, nextParentId]);

    return categoryDetails;
};

export const upsertCategory = async (category: CategoryUpsertInput) => {
    try {
        // 認証 + ADMIN 権限を集約検証 (auth-guards に統一)
        await requireAdmin();

        // Ensure category data is provided
        if (!category) throw new Error("Please provide category data.");

        // Throw error if category with same name or URL already exists
        await assertCategoryNameAndUrlAreFree(category);

        // 導出列は create / update のどちらへも渡さない（実行時に落とす）
        const safeCategory = stripDerivedTreeFields(category);
        const nextParentId = safeCategory.parentId ?? null;

        // V-7b: 自己参照。DB を読む前に閉じられる唯一の循環なので先に弾く。
        // **子孫への付け替え（V-7c）とは拒否理由が違う**ので 1 本に畳まない。
        if (nextParentId !== null && nextParentId === safeCategory.id) {
            throw new Error("A category cannot be its own parent.");
        }

        // ツリーの書き換えは 1 本のトランザクションで行う。
        return await db.$transaction((tx) =>
            applyCategoryTreeUpsert(tx, safeCategory, nextParentId)
        );
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error in upsertCategory:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error in upsertCategory:", error);
        }
        throw error;
    }
};

// Function: getAllCategories
// Description: Retrieves the category tree, optionally filtered by store URL. If a store URL is provided, only branches containing products of that store are returned (ancestors included).
// Permission Level: Public
// Parameters:
//   - storeUrl (optional): URL of the store to filter categories by.
// Returns: Root category nodes, each carrying a recursive `children` array, ordered by depth / sortOrder / name. Returns empty array if store URL is provided but store is not found.

export const getAllCategories = async (storeUrl?: string) => {
    try {
        let storeId: string | undefined;

        if (storeUrl) {
            // Retrieve the storeId based on the storeUrl
            const store = await db.store.findUnique({
                where: { url: storeUrl },
            });

            // if no store is found, return an empty array or handle as needed
            if (!store) {
                return [];
            }

            storeId = store.id;
        }
        // カテゴリツリー Phase B（plan 067 / design.md §2-Q3）。
        //
        // 並び順は `updatedAt desc`（= 編集のたびに並びが変わる）をやめ、
        // depth → sortOrder → name の決定論的な順序にする。深さ昇順で引いておくと
        // buildCategoryTree が親を先に見るため、1 パスで木に組める。
        const orderBy = [
            { depth: "asc" },
            { sortOrder: "asc" },
            { name: "asc" },
        ] satisfies Prisma.CategoryOrderByWithRelationInput[];

        if (storeId === undefined) {
            return buildCategoryTree(await db.category.findMany({ orderBy }));
        }

        // 店舗スコープ。**祖先を落とさないこと。**
        // `nodeProducts: { some: { storeId } }` は直接のリレーション条件なので、
        // 「商品はリーフにのみ紐づく」と組み合わさると**リーフだけが返り、その
        // 親・祖先は 1 件も返らない**。buildCategoryTree は返された行の中から親を
        // 探すため、祖先が欠けた枝は階層が崩れる（店舗ページのカテゴリメニューが
        // 壊れる形で表面化する）。リーフの path を prefix 展開して祖先まで引く。
        const leaves = await db.category.findMany({
            where: { nodeProducts: { some: { storeId } } },
            select: { path: true },
        });
        if (leaves.length === 0) return [];

        // "a/b/c" → "a" / "a/b" / "a/b/c"
        const paths = new Set<string>();
        for (const { path } of leaves) {
            const segments = path.split("/");
            for (let i = 1; i <= segments.length; i++) {
                paths.add(segments.slice(0, i).join("/"));
            }
        }

        return buildCategoryTree(
            await db.category.findMany({
                where: { path: { in: [...paths] } },
                orderBy,
            })
        );
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error in getAllCategories:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error in getAllCategories:", error);
        }
        throw error;
    }
};

// Function: getAllSubCategoriesFotCategory
// Description: Retrieves all SubCategories for a category from the database.
// Permission Level: Public
// Returns: Array of SubCategories of Category sorted by updatedAt date in descending order.

export const getAllSubCategoriesFotCategory = async (categoryId: string) => {
    try {
        // Retrieve all subCategories of Category from the database
        const subCategories = await db.subCategory.findMany({
            where: { categoryId },
            orderBy: { updatedAt: "desc" },
        });
        return subCategories;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error in getAllSubCategoriesFotCategory:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error in getAllSubCategoriesFotCategory:", error);
        }
        throw error;
    }
};

// Function: getCategory
// Description: Retrieves a category from the database by its ID.
// Permission Level: Public
// Parameters:
// - categoryId: ID of the category to retrieve.
// Returns: Category details if found, otherwise undefined.

export const getCategory = async (categoryId: string) => {
    try {
        if (!categoryId) throw new Error("Please provide a category ID.");

        // Retrieve category from the database
        const category = await db.category.findUnique({
            where: {
                id: categoryId,
            },
        });
        return category;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error in getCategory:", error.message, error.stack);
        } else {
            console.error("Error in getCategory:", error);
        }
        throw error;
    }
};

// Function: deleteCategory
// Description: Deletes a category from the database by its ID.
// Permission Level: Admin only
// Parameters:
// - categoryId: ID of the category to delete.
// Returns: Boolean indicating whether the category was deleted successfully.

export const deleteCategory = async (categoryId: string) => {
    try {
        // 認証 + ADMIN 権限を集約検証 (auth-guards に統一)
        await requireAdmin();

        if (!categoryId) throw new Error("Please provide a category ID.");

        // 削除と親の childCount 再計算は原子的に行う。**childCount は plan 068 で
        // リーフ強制（V-5）の判定材料になった**ため、ドリフトするとその親には
        // 二度と商品を紐づけられなくなる（導出列なので admin フォームからは直せない）。
        //
        // 子を持つノードの削除は self-relation の `onDelete: Restrict` が防ぐので、
        // ここで扱うのは「リーフを消したときに親の値を戻す」ケースだけである。
        const response = await db.$transaction(async (tx) => {
            const deleted = await tx.category.delete({
                where: {
                    id: categoryId,
                },
            });
            await recomputeChildCounts(tx, [deleted.parentId]);
            return deleted;
        });
        return response;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error in deleteCategory:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error in deleteCategory:", error);
        }
        throw error;
    }
};
