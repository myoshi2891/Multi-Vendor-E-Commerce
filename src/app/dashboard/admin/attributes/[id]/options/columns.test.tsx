/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { CellContext } from "@tanstack/react-table";
import type { AttributeOption } from "@prisma/client";
import { getAttributeOptionColumns } from "@/app/dashboard/admin/attributes/[id]/options/columns";
import {
    upsertAttributeOption,
    archiveAttributeOption,
    restoreAttributeOption,
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
    upsertAttributeOption: jest.fn(),
    archiveAttributeOption: jest.fn(),
    restoreAttributeOption: jest.fn(),
}));
jest.mock("@/components/dashboard/forms/attribute-option-details", () => ({
    __esModule: true,
    default: () => <div data-testid="attribute-option-details" />,
}));
jest.mock("@/components/dashboard/shared/custom-modal", () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
// Radix DropdownMenu は jsdom では開けないため、常に展開された素のボタンへ置き換える
// （admin/attributes/columns.test.tsx と同じスタブ）。
jest.mock("@/components/ui/dropdown-menu", () => {
    type Children = { children?: React.ReactNode };
    return {
        __esModule: true,
        DropdownMenu: ({ children }: Children) => <div>{children}</div>,
        DropdownMenuTrigger: ({ children }: Children) => <>{children}</>,
        DropdownMenuContent: ({ children }: Children) => <div>{children}</div>,
        DropdownMenuLabel: ({ children }: Children) => <div>{children}</div>,
        DropdownMenuItem: ({
            children,
            onClick,
        }: Children & { onClick?: () => void }) => (
            <button type="button" role="menuitem" onClick={onClick}>
                {children}
            </button>
        ),
    };
});

const columns = getAttributeOptionColumns({
    saveAction: upsertAttributeOption,
    archiveAction: archiveAttributeOption,
    restoreAction: restoreAttributeOption,
});
const mockArchive = archiveAttributeOption as jest.MockedFunction<
    typeof archiveAttributeOption
>;
const mockRestore = restoreAttributeOption as jest.MockedFunction<
    typeof restoreAttributeOption
>;

const option = (overrides: Partial<AttributeOption> = {}): AttributeOption => ({
    id: "opt-1",
    definitionId: "def-1",
    value: "wheat",
    label: "Wheat",
    sortOrder: 0,
    archivedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
});

/** 列のキー（accessorKey か id）。位置ではなくキーで引く。 */
const columnKey = (column: (typeof columns)[number]): string =>
    "accessorKey" in column ? String(column.accessorKey) : String(column.id);

function renderCell(key: string, row: AttributeOption) {
    const column = columns.find((c) => columnKey(c) === key);
    if (!column) throw new Error(`column not found: ${key}`);
    const cell = column.cell;
    if (typeof cell !== "function") throw new Error("cell is not a function");
    const ctx = { row: { original: row } } as unknown as CellContext<
        AttributeOption,
        unknown
    >;
    return render(<>{cell(ctx)}</>);
}

const menuItem = (name: string) => screen.getByRole("menuitem", { name });

describe("admin/attributes/[id]/options columns", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("列のキーを順に宣言する", () => {
        expect(columns.map(columnKey)).toEqual([
            "label",
            "value",
            "sortOrder",
            "status",
            "actions",
        ]);
    });

    it("ラベルセルは表示名を出す", () => {
        renderCell("label", option());

        expect(screen.getByText("Wheat")).toBeInTheDocument();
    });

    it.each([
        ["アクティブ", null, "Active"],
        ["アーカイブ済み", new Date("2026-02-01"), "Archived"],
    ])("状態セル: %s なら %s バッジ", (_label, archivedAt, badge) => {
        renderCell("status", option({ archivedAt }));

        expect(screen.getByText(badge)).toBeInTheDocument();
    });

    it("アクティブな選択肢: 編集とアーカイブを出し、復元は出さない", () => {
        renderCell("actions", option());

        expect(menuItem("Edit label")).toBeInTheDocument();
        expect(menuItem("Archive")).toBeInTheDocument();
        expect(screen.queryByText("Restore")).toBeNull();
    });

    it("編集はモーダルでフォームを開く", () => {
        renderCell("actions", option());

        fireEvent.click(menuItem("Edit label"));

        expect(mockSetOpen).toHaveBeenCalledTimes(1);
    });

    it("アーカイブは成功を通知して refresh する", async () => {
        // Arrange
        mockArchive.mockResolvedValue(option() as never);
        renderCell("actions", option());

        // Act
        fireEvent.click(menuItem("Archive"));

        // Assert
        await waitFor(() =>
            expect(mockToast).toHaveBeenCalledWith({
                title: "Option archived. Products keep their current value.",
            })
        );
        expect(mockArchive).toHaveBeenCalledWith("opt-1");
        expect(mockRefresh).toHaveBeenCalled();
    });

    it("アーカイブ済みの選択肢は復元できる", async () => {
        // Arrange
        mockRestore.mockResolvedValue(option() as never);
        renderCell("actions", option({ archivedAt: new Date("2026-02-01") }));

        // Act
        fireEvent.click(menuItem("Restore"));

        // Assert
        await waitFor(() =>
            expect(mockToast).toHaveBeenCalledWith({
                title: "Option restored.",
            })
        );
        expect(mockRestore).toHaveBeenCalledWith("opt-1");
        expect(screen.queryByText("Archive")).toBeNull();
    });

    it.each([
        [
            "Error",
            new Error("Option not found or already archived."),
            "Option not found or already archived.",
        ],
        ["Error 以外", "boom", "Action failed."],
    ])(
        "失敗（%s）は通知して refresh しない",
        async (_label, error, message) => {
            // Arrange
            mockArchive.mockRejectedValue(error);
            renderCell("actions", option());

            // Act
            fireEvent.click(menuItem("Archive"));

            // Assert
            await waitFor(() =>
                expect(mockToast).toHaveBeenCalledWith({
                    variant: "destructive",
                    title: "Error",
                    description: message,
                })
            );
            expect(mockRefresh).not.toHaveBeenCalled();
        }
    );

    it("実行中の再クリックはサーバーを 2 回呼ばない", async () => {
        // Arrange —— 解決を保留して loading 中の状態を作る
        let resolve: (value: unknown) => void = () => {};
        mockArchive.mockReturnValue(
            new Promise((r) => {
                resolve = r;
            }) as never
        );
        renderCell("actions", option());

        // Act
        fireEvent.click(menuItem("Archive"));
        await waitFor(() =>
            expect(
                screen.getByRole("button", { name: "Open menu for Wheat" })
            ).toBeDisabled()
        );
        fireEvent.click(menuItem("Archive"));
        resolve(option());

        // Assert
        await waitFor(() => expect(mockToast).toHaveBeenCalledTimes(1));
        expect(mockArchive).toHaveBeenCalledTimes(1);
    });
});
