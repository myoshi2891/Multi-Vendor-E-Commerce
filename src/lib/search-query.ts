/**
 * 全文検索の入力を、`to_tsquery('simple', …)` に渡す文字列へ変換する。
 */

/** 1 クエリで使うトークン数の上限。巨大な入力で tsquery と GIN 走査が肥大しないようにする。 */
const MAX_QUERY_TOKENS = 10;

/** 小数・バージョン表記（PostgreSQL パーサーの float / version）を先に、残りを文字・数字の連続で切り出す。 */
const TOKEN_PATTERN = /[0-9]+(?:\.[0-9]+)+|[\p{L}\p{N}]+/gu;

/**
 * 検索語を「全語の AND + 最後の語だけ前方一致」の tsquery 文字列にする。
 *
 * 例: `"wool coa"` → `"wool & coa:*"`
 *
 * - **最後の語だけ前方一致にする理由**: サジェストは入力途中の語（"coa"）で候補を出すのが役割で、
 *   `plainto_tsquery` の完全一致では "coat" に届かない。旧ブラウズ検索（ILIKE の部分一致）で
 *   "walnu" が "walnut" に当たっていた挙動にも近づける。全語を前方一致にすると、短い語
 *   （"a" など）が大量の語に一致して絞り込みが効かなくなるので、最後の語に限る。
 * - **トークンは文字（`\p{L}`）と数字（`\p{N}`）の連続だけにする**。tsquery の演算子
 *   （`& | ! ( ) : *` や引用符）はすべて区切りとして捨てるので、ユーザー入力が tsquery の
 *   構文として解釈されることはない（`to_tsquery` は構文エラーで例外を投げるため、これは
 *   安全性だけでなく 500 を防ぐ意味もある）。値は `Prisma.sql` のパラメータとして渡すこと。
 * - **ただし数字どうしをつなぐドット（`2.5` / `1.2.3`）は語の一部として残す**。PostgreSQL の
 *   パーサーは `to_tsvector('simple', '2.5')` を 1 つの lexeme `'2.5'` にするので、`2 & 5:*` に
 *   割ると一致しない。ドットは tsquery の演算子ではないので注入の経路にはならない。
 *   `v1.2.3` のような英字始まりの表記（パーサーでは file / host）までは揃えない。
 * - 小文字化は `'simple'` 設定の `to_tsvector` と揃えるため（`to_tsquery('simple', …)` も
 *   小文字化するが、ここで揃えておけば単体テストで結果を固定できる）。
 *
 * @param input - ユーザーの検索語（未加工）
 * @returns tsquery 文字列。トークンが 1 つも無ければ `null`（呼び出し側で空結果にする）
 */
export const buildPrefixTsQuery = (input: string): string | null => {
    const tokens = (input.toLowerCase().match(TOKEN_PATTERN) ?? []).slice(
        0,
        MAX_QUERY_TOKENS
    );
    if (tokens.length === 0) return null;
    return tokens
        .map((token, index) =>
            index === tokens.length - 1 ? `${token}:*` : token
        )
        .join(" & ");
};
