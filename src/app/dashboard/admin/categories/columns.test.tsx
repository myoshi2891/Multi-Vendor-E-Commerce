/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { CellContext } from "@tanstack/react-table";
import type { Category } from "@prisma/client";
import { columns } from "@/app/dashboard/admin/categories/columns";

// 重い子コンポーネント・外部依存はスタブ化し、列定義のレンダリングロジックに集中する
jest.mock("next/image", () => ({
    __esModule: true,
    default: ({
        priority,
        ...props
    }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
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

const sampleCategory = {
    id: "cat-1",
    name: "Shoes",
    url: "shoes",
    image: "https://img/shoes.png",
    featured: true,
} as Category;

/** 指定列の cell レンダラを最小 CellContext で描画する */
function renderCell(index: number, category: Category) {
    const cell = columns[index].cell;
    if (typeof cell !== "function") throw new Error("cell is not a function");
    const ctx = { row: { original: category } } as CellContext<
        Category,
        unknown
    >;
    return render(<>{cell(ctx)}</>);
}

describe("admin/categories columns", () => {
    it("declares the expected accessor keys in order", () => {
        // Assert: 列定義のメタデータ
        const keys = columns.map((c) =>
            "accessorKey" in c ? c.accessorKey : c.id,
        );
        expect(keys).toEqual(["image", "name", "url", "featured", "actions"]);
    });

    it("renders the image cell with the category name as alt", () => {
        // Act
        renderCell(0, sampleCategory);

        // Assert
        expect(screen.getByAltText("Shoes")).toHaveAttribute(
            "src",
            "https://img/shoes.png",
        );
    });

    it("renders the name cell", () => {
        renderCell(1, sampleCategory);
        expect(screen.getByText("Shoes")).toBeInTheDocument();
    });

    it("prefixes the url cell with a slash", () => {
        renderCell(2, sampleCategory);
        expect(screen.getByText("/shoes")).toBeInTheDocument();
    });

    it("shows the check badge when featured is true", () => {
        // Act
        const { container } = renderCell(3, sampleCategory);

        // Assert: featured=true は緑チェック (stroke-green-300)
        expect(container.querySelector(".stroke-green-300")).toBeInTheDocument();
    });

    it("shows the minus badge when featured is false", () => {
        // Act
        const { container } = renderCell(3, {
            ...sampleCategory,
            featured: false,
        } as Category);

        // Assert: featured=false は緑チェックなし
        expect(container.querySelector(".stroke-green-300")).toBeNull();
    });

    it("renders the actions trigger for a valid row", () => {
        // Act
        renderCell(4, sampleCategory);

        // Assert: CellActions の DropdownMenu トリガー
        expect(screen.getByText("Open menu")).toBeInTheDocument();
    });

    it("renders nothing for a row without an id", () => {
        // Act: id 欠落 → CellActions は null
        const { container } = renderCell(4, {
            ...sampleCategory,
            id: "",
        } as Category);

        // Assert
        expect(container).toBeEmptyDOMElement();
    });
});
