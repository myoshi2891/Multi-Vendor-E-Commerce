/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { CellContext } from "@tanstack/react-table";
import type { Category } from "@prisma/client";
import { columns } from "@/app/dashboard/admin/categories/columns";
import { createMockCategory } from "@/config/test-fixtures";

// 重い子コンポーネント・外部依存はスタブ化し、列定義のレンダリングロジックに集中する
jest.mock("next/image", () => ({
    __esModule: true,
    default: ({
        priority,
        ...props
    }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
        <img {...props} />
    ),
}));
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("@/providers/modal-provider", () => ({
    useModal: () => ({ setOpen: jest.fn(), setClose: jest.fn() }),
}));
jest.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: jest.fn() }),
}));
jest.mock("@/queries/category", () => ({
    getCategory: jest.fn(),
    deleteCategory: jest.fn(),
}));
jest.mock("@/components/dashboard/forms/category-details", () => ({
    __esModule: true,
    default: () => <div data-testid="category-details" />,
}));
jest.mock("@/components/dashboard/shared/custom-modal", () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const sampleCategory: Category = createMockCategory({
    id: "cat-1",
    name: "Shoes",
    url: "shoes",
    image: "https://img/shoes.png",
    featured: true,
    path: "shoes",
});

/** 列のキー（accessorKey か id）。位置ではなくキーで引く。 */
const columnKey = (column: (typeof columns)[number]): string =>
    "accessorKey" in column ? String(column.accessorKey) : String(column.id);

/**
 * 指定列の cell レンダラを最小 CellContext で描画する。
 *
 * **位置ではなくキーで引く。** 列を 1 本足すたびに全テストの添字がずれると、
 * 追加した列とは無関係なテストが赤くなり原因が読めなくなる。
 */
function renderCell(
    key: string,
    category: Category,
    tableRows: Category[] = [category]
) {
    const column = columns.find((c) => columnKey(c) === key);
    if (!column) throw new Error(`column not found: ${key}`);
    const cell = column.cell;
    if (typeof cell !== "function") throw new Error("cell is not a function");
    // actions 列は親候補をテーブル（= ページが渡した data）から読む。
    // 行ごとにサーバーアクションを叩かないことがこのスタブで担保される。
    const getCoreRowModel = jest.fn(() => ({
        rows: tableRows.map((original) => ({ original })),
    }));
    const ctx = {
        row: { original: category },
        table: { getCoreRowModel },
    } as unknown as CellContext<Category, unknown>;
    const view = render(<>{cell(ctx)}</>);
    return { ...view, getCoreRowModel };
}

describe("admin/categories columns", () => {
    it("declares the expected accessor keys in order", () => {
        // Assert: 列定義のメタデータ
        const keys = columns.map((c) =>
            "accessorKey" in c ? c.accessorKey : c.id
        );
        expect(keys).toEqual([
            "image",
            "name",
            "url",
            "parent",
            "sortOrder",
            "featured",
            "actions",
        ]);
    });

    it("renders the image cell with the category name as alt", () => {
        // Act
        renderCell("image", sampleCategory);

        // Assert
        expect(screen.getByAltText("Shoes")).toHaveAttribute(
            "src",
            "https://img/shoes.png"
        );
    });

    it("renders the name cell", () => {
        renderCell("name", sampleCategory);
        expect(screen.getByText("Shoes")).toBeInTheDocument();
    });

    it("prefixes the url cell with a slash", () => {
        renderCell("url", sampleCategory);
        expect(screen.getByText("/shoes")).toBeInTheDocument();
    });

    it("shows the check badge when featured is true", () => {
        // Act
        const { container } = renderCell("featured", sampleCategory);

        // Assert: featured=true は緑チェック (stroke-green-300)
        expect(
            container.querySelector(".stroke-green-300")
        ).toBeInTheDocument();
    });

    it("shows the minus badge when featured is false", () => {
        // Act
        const { container } = renderCell("featured", {
            ...sampleCategory,
            featured: false,
        });

        // Assert: featured=false は緑チェックなし
        expect(container.querySelector(".stroke-green-300")).toBeNull();
    });

    it("renders the actions trigger for a valid row", () => {
        // Act
        renderCell("actions", sampleCategory);

        // Assert: CellActions の DropdownMenu トリガー
        expect(screen.getByText("Open menu")).toBeInTheDocument();
    });

    it("sources parent candidates from the table instead of fetching per row", () => {
        // Arrange: 3 行のテーブル
        const rows = [
            sampleCategory,
            { ...sampleCategory, id: "cat-2" },
            { ...sampleCategory, id: "cat-3" },
        ];

        // Act
        const { getCoreRowModel } = renderCell("actions", sampleCategory, rows);

        // Assert: ページが渡した data をそのまま使う（行ごとの取得をしない）
        expect(getCoreRowModel).toHaveBeenCalled();
        expect(getCoreRowModel.mock.results[0].value.rows).toHaveLength(3);
    });

    // ---- ツリー表示（plan 068 Step 6）----
    it("indents the name cell by depth", () => {
        // Act —— 深さ 2 のノード
        const { container } = renderCell("name", {
            ...sampleCategory,
            path: "electronics/camera/lens",
            depth: 2,
        });

        // Assert —— 1 テーブルに全階層が並ぶため、深さは字下げでしか読めない
        expect(container.firstElementChild).toHaveStyle({
            paddingLeft: "32px",
        });
    });

    it("renders the parent slug in the parent cell", () => {
        // Act
        renderCell("parent", {
            ...sampleCategory,
            path: "electronics/camera/lens",
            depth: 2,
        });

        // Assert —— 親名は path の 1 つ手前のセグメントから読む
        //（親行を引き直さずに済み、path が正であることの表示にもなる）
        expect(screen.getByText("/camera")).toBeInTheDocument();
    });

    it("shows a dash in the parent cell for root nodes", () => {
        // Act
        renderCell("parent", sampleCategory);

        // Assert
        expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("renders the sort order", () => {
        // Act
        renderCell("sortOrder", {
            ...sampleCategory,
            sortOrder: 3,
        });

        // Assert
        expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("renders nothing for a row without an id", () => {
        // Act: id 欠落 → CellActions は null
        const { container } = renderCell("actions", {
            ...sampleCategory,
            id: "",
        });

        // Assert
        expect(container).toBeEmptyDOMElement();
    });
});
