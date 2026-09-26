import { Prisma } from "@prisma/client";
import {
    toAttributeValueRows,
    fromAttributeValueRows,
    isEmptyAttributeInput,
    type AttributeValueRow,
} from "./attribute-value";

const def = (
    type: "TEXT" | "NUMBER" | "BOOLEAN" | "ENUM",
    multiValued = false
) => ({ type, multiValued });

const row = (overrides: Partial<AttributeValueRow>): AttributeValueRow => ({
    type: "TEXT",
    multiValued: false,
    valueText: null,
    valueNumber: null,
    valueBool: null,
    optionId: null,
    ...overrides,
});

describe("toAttributeValueRows", () => {
    describe("型ごとに埋める列が 1 つだけ（A-1）", () => {
        it("TEXT は valueText のみを埋める", () => {
            // Act
            const result = toAttributeValueRows(def("TEXT"), "  Aluminium ");

            // Assert
            expect(result).toEqual({
                ok: true,
                rows: [row({ type: "TEXT", valueText: "Aluminium" })],
            });
        });

        it("NUMBER は valueNumber のみを Decimal で埋める（Float を経由しない）", () => {
            const result = toAttributeValueRows(def("NUMBER"), "55.5");

            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.rows).toHaveLength(1);
            const [r] = result.rows;
            expect(r.valueNumber).toBeInstanceOf(Prisma.Decimal);
            expect(r.valueNumber?.toString()).toBe("55.5");
            expect(r).toMatchObject({
                valueText: null,
                valueBool: null,
                optionId: null,
            });
        });

        it("NUMBER は number 入力も受け付ける", () => {
            const result = toAttributeValueRows(def("NUMBER"), 0);

            expect(result.ok && result.rows[0].valueNumber?.toString()).toBe(
                "0"
            );
        });

        it("BOOLEAN は valueBool のみを埋める（false も値として保存する）", () => {
            const result = toAttributeValueRows(def("BOOLEAN"), false);

            expect(result).toEqual({
                ok: true,
                rows: [row({ type: "BOOLEAN", valueBool: false })],
            });
        });

        it("ENUM（単値）は optionId のみを埋める", () => {
            const result = toAttributeValueRows(def("ENUM"), "opt-1");

            expect(result).toEqual({
                ok: true,
                rows: [row({ type: "ENUM", optionId: "opt-1" })],
            });
        });

        it("ENUM（多値）は選択肢ごとに 1 行を作り、重複は 1 行に畳む", () => {
            const result = toAttributeValueRows(def("ENUM", true), [
                "a",
                "b",
                "a",
            ]);

            expect(result).toEqual({
                ok: true,
                rows: [
                    row({ type: "ENUM", multiValued: true, optionId: "a" }),
                    row({ type: "ENUM", multiValued: true, optionId: "b" }),
                ],
            });
        });
    });

    describe("空入力は行を作らない（A-9: 0 に化けない）", () => {
        it.each([
            ["NUMBER の空文字", def("NUMBER"), ""],
            ["NUMBER の空白のみ", def("NUMBER"), "   "],
            ["TEXT の空文字", def("TEXT"), ""],
            ["null", def("BOOLEAN"), null],
            ["undefined", def("ENUM"), undefined],
            ["多値の空配列", def("ENUM", true), []],
        ])("%s → rows = []", (_label, d, input) => {
            expect(toAttributeValueRows(d, input)).toEqual({
                ok: true,
                rows: [],
            });
        });
    });

    describe("異常系", () => {
        it.each([
            ["NUMBER に数値でない文字列", def("NUMBER"), "28g"],
            ["NUMBER に Infinity", def("NUMBER"), Number.POSITIVE_INFINITY],
            ["NUMBER に NaN", def("NUMBER"), Number.NaN],
            [
                "NUMBER が Decimal(18,6) の整数部を超える",
                def("NUMBER"),
                "1000000000000",
            ],
            ["NUMBER が小数 7 桁", def("NUMBER"), "0.1234567"],
            ["BOOLEAN に文字列", def("BOOLEAN"), "true"],
            ["TEXT に数値", def("TEXT"), 1],
            ["単値 ENUM に配列", def("ENUM"), ["a"]],
            ["多値 ENUM に文字列", def("ENUM", true), "a"],
            ["多値 ENUM に空文字の要素", def("ENUM", true), ["a", ""]],
            ["多値なのに ENUM でない定義", def("TEXT", true), "x"],
        ])("%s は ok: false", (_label, d, input) => {
            const result = toAttributeValueRows(d, input);

            expect(result.ok).toBe(false);
        });
    });
});

describe("fromAttributeValueRows", () => {
    it("行が無ければ単値は null、多値は空配列（未入力）", () => {
        expect(fromAttributeValueRows(def("NUMBER"), [])).toBeNull();
        expect(fromAttributeValueRows(def("ENUM", true), [])).toEqual([]);
    });

    it("NUMBER は文字列で返す（0 と未入力を区別する）", () => {
        const value = fromAttributeValueRows(def("NUMBER"), [
            row({ type: "NUMBER", valueNumber: new Prisma.Decimal("0") }),
        ]);

        expect(value).toBe("0");
    });

    it("TEXT / BOOLEAN / 単値 ENUM は対応する列を返す", () => {
        expect(
            fromAttributeValueRows(def("TEXT"), [row({ valueText: "x" })])
        ).toBe("x");
        expect(
            fromAttributeValueRows(def("BOOLEAN"), [
                row({ type: "BOOLEAN", valueBool: false }),
            ])
        ).toBe(false);
        expect(
            fromAttributeValueRows(def("ENUM"), [
                row({ type: "ENUM", optionId: "o1" }),
            ])
        ).toBe("o1");
    });

    it("多値 ENUM は optionId の配列を返す", () => {
        const value = fromAttributeValueRows(def("ENUM", true), [
            row({ type: "ENUM", multiValued: true, optionId: "a" }),
            row({ type: "ENUM", multiValued: true, optionId: "b" }),
        ]);

        expect(value).toEqual(["a", "b"]);
    });

    it("toAttributeValueRows と往復して同値になる", () => {
        const d = def("NUMBER");
        const written = toAttributeValueRows(d, "12.25");
        if (!written.ok) throw new Error("unexpected");

        expect(fromAttributeValueRows(d, written.rows)).toBe("12.25");
    });
});

describe("isEmptyAttributeInput", () => {
    it.each([
        [null, true],
        [undefined, true],
        ["", true],
        ["  ", true],
        [[], true],
        [0, false],
        [false, false],
        ["a", false],
        [["a"], false],
    ])("%p → %p", (input, expected) => {
        expect(isEmptyAttributeInput(input)).toBe(expected);
    });
});
