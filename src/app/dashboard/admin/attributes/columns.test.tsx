/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { CellContext } from "@tanstack/react-table";
import {
    AttributeCategoriesProvider,
    columns,
    type AttributeRow,
} from "@/app/dashboard/admin/attributes/columns";
import {
    archiveAttributeDefinition,
    changeAttributeTypeToNumber,
    restoreAttributeDefinition,
} from "@/queries/attribute";

const mockSetOpen = jest.fn();
const mockToast = jest.fn();
const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mockRefresh }),
}));
jest.mock("@/providers/modal-provider", () => ({
    useModal: () => ({ setOpen: mockSetOpen, setClose: jest.fn() }),
}));
jest.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: mockToast }),
}));
jest.mock("@/queries/attribute", () => ({
    archiveAttributeDefinition: jest.fn(),
    changeAttributeTypeToNumber: jest.fn(),
    restoreAttributeDefinition: jest.fn(),
}));
jest.mock("@/components/dashboard/forms/attribute-details", () => ({
    __esModule: true,
    default: ({ categories }: { categories: { id: string }[] }) => (
        <div data-testid="attribute-details">
            {categories.map((c) => c.id).join(",")}
        </div>
    ),
}));
jest.mock("@/components/dashboard/shared/custom-modal", () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
// Radix DropdownMenu はポインタ操作で開くため jsdom では中身が出ない。
// 表示条件と onClick の配線だけを検証したいので、常に展開された素のボタンへ置き換える。
jest.mock("@/components/ui/dropdown-menu", () => {
    type Children = { children?: React.ReactNode };
    return {
        __esModule: true,
        DropdownMenu: ({ children }: Children) => <div>{children}</div>,
        DropdownMenuTrigger: ({ children }: Children) => <>{children}</>,
        DropdownMenuContent: ({ children }: Children) => <div>{children}</div>,
        DropdownMenuLabel: ({ children }: Children) => <div>{children}</div>,
        DropdownMenuSeparator: () => <hr />,
        DropdownMenuItem: ({
            children,
            onClick,
            asChild,
        }: Children & { onClick?: () => void; asChild?: boolean }) =>
            asChild ? (
                <>{children}</>
            ) : (
                <button type="button" role="menuitem" onClick={onClick}>
                    {children}
                </button>
            ),
    };
});

const mockArchive = archiveAttributeDefinition as jest.MockedFunction<
    typeof archiveAttributeDefinition
>;
const mockRestore = restoreAttributeDefinition as jest.MockedFunction<
    typeof restoreAttributeDefinition
>;
const mockChangeType = changeAttributeTypeToNumber as jest.MockedFunction<
    typeof changeAttributeTypeToNumber
>;

const attributeRow = (overrides: Partial<AttributeRow> = {}): AttributeRow => ({
    id: "def-1",
    categoryId: "cat-shoes",
    key: "material",
    name: "Material",
    type: "TEXT",
    scope: "PRODUCT",
    unit: null,
    required: false,
    facetable: false,
    multiValued: false,
    sortOrder: 0,
    archivedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    category: { name: "Shoes", path: "fashion/shoes" },
    _count: { options: 0 },
    ...overrides,
});

/** 列のキー（accessorKey か id）。位置ではなくキーで引く。 */
const columnKey = (column: (typeof columns)[number]): string =>
    "accessorKey" in column ? String(column.accessorKey) : String(column.id);

function renderCell(
    key: string,
    row: AttributeRow,
    wrap: (node: React.ReactNode) => React.ReactNode = (node) => node
) {
    const column = columns.find((c) => columnKey(c) === key);
    if (!column) throw new Error(`column not found: ${key}`);
    const cell = column.cell;
    if (typeof cell !== "function") throw new Error("cell is not a function");
    const ctx = { row: { original: row } } as unknown as CellContext<
        AttributeRow,
        unknown
    >;
    return render(<>{wrap(cell(ctx))}</>);
}

const menuItem = (name: string) => screen.getByRole("menuitem", { name });

describe("admin/attributes columns", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("列のキーを順に宣言する", () => {
        expect(columns.map(columnKey)).toEqual([
            "name",
            "category",
            "type",
            "scope",
            "flags",
            "actions",
        ]);
    });

    describe("表示セル", () => {
        it("名前セルは表示名と機械キーを出す", () => {
            renderCell("name", attributeRow());

            expect(screen.getByText("Material")).toBeInTheDocument();
            expect(screen.getByText("material")).toBeInTheDocument();
        });

        it("カテゴリセルはパスをスラッシュ始まりで出す", () => {
            renderCell("category", attributeRow());

            expect(screen.getByText("/fashion/shoes")).toBeInTheDocument();
        });

        it("型セルは単位と、ENUM なら選択肢数を添える", () => {
            // Act
            const { container, unmount } = renderCell(
                "type",
                attributeRow({ type: "NUMBER", unit: "cm" })
            );
            const numberText = container.textContent;
            unmount();
            const { container: enumContainer } = renderCell(
                "type",
                attributeRow({ type: "ENUM", _count: { options: 3 } })
            );

            // Assert
            expect(numberText).toBe("NUMBER (cm)");
            expect(enumContainer.textContent).toBe("ENUM · 3 options");
        });

        it("フラグセルは立っているフラグだけをバッジで出す", () => {
            // Act
            renderCell(
                "flags",
                attributeRow({
                    required: true,
                    facetable: true,
                    multiValued: true,
                    archivedAt: new Date("2026-02-01"),
                })
            );

            // Assert
            for (const label of ["Required", "Facet", "Multi", "Archived"]) {
                expect(screen.getByText(label)).toBeInTheDocument();
            }
        });

        it("フラグが無ければバッジを出さない", () => {
            const { container } = renderCell("flags", attributeRow());

            expect(container.textContent).toBe("");
        });
    });

    describe("操作メニュー", () => {
        it("アクティブな TEXT 定義: 編集・NUMBER 変換・アーカイブを出し、選択肢管理は出さない", () => {
            renderCell("actions", attributeRow());

            expect(menuItem("Edit details")).toBeInTheDocument();
            expect(menuItem("Convert to NUMBER")).toBeInTheDocument();
            expect(menuItem("Archive")).toBeInTheDocument();
            expect(screen.queryByText("Manage options")).toBeNull();
            expect(screen.queryByText("Restore")).toBeNull();
        });

        it("アーカイブ済み ENUM 定義: 選択肢管理と復元だけを出す", () => {
            renderCell(
                "actions",
                attributeRow({
                    type: "ENUM",
                    archivedAt: new Date("2026-02-01"),
                })
            );

            expect(
                screen.getByRole("link", { name: "Manage options" })
            ).toHaveAttribute(
                "href",
                "/dashboard/admin/attributes/def-1/options"
            );
            expect(menuItem("Restore")).toBeInTheDocument();
            expect(screen.queryByText("Edit details")).toBeNull();
            expect(screen.queryByText("Convert to NUMBER")).toBeNull();
            expect(screen.queryByText("Archive")).toBeNull();
        });

        it("編集はモーダルでフォームを開き、Provider のカテゴリを渡す", () => {
            const categories = [
                {
                    id: "cat-shoes",
                    name: "Shoes",
                    path: "fashion/shoes",
                    depth: 1,
                },
                {
                    id: "cat-bags",
                    name: "Bags",
                    path: "fashion/bags",
                    depth: 1,
                },
            ];
            renderCell("actions", attributeRow(), (node) => (
                <AttributeCategoriesProvider categories={categories}>
                    {node}
                </AttributeCategoriesProvider>
            ));

            fireEvent.click(menuItem("Edit details"));

            expect(mockSetOpen).toHaveBeenCalledTimes(1);
            render(<>{mockSetOpen.mock.calls[0][0]}</>);
            expect(screen.getByTestId("attribute-details")).toHaveTextContent(
                "cat-shoes,cat-bags"
            );
        });

        it("アーカイブは成功を通知して refresh する", async () => {
            // Arrange
            mockArchive.mockResolvedValue({} as never);
            renderCell("actions", attributeRow());

            // Act
            fireEvent.click(menuItem("Archive"));

            // Assert
            await waitFor(() =>
                expect(mockToast).toHaveBeenCalledWith({
                    title: "Attribute archived. Existing values are kept.",
                })
            );
            expect(mockArchive).toHaveBeenCalledWith("def-1");
            expect(mockRefresh).toHaveBeenCalled();
        });

        it("復元は成功を通知する", async () => {
            // Arrange
            mockRestore.mockResolvedValue({} as never);
            renderCell(
                "actions",
                attributeRow({ archivedAt: new Date("2026-02-01") })
            );

            // Act
            fireEvent.click(menuItem("Restore"));

            // Assert
            await waitFor(() =>
                expect(mockToast).toHaveBeenCalledWith({
                    title: "Attribute restored.",
                })
            );
            expect(mockRestore).toHaveBeenCalledWith("def-1");
        });

        it.each([
            [
                "全件変換できた（route 1）",
                { route: 1, converted: 4, unconvertible: 0 },
                "Converted 4 values to NUMBER.",
            ],
            [
                "変換できない値が残った（route 2）",
                { route: 2, converted: 3, unconvertible: 2 },
                "Converted 3 values. 2 unconvertible values stay on the archived TEXT attribute.",
            ],
        ])("NUMBER 変換: %s 場合の通知文言", async (_label, result, title) => {
            // Arrange
            mockChangeType.mockResolvedValue({
                definitionId: "def-2",
                ...result,
            } as never);
            renderCell("actions", attributeRow());

            // Act
            fireEvent.click(menuItem("Convert to NUMBER"));

            // Assert
            await waitFor(() =>
                expect(mockToast).toHaveBeenCalledWith({ title })
            );
        });

        it("失敗はサーバーの文言を出し、refresh しない", async () => {
            // Arrange
            mockArchive.mockRejectedValue(
                new Error("Attribute not found or already archived.")
            );
            renderCell("actions", attributeRow());

            // Act
            fireEvent.click(menuItem("Archive"));

            // Assert
            await waitFor(() =>
                expect(mockToast).toHaveBeenCalledWith({
                    variant: "destructive",
                    title: "Error",
                    description: "Attribute not found or already archived.",
                })
            );
            expect(mockRefresh).not.toHaveBeenCalled();
        });

        it("Error 以外の失敗は汎用文言を出す", async () => {
            // Arrange
            mockArchive.mockRejectedValue("boom");
            renderCell("actions", attributeRow());

            // Act
            fireEvent.click(menuItem("Archive"));

            // Assert
            await waitFor(() =>
                expect(mockToast).toHaveBeenCalledWith({
                    variant: "destructive",
                    title: "Error",
                    description: "Action failed.",
                })
            );
        });

        it("実行中の再クリックはサーバーを 2 回呼ばない", async () => {
            // Arrange —— 解決を保留して loading 中の状態を作る
            let resolve: (value: unknown) => void = () => {};
            mockArchive.mockReturnValue(
                new Promise((r) => {
                    resolve = r;
                }) as never
            );
            renderCell("actions", attributeRow());

            // Act
            fireEvent.click(menuItem("Archive"));
            await waitFor(() =>
                expect(
                    screen.getByRole("button", { name: "Open menu" })
                ).toBeDisabled()
            );
            fireEvent.click(menuItem("Archive"));
            resolve({});

            // Assert
            await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
            expect(mockArchive).toHaveBeenCalledTimes(1);
        });
    });
});
