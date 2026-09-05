import { parseModels } from "./parse-models";

const modelNames = new Set<string>(["AttributeOption"]);

describe("parseModels", () => {
    it("1 行の @@id / @@unique を複合キーとして拾い、フィールドには混ぜない", () => {
        // Arrange
        const src = `model AttributeOption {
  id           String
  definitionId String
  value        String
  @@id([id, definitionId])
  @@unique([definitionId, value])
}`;

        // Act
        const [model] = parseModels(src, modelNames);

        // Assert
        expect(model.compositeId).toEqual(["id", "definitionId"]);
        expect(model.compositeUniques).toEqual([["definitionId", "value"]]);
        expect(model.fields.map((f) => f.name)).toEqual([
            "id",
            "definitionId",
            "value",
        ]);
    });

    it("複数行に跨る名前付き @@id の継続行をフィールドとして出さない", () => {
        // Arrange —— 継続行 `id, definitionId` と閉じ行 `], name: "pk")` が
        // 行頭 `@@` の skip をすり抜け、偽のフィールド 2 本になっていた回帰ケース
        const src = `model AttributeOption {
  id           String
  definitionId String
  @@id([
    id, definitionId
  ], name: "pk")
}`;

        // Act
        const [model] = parseModels(src, modelNames);

        // Assert
        expect(model.compositeId).toEqual(["id", "definitionId"]);
        expect(model.fields.map((f) => f.name)).toEqual(["id", "definitionId"]);
    });

    it("コメント中の @@id / @@unique を複合キーとして拾わない", () => {
        // Arrange —— ブロック属性はモデル本体一括で走査するため、コメント中の
        // 記述やコメントアウトされた属性まで一致していた回帰ケース
        const src = `model AttributeOption {
  id           String
  definitionId String
  value        String
  // @@unique([definitionId, value]) は Phase C で追加予定
  /// @@id([id, definitionId]) にする案もあった
}`;

        // Act
        const [model] = parseModels(src, modelNames);

        // Assert
        expect(model.compositeUniques).toEqual([]);
        expect(model.compositeId).toEqual([]);
    });

    it("行コメント（// と ///）をフィールドとして出さない", () => {
        // Arrange —— 行コメントは `//` を fieldName、次トークンを型として
        // 計上され、偽のフィールドになっていた回帰ケース
        const src = `model AttributeOption {
  // Phase A で追加した新 FK 経路（Phase C で categoryId に統合される）
  id           String
  /// 旧 slug → 現ノードの対応表。
  value        String   // 行末コメントは従来どおりフィールドを壊さない
}`;

        // Act
        const [model] = parseModels(src, modelNames);

        // Assert
        expect(model.fields.map((f) => f.name)).toEqual(["id", "value"]);
    });

    it("オプション付き @@index の閉じ行をフィールドとして出さない", () => {
        // Arrange
        const src = `model AttributeOption {
  definitionId String
  @@index([
    definitionId
  ], map: "idx_definition")
}`;

        // Act
        const [model] = parseModels(src, modelNames);

        // Assert
        expect(model.fields.map((f) => f.name)).toEqual(["definitionId"]);
    });

    it("行コメント中の @@index( に反応して後続フィールドを落とさない", () => {
        // Arrange —— `@@` を位置を問わず拾う実装だと、コメント内の `@@index(` から
        // 対応する `)` まで（ここでは閉じ括弧が無いので本体末尾まで）が捨てられ、
        // `tail` が ER 図から黙って消える。
        const src = `model AttributeOption {
  id   String @id
  note String // 旧実装では @@index( を張っていた
  tail String
}`;

        // Act
        const [model] = parseModels(src, modelNames);

        // Assert
        expect(model.fields.map((f) => f.name)).toEqual(["id", "note", "tail"]);
    });

    it("インデントされた @@unique はブロック属性として従来どおり除去する", () => {
        // Arrange —— 行頭条件は「空白のみが先行する場合」を含む必要がある。
        const src = `model AttributeOption {
  definitionId String
  value        String
    @@unique([definitionId, value])
}`;

        // Act
        const [model] = parseModels(src, modelNames);

        // Assert
        expect(model.compositeUniques).toEqual([["definitionId", "value"]]);
        expect(model.fields.map((f) => f.name)).toEqual([
            "definitionId",
            "value",
        ]);
    });

    it("フィールドのデフォルト値に現れる @@id / @@unique を複合キーとして拾わない", () => {
        // Arrange —— ブロック属性はモデル本体一括で走査するため、行頭アンカーが
        // 無いと**行の途中の文字列リテラル**まで一致し、偽の複合キーが図に出る。
        // 除去側 (stripBlockAttributes) は行頭でしか反応しないので、
        // これらは同時に「フィールド」としても残り、二重計上になっていた回帰ケース。
        const src = `model AttributeOption {
  id           String
  fakePk       String @default("@@id([id, definitionId])")
  fakeUnique   String @default("@@unique([definitionId, value])")
}`;

        // Act
        const [model] = parseModels(src, modelNames);

        // Assert —— 複合キーは 1 件も生えない
        expect(model.compositeId).toEqual([]);
        expect(model.compositeUniques).toEqual([]);
        // 3 行はいずれも通常フィールドのまま残る
        expect(model.fields.map((f) => f.name)).toEqual([
            "id",
            "fakePk",
            "fakeUnique",
        ]);
    });

    it("リレーションと Decimal 表示型を従来どおり解釈する", () => {
        // Arrange
        const src = `model ProductAttributeValue {
  optionId     String?
  option       AttributeOption? @relation(fields: [optionId, definitionId], references: [id, definitionId], onDelete: Restrict)
  valueNumber  Decimal? @db.Decimal(18, 6)
}`;

        // Act
        const [model] = parseModels(src, modelNames);

        // Assert
        const option = model.fields.find((f) => f.name === "option");
        expect(option?.isRelationObject).toBe(true);
        expect(option?.relation?.fields).toEqual(["optionId", "definitionId"]);
        expect(option?.relation?.onDelete).toBe("Restrict");
        expect(
            model.fields.find((f) => f.name === "valueNumber")?.displayType
        ).toBe("Decimal(18,6)");
    });
});
