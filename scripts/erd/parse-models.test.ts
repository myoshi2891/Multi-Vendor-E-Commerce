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
        expect(model.fields.map((f) => f.name)).toEqual(["id", "definitionId", "value"]);
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
        expect(model.fields.find((f) => f.name === "valueNumber")?.displayType).toBe(
            "Decimal(18,6)"
        );
    });
});
