/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { AttributeOption } from "@prisma/client";
import AttributeOptionDetails from "@/components/dashboard/forms/attribute-option-details";
import { upsertAttributeOption } from "@/queries/attribute";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

/**
 * admin の ENUM 許容値フォーム（`src/components/dashboard/forms/attribute-option-details.tsx`）。
 *
 * value は不変の機械値なので編集時は入力できないこと、追加後は次の並び順で
 * フォームが空に戻ること（連続追加の導線）を値のレベルで固定する。
 */

jest.mock("@/queries/attribute", () => ({ upsertAttributeOption: jest.fn() }));
jest.mock("@/hooks/use-toast");
jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));

const mockUpsertAttributeOption = upsertAttributeOption as jest.MockedFunction<
    typeof upsertAttributeOption
>;

const mockToast = jest.fn();
const mockRefresh = jest.fn();

const option = (overrides: Partial<AttributeOption> = {}): AttributeOption => ({
    id: "opt-1",
    definitionId: "def-1",
    value: "wheat",
    label: "Wheat",
    sortOrder: 2,
    archivedAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
});

describe("AttributeOptionDetails", () => {
    // 失敗経路は console.error を握り潰す。afterEach で必ず戻す（失敗時の漏れ防止）。
    let consoleSpy: jest.SpyInstance | undefined;

    beforeEach(() => {
        jest.clearAllMocks();
        (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
        (useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh });
    });

    afterEach(() => {
        consoleSpy?.mockRestore();
        consoleSpy = undefined;
    });

    const fillNewOption = () => {
        fireEvent.change(screen.getByLabelText("Value"), {
            target: { value: "wheat" },
        });
        fireEvent.change(screen.getByLabelText("Label"), {
            target: { value: "Wheat" },
        });
    };

    describe("初期表示", () => {
        it("正常系: 新規では追加用の見出しとボタンを出し、value を入力できる", () => {
            // Arrange / Act
            render(
                <AttributeOptionDetails
                    saveAction={mockUpsertAttributeOption}
                    definitionId="def-1"
                />
            );

            // Assert
            expect(
                screen.getByRole("button", { name: "Add option" })
            ).toBeInTheDocument();
            expect(screen.getByLabelText("Value")).toBeEnabled();
            expect(screen.getByLabelText("Sort order")).toHaveValue(0);
        });

        it("正常系: 編集では既存値を入れ、value（機械値）は変更できない", () => {
            // Arrange / Act
            render(
                <AttributeOptionDetails
                    saveAction={mockUpsertAttributeOption}
                    definitionId="def-1"
                    data={option()}
                />
            );

            // Assert
            expect(screen.getByText("Edit option")).toBeInTheDocument();
            expect(screen.getByLabelText("Value")).toHaveValue("wheat");
            expect(screen.getByLabelText("Value")).toBeDisabled();
            expect(screen.getByLabelText("Label")).toHaveValue("Wheat");
            expect(
                screen.getByRole("button", { name: "Save option" })
            ).toBeInTheDocument();
        });
    });

    describe("送信", () => {
        it("正常系: 追加後はフォームを空に戻し、並び順を 1 つ進めて refresh する", async () => {
            // Arrange
            mockUpsertAttributeOption.mockResolvedValue(option() as never);
            render(
                <AttributeOptionDetails
                    saveAction={mockUpsertAttributeOption}
                    definitionId="def-1"
                />
            );
            fillNewOption();

            // Act
            fireEvent.click(screen.getByRole("button", { name: "Add option" }));

            // Assert
            await waitFor(() =>
                expect(mockToast).toHaveBeenCalledWith({
                    title: "'Wheat' is now added.",
                })
            );
            expect(mockUpsertAttributeOption).toHaveBeenCalledWith("def-1", {
                value: "wheat",
                label: "Wheat",
                sortOrder: 0,
                id: undefined,
            });
            await waitFor(() =>
                expect(screen.getByLabelText("Value")).toHaveValue("")
            );
            expect(screen.getByLabelText("Sort order")).toHaveValue(1);
            expect(mockRefresh).toHaveBeenCalled();
        });

        it("正常系: 編集は既存 id を保ち、フォームを空に戻さない", async () => {
            // Arrange
            mockUpsertAttributeOption.mockResolvedValue(option() as never);
            render(
                <AttributeOptionDetails
                    saveAction={mockUpsertAttributeOption}
                    definitionId="def-1"
                    data={option()}
                />
            );

            // Act
            fireEvent.change(screen.getByLabelText("Label"), {
                target: { value: "Whole wheat" },
            });
            fireEvent.change(screen.getByLabelText("Sort order"), {
                target: { value: "5" },
            });
            fireEvent.click(
                screen.getByRole("button", { name: "Save option" })
            );

            // Assert
            await waitFor(() =>
                expect(mockUpsertAttributeOption).toHaveBeenCalledWith(
                    "def-1",
                    {
                        value: "wheat",
                        label: "Whole wheat",
                        sortOrder: 5,
                        id: "opt-1",
                    }
                )
            );
            expect(mockToast).toHaveBeenCalledWith({
                title: "Option has been updated.",
            });
            expect(screen.getByLabelText("Label")).toHaveValue("Whole wheat");
            expect(mockRefresh).toHaveBeenCalled();
        });

        it("異常系: サーバーの拒否理由（重複 value 等）をそのまま出す", async () => {
            // Arrange
            mockUpsertAttributeOption.mockRejectedValue(
                new Error("An option with the same value already exists.")
            );
            consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            render(
                <AttributeOptionDetails
                    saveAction={mockUpsertAttributeOption}
                    definitionId="def-1"
                />
            );
            fillNewOption();

            // Act
            fireEvent.click(screen.getByRole("button", { name: "Add option" }));

            // Assert
            await waitFor(() =>
                expect(mockToast).toHaveBeenCalledWith({
                    variant: "destructive",
                    title: "Oops!",
                    description:
                        "An option with the same value already exists.",
                })
            );
            expect(mockRefresh).not.toHaveBeenCalled();
        });

        it("異常系: Error 以外が投げられたら汎用文言を出す", async () => {
            // Arrange
            mockUpsertAttributeOption.mockRejectedValue("boom");
            consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            render(
                <AttributeOptionDetails
                    saveAction={mockUpsertAttributeOption}
                    definitionId="def-1"
                />
            );
            fillNewOption();

            // Act
            fireEvent.click(screen.getByRole("button", { name: "Add option" }));

            // Assert
            await waitFor(() =>
                expect(mockToast).toHaveBeenCalledWith({
                    variant: "destructive",
                    title: "Oops!",
                    description: "An unknown error occurred",
                })
            );
        });

        it("異常系: value が機械値の形式でなければサーバーを呼ばない", async () => {
            // Arrange
            render(
                <AttributeOptionDetails
                    saveAction={mockUpsertAttributeOption}
                    definitionId="def-1"
                />
            );
            fireEvent.change(screen.getByLabelText("Value"), {
                target: { value: "Whole Wheat" },
            });
            fireEvent.change(screen.getByLabelText("Label"), {
                target: { value: "Whole wheat" },
            });

            // Act
            fireEvent.click(screen.getByRole("button", { name: "Add option" }));

            // Assert
            expect(
                await screen.findByText(
                    "Value must be lowercase letters and numbers separated by - or _."
                )
            ).toBeInTheDocument();
            expect(mockUpsertAttributeOption).not.toHaveBeenCalled();
        });
    });
});
