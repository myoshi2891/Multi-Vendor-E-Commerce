import { buildPrefixTsQuery } from "./search-query";

describe("buildPrefixTsQuery", () => {
    it("1 語は前方一致にする（入力途中の語で候補を出すため）", () => {
        // Arrange / Act / Assert
        expect(buildPrefixTsQuery("coa")).toBe("coa:*");
    });

    it("複数語は AND で結び、最後の語だけを前方一致にする", () => {
        expect(buildPrefixTsQuery("wool coa")).toBe("wool & coa:*");
    });

    it("小文字化する（'simple' 設定の to_tsvector と揃える）", () => {
        expect(buildPrefixTsQuery("Wool COAT")).toBe("wool & coat:*");
    });

    it("tsquery の演算子や記号は区切りとして捨てる（構文の注入を防ぐ）", () => {
        // & | ! ( ) : * ' などが素通しされると to_tsquery の構文エラーや意図しない演算になる
        expect(buildPrefixTsQuery("a&b|c!(d):*'e")).toBe("a & b & c & d & e:*");
    });

    it("SQL 風の文字列も文字・数字のトークンだけになる", () => {
        expect(buildPrefixTsQuery('\'; DROP TABLE "Product"; --')).toBe(
            "drop & table & product:*"
        );
    });

    it("文字・数字以外のラテン文字や CJK もトークンとして残す", () => {
        expect(buildPrefixTsQuery("café 東京")).toBe("café & 東京:*");
    });

    it("小数・バージョン表記は 1 語として扱う（to_tsvector が 2.5 を 1 つの lexeme にするため）", () => {
        // "2 & 5:*" に割ると、to_tsvector('simple', 'Size 2.5') の '2.5' に一致しない
        expect(buildPrefixTsQuery("size 2.5")).toBe("size & 2.5:*");
        expect(buildPrefixTsQuery("2.5 inch")).toBe("2.5 & inch:*");
        expect(buildPrefixTsQuery("1.2.3")).toBe("1.2.3:*");
    });

    it("数字に続かないドットや末尾のドットは区切りとして捨てる", () => {
        // PostgreSQL のパーサーも "10." は uint の 10、"1.5x" は float 1.5 + "x" に分ける
        expect(buildPrefixTsQuery("10.")).toBe("10:*");
        expect(buildPrefixTsQuery("1.5x")).toBe("1.5 & x:*");
        expect(buildPrefixTsQuery("2.5.")).toBe("2.5:*");
    });

    it("トークンが 1 つも無い入力は null を返す（呼び出し側で空結果にする）", () => {
        expect(buildPrefixTsQuery("")).toBeNull();
        expect(buildPrefixTsQuery("   ")).toBeNull();
        expect(buildPrefixTsQuery("&|!():*")).toBeNull();
    });

    it("トークン数に上限を設ける（巨大な入力で tsquery が肥大しないように）", () => {
        // Arrange
        const input = Array.from({ length: 50 }, (_, i) => `w${i}`).join(" ");

        // Act
        const result = buildPrefixTsQuery(input);

        // Assert — 先頭 10 語だけを使う
        expect(result?.split(" & ")).toHaveLength(10);
        expect(result?.endsWith("w9:*")).toBe(true);
    });
});
