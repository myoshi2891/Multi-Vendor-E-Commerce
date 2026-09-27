/** @jest-environment jsdom */
import React from "react";
import {
    render,
    screen,
    fireEvent,
    waitFor,
    within,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import type { AttributeDefinition } from "@prisma/client";
import AttributeDetails, {
    type AttributeCategoryOption,
} from "@/components/dashboard/forms/attribute-details";
import { upsertAttributeDefinition } from "@/queries/attribute";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

/**
 * admin の属性定義フォーム（`src/components/dashboard/forms/attribute-details.tsx`）。
 *
 * key は不変の機械キーなので編集時は入力できないこと、D-7（多値は ENUM 限定）と
 * TEXT の facetable 禁止をサーバー到達前に止めることを値のレベルで固定する。
 */

jest.mock("@/queries/attribute", () => ({
    upsertAttributeDefinition: jest.fn(),
}));
jest.mock("@/hooks/use-toast");
jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));

// Radix Select はポインタ操作に依存し jsdom で開けない。選択肢の列挙と
// onValueChange の配線だけを検証したいので、素のボタンへ置き換える
// （category-details.test.tsx と同じスタブ）。
jest.mock("@/components/ui/select", () => {
    const react: typeof React = jest.requireActual("react");
    const Ctx = react.createContext<(value: string) => void>(() => {});
    type Children = { children?: React.ReactNode };
    return {
        __esModule: true,
        Select: ({
            children,
            value,
            onValueChange,
        }: Children & {
            value?: string;
            onValueChange: (value: string) => void;
        }) => (
            <Ctx.Provider value={onValueChange}>
                <div data-testid="select" data-value={value}>
                    {children}
                </div>
            </Ctx.Provider>
        ),
        SelectContent: ({ children }: Children) => <div>{children}</div>,
        SelectTrigger: ({ children }: Children) => <div>{children}</div>,
        SelectValue: ({ placeholder }: { placeholder?: string }) => (
            <span>{placeholder}</span>
        ),
        SelectItem: ({ children, value }: Children & { value: string }) => {
            const onValueChange = react.useContext(Ctx);
            return (
                <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    data-value={value}
                    onClick={() => onValueChange(value)}
                >
                    {children}
                </button>
            );
        },
    };
});

const mockUpsertAttributeDefinition =
    upsertAttributeDefinition as jest.MockedFunction<
        typeof upsertAttributeDefinition
    >;

const mockToast = jest.fn();
const mockPush = jest.fn();
const mockRefresh = jest.fn();

const CATEGORIES: AttributeCategoryOption[] = [
    { id: "cat-fashion", name: "Fashion", path: "fashion", depth: 0 },
    { id: "cat-shoes", name: "Shoes", path: "fashion/shoes", depth: 1 },
];

const definition = (
    overrides: Partial<AttributeDefinition> = {}
): AttributeDefinition => ({
    id: "def-1",
    categoryId: "cat-shoes",
    key: "screen_size",
    name: "Screen size",
    type: "NUMBER",
    scope: "PRODUCT",
    unit: "inch",
    required: false,
    facetable: false,
    multiValued: false,
    sortOrder: 0,
    archivedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
});

/** data-value が `value` の Select（カテゴリ / 型 / スコープ）の中の選択肢を押す。 */
const chooseOption = (selectValue: string, optionValue: string) => {
    const select = screen
        .getAllByTestId("select")
        .find((node) => node.dataset.value === selectValue);
    if (!select) throw new Error(`select not found: ${selectValue}`);
    const target = within(select)
        .getAllByRole("option")
        .find((node) => node.dataset.value === optionValue);
    if (!target) throw new Error(`option not found: ${optionValue}`);
    fireEvent.click(target);
};

describe("AttributeDetails", () => {
    // 失敗経路は console.error を握り潰す。afterEach で必ず戻す（失敗時の漏れ防止）。
    let consoleSpy: jest.SpyInstance | undefined;

    beforeEach(() => {
        jest.clearAllMocks();
        (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
            refresh: mockRefresh,
        });
    });

    afterEach(() => {
        consoleSpy?.mockRestore();
        consoleSpy = undefined;
    });

    /** 新規作成に必要な入力（カテゴリ・key・表示名）を埋める。 */
    const fillNewAttribute = () => {
        chooseOption("", "cat-shoes");
        fireEvent.change(screen.getByLabelText("Key"), {
            target: { value: "screen_size" },
        });
        fireEvent.change(screen.getByLabelText("Display name"), {
            target: { value: "Screen size" },
        });
    };

    describe("初期表示", () => {
        it("正常系: 新規では作成用の文言を出し、カテゴリを深さで字下げして並べる", () => {
            // Arrange / Act
            render(<AttributeDetails categories={CATEGORIES} />);

            // Assert
            expect(
                screen.getByRole("button", { name: "Create attribute" })
            ).toBeInTheDocument();
            expect(
                screen.getByText(/It is inherited by all descendant categories/)
            ).toBeInTheDocument();
            // 字下げは NO-BREAK SPACE (U+00A0) × depth × 4
            const shoes = screen
                .getAllByRole("option")
                .find((node) => node.dataset.value === "cat-shoes");
            expect(shoes?.textContent).toBe(`${" ".repeat(4)}Shoes`);
            // スコープは列挙値ではなく表示名で出す
            expect(
                screen.getByRole("option", { name: "Product" })
            ).toBeInTheDocument();
            expect(
                screen.getByRole("option", { name: "Variant" })
            ).toBeInTheDocument();
        });

        it("正常系: 編集では既存値を入れ、key（機械キー）は変更できない", () => {
            // Arrange / Act
            render(
                <AttributeDetails data={definition()} categories={CATEGORIES} />
            );

            // Assert
            expect(
                screen.getByText(
                    "Update the Screen size attribute. The key cannot be changed."
                )
            ).toBeInTheDocument();
            expect(screen.getByLabelText("Key")).toHaveValue("screen_size");
            expect(screen.getByLabelText("Key")).toBeDisabled();
            expect(screen.getByLabelText("Unit (optional)")).toHaveValue(
                "inch"
            );
            expect(
                screen.getByRole("button", {
                    name: "Save attribute information",
                })
            ).toBeInTheDocument();
        });
    });

    describe("送信", () => {
        it("正常系: 新規作成は既定値（TEXT / PRODUCT）で送り、一覧へ遷移する", async () => {
            // Arrange
            mockUpsertAttributeDefinition.mockResolvedValue(
                definition({ type: "TEXT", unit: null }) as never
            );
            render(<AttributeDetails categories={CATEGORIES} />);
            fillNewAttribute();

            // Act
            fireEvent.click(
                screen.getByRole("button", { name: "Create attribute" })
            );

            // Assert
            await waitFor(() =>
                expect(mockUpsertAttributeDefinition).toHaveBeenCalledWith({
                    categoryId: "cat-shoes",
                    key: "screen_size",
                    name: "Screen size",
                    type: "TEXT",
                    scope: "PRODUCT",
                    unit: "",
                    required: false,
                    facetable: false,
                    multiValued: false,
                    sortOrder: 0,
                    id: undefined,
                })
            );
            expect(mockToast).toHaveBeenCalledWith({
                title: "'Screen size' is now created.",
            });
            expect(mockPush).toHaveBeenCalledWith(
                "/dashboard/admin/attributes"
            );
            expect(mockRefresh).not.toHaveBeenCalled();
        });

        it("正常系: 型・スコープ・フラグ・並び順の変更をそのまま送る（多値 ENUM）", async () => {
            // Arrange
            mockUpsertAttributeDefinition.mockResolvedValue(
                definition({ type: "ENUM", multiValued: true }) as never
            );
            render(<AttributeDetails categories={CATEGORIES} />);
            fillNewAttribute();

            // Act
            chooseOption("TEXT", "ENUM");
            chooseOption("PRODUCT", "VARIANT");
            fireEvent.click(
                screen.getByRole("checkbox", { name: "Multi-valued" })
            );
            fireEvent.click(screen.getByRole("checkbox", { name: "Required" }));
            fireEvent.click(
                screen.getByRole("checkbox", { name: "Facetable" })
            );
            fireEvent.change(screen.getByLabelText("Sort order"), {
                target: { value: "3" },
            });
            fireEvent.click(
                screen.getByRole("button", { name: "Create attribute" })
            );

            // Assert
            await waitFor(() =>
                expect(mockUpsertAttributeDefinition).toHaveBeenCalledWith(
                    expect.objectContaining({
                        type: "ENUM",
                        scope: "VARIANT",
                        required: true,
                        facetable: true,
                        multiValued: true,
                        sortOrder: 3,
                    })
                )
            );
        });

        it("正常系: 更新は既存 id を保ち、遷移せず refresh する", async () => {
            // Arrange
            mockUpsertAttributeDefinition.mockResolvedValue(
                definition() as never
            );
            render(
                <AttributeDetails data={definition()} categories={CATEGORIES} />
            );

            // Act
            fireEvent.change(screen.getByLabelText("Display name"), {
                target: { value: "Display size" },
            });
            fireEvent.click(
                screen.getByRole("button", {
                    name: "Save attribute information",
                })
            );

            // Assert
            await waitFor(() =>
                expect(mockUpsertAttributeDefinition).toHaveBeenCalledWith(
                    expect.objectContaining({
                        id: "def-1",
                        key: "screen_size",
                        name: "Display size",
                    })
                )
            );
            expect(mockToast).toHaveBeenCalledWith({
                title: "Attribute has been updated.",
            });
            expect(mockRefresh).toHaveBeenCalled();
            expect(mockPush).not.toHaveBeenCalled();
        });

        it("異常系: サーバーの拒否理由（重複 key 等）をそのまま出す", async () => {
            // Arrange
            mockUpsertAttributeDefinition.mockRejectedValue(
                new Error(
                    "An active attribute with the same key already exists in this category."
                )
            );
            consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            render(<AttributeDetails categories={CATEGORIES} />);
            fillNewAttribute();

            // Act
            fireEvent.click(
                screen.getByRole("button", { name: "Create attribute" })
            );

            // Assert
            await waitFor(() =>
                expect(mockToast).toHaveBeenCalledWith({
                    variant: "destructive",
                    title: "Oops!",
                    description:
                        "An active attribute with the same key already exists in this category.",
                })
            );
            expect(mockPush).not.toHaveBeenCalled();
        });

        it("異常系: Error 以外が投げられたら汎用文言を出す", async () => {
            // Arrange
            mockUpsertAttributeDefinition.mockRejectedValue("boom");
            consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            render(<AttributeDetails categories={CATEGORIES} />);
            fillNewAttribute();

            // Act
            fireEvent.click(
                screen.getByRole("button", { name: "Create attribute" })
            );

            // Assert
            await waitFor(() =>
                expect(mockToast).toHaveBeenCalledWith({
                    variant: "destructive",
                    title: "Oops!",
                    description: "An unknown error occurred",
                })
            );
        });

        it("異常系: TEXT の多値・facetable はサーバーを呼ばずに止める（D-7）", async () => {
            // Arrange —— 型は既定の TEXT のまま
            render(<AttributeDetails categories={CATEGORIES} />);
            fillNewAttribute();
            fireEvent.click(
                screen.getByRole("checkbox", { name: "Multi-valued" })
            );
            fireEvent.click(
                screen.getByRole("checkbox", { name: "Facetable" })
            );

            // Act
            fireEvent.click(
                screen.getByRole("button", { name: "Create attribute" })
            );

            // Assert
            expect(
                await screen.findByText(
                    "Only ENUM attributes can be multi-valued."
                )
            ).toBeInTheDocument();
            expect(
                screen.getByText("TEXT attributes cannot be facetable.")
            ).toBeInTheDocument();
            expect(mockUpsertAttributeDefinition).not.toHaveBeenCalled();
        });

        it("異常系: カテゴリ未選択ならサーバーを呼ばない", async () => {
            // Arrange
            render(<AttributeDetails categories={CATEGORIES} />);
            fireEvent.change(screen.getByLabelText("Key"), {
                target: { value: "screen_size" },
            });
            fireEvent.change(screen.getByLabelText("Display name"), {
                target: { value: "Screen size" },
            });

            // Act
            fireEvent.click(
                screen.getByRole("button", { name: "Create attribute" })
            );

            // Assert
            expect(
                await screen.findByText("Category is required.")
            ).toBeInTheDocument();
            expect(mockUpsertAttributeDefinition).not.toHaveBeenCalled();
        });
    });
});
