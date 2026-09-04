/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import CategoryDetails from "@/components/dashboard/forms/category-details";
import { Category } from "@prisma/client";
import { upsertCategory } from "@/queries/category";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

/**
 * admin のカテゴリ編集フォーム（`src/components/dashboard/forms/category-details.tsx`）。
 *
 * plan 068 のカットオーバーで **親選択（parentId）と並び順（sortOrder）** が載り、
 * 同時に「移行で温存された旧 url を正準形へ寄せてから表示する」処理が入った。
 * どちらも退行しても画面は普通に描画されるため、値のレベルで固定する:
 *
 * - 旧 url（大文字・`_`）を正準化せずに出すと、その行は featured の切り替えすら
 *   保存できない（CategoryFormSchema の正規表現を通らない）。
 * - 親候補の絞り込み（自分自身 / 子孫 / depth 上限）が緩むと、admin が
 *   サーバー側 V-7b / V-7c で必ず失敗する選択肢を選べてしまう。
 */

jest.mock("@/queries/category", () => ({ upsertCategory: jest.fn() }));
jest.mock("@/hooks/use-toast");
jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("uuid", () => ({ v4: () => "generated-uuid" }));

// Cloudinary ウィジェットは jsdom で動かないため、URL を注入できる最小スタブに置換する。
jest.mock("@/components/dashboard/shared/image-upload", () => ({
    __esModule: true,
    default: ({
        value,
        onChange,
        onRemove,
    }: {
        value: string[];
        onChange: (url: string) => void;
        onRemove: (url: string) => void;
    }) => (
        <div data-value={value.join(",")}>
            <button
                type="button"
                data-testid="image-upload"
                onClick={() => onChange("https://example.com/new.jpg")}
            >
                upload
            </button>
            <button
                type="button"
                data-testid="image-remove"
                onClick={() => onRemove(value[0] ?? "")}
            >
                remove
            </button>
        </div>
    ),
}));

// Radix Select はポインタ操作に依存し jsdom で開けない。選択肢の列挙と
// onValueChange の配線だけを検証したいので、素のボタンへ置き換える。
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
                <div data-testid="parent-select" data-value={value}>
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

const mockUpsertCategory = upsertCategory as jest.MockedFunction<
    typeof upsertCategory
>;

/** ツリー列を持つ Category の最小ビルダー。 */
const category = (overrides: Partial<Category> = {}): Category =>
    ({
        id: "cat-root",
        name: "Electronics",
        image: "https://example.com/e.jpg",
        url: "electronics",
        featured: false,
        parentId: null,
        path: "electronics",
        depth: 0,
        sortOrder: 0,
        childCount: 1,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        ...overrides,
    }) as Category;

/**
 * 親候補セレクトに並んでいる選択肢のラベル（先頭のインデント埋めは除去）。
 *
 * 埋め文字はコンポーネント側 (`category-details.tsx`) の `"\u00A0".repeat(...)` と
 * 同じ **NO-BREAK SPACE (U+00A0)**。正規表現にはリテラルではなく `\u00A0` エスケープを
 * 書くこと —— リテラルは通常の空白と見分けが付かず、エディタや整形で黙って
 * 置き換えられても気付けない。
 */
const parentOptionLabels = (): string[] =>
    screen
        .getAllByRole("option")
        .map((option) => (option.textContent ?? "").replace(/\u00A0/g, ""));

const mockToast = jest.fn();
const mockPush = jest.fn();
const mockRefresh = jest.fn();

describe("CategoryDetails", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
            refresh: mockRefresh,
        });
    });

    describe("初期表示", () => {
        it("正常系: 新規作成では作成用の文言とボタンを出す", () => {
            // Arrange / Act
            render(<CategoryDetails />);

            // Assert
            expect(
                screen.getByRole("button", { name: "Create category" })
            ).toBeInTheDocument();
            expect(screen.getByLabelText("Category name")).toHaveValue("");
        });

        it("正常系: 編集では既存値を入れ、更新用のボタンを出す", () => {
            // Arrange / Act
            render(<CategoryDetails data={category({ name: "Camera" })} />);

            // Assert
            expect(
                screen.getByRole("button", {
                    name: "Save category information",
                })
            ).toBeInTheDocument();
            expect(screen.getByLabelText("Category name")).toHaveValue(
                "Camera"
            );
            expect(
                screen.getByText("Update Camera category information.")
            ).toBeInTheDocument();
        });

        it("正常系: 移行で温存された旧 url を正準形へ寄せて表示する", () => {
            // Arrange —— 大文字と `_` を含む旧 slug
            render(
                <CategoryDetails data={category({ url: "Home_Appliances" })} />
            );

            // Assert —— そのまま出すと schema の正規表現を通らず保存できなくなる
            expect(screen.getByLabelText("Category url")).toHaveValue(
                "home-appliances"
            );
        });

        it("エッジケース: categories 未指定なら親選択を描画しない", () => {
            // Arrange / Act
            render(<CategoryDetails data={category()} />);

            // Assert —— ルートのみ作成できる従来の挙動
            expect(
                screen.queryByText("Parent category")
            ).not.toBeInTheDocument();
        });
    });

    describe("親候補の絞り込み", () => {
        it("正常系: 自分自身と子孫を親候補から除外する", () => {
            // Arrange —— electronics > camera（編集対象は electronics）
            const root = category({ id: "root", path: "electronics" });
            const child = category({
                id: "child",
                name: "Camera",
                url: "camera",
                parentId: "root",
                path: "electronics/camera",
                depth: 1,
            });
            const sibling = category({
                id: "sibling",
                name: "Fashion",
                url: "fashion",
                path: "fashion",
            });

            // Act
            render(
                <CategoryDetails
                    data={root}
                    categories={[root, child, sibling]}
                />
            );

            // Assert —— 循環になる 2 件が消え、Root 番兵と兄弟だけが残る
            expect(parentOptionLabels()).toEqual([
                "Root (no parent)",
                "Fashion",
            ]);
        });

        it("境界値: depth が上限のノードは親候補から外す", () => {
            // Arrange —— MAX_CATEGORY_DEPTH = 4
            const deep = category({
                id: "deep",
                name: "TooDeep",
                url: "too-deep",
                path: "a/b/c/d/e",
                depth: 4,
            });
            const ok = category({
                id: "ok",
                name: "Assignable",
                url: "assignable",
                path: "a/b/c/d",
                depth: 3,
            });

            // Act
            render(<CategoryDetails categories={[deep, ok]} />);

            // Assert —— depth 4 の下に足すと上限を超えるため選ばせない
            expect(parentOptionLabels()).toEqual([
                "Root (no parent)",
                "Assignable",
            ]);
        });

        it("境界値: 自分の子孫が上限を超える親は外す（移動するのはサブツリー全体）", () => {
            // Arrange —— 編集対象 x は高さ 2 のサブツリー（x > y > z）を抱えている。
            // MAX_CATEGORY_DEPTH = 4 なので、x を置ける最深の親は depth 1
            //（1 + 1 + 2 = 4）。depth 2 の下に置くと z が depth 5 になる。
            const x = category({ id: "x", name: "X", url: "x", path: "x" });
            const y = category({
                id: "y",
                name: "Y",
                url: "y",
                parentId: "x",
                path: "x/y",
                depth: 1,
            });
            const z = category({
                id: "z",
                name: "Z",
                url: "z",
                parentId: "y",
                path: "x/y/z",
                depth: 2,
            });
            const shallow = category({
                id: "shallow",
                name: "Shallow",
                url: "shallow",
                path: "a/b",
                depth: 1,
            });
            const tooDeepForSubtree = category({
                id: "deep",
                name: "TooDeepForSubtree",
                url: "too-deep-for-subtree",
                path: "a/b/c",
                depth: 2,
            });

            // Act
            render(
                <CategoryDetails
                    data={x}
                    categories={[x, y, z, shallow, tooDeepForSubtree]}
                />
            );

            // Assert —— 自ノードだけ見れば depth 2 も合法だが、子孫が溢れるので外す。
            // 外さないと保存して初めて upsertCategory の V-7 に弾かれる。
            expect(parentOptionLabels()).toEqual([
                "Root (no parent)",
                "Shallow",
            ]);
        });

        it("正常系: 親を選ぶと parentId が、Root を選ぶと null が入る", async () => {
            // Arrange
            const parent = category({
                id: "parent",
                name: "Fashion",
                url: "f",
            });
            render(<CategoryDetails categories={[parent]} />);

            // Act —— 親を選択
            fireEvent.click(screen.getByRole("option", { name: "Fashion" }));

            // Assert
            await waitFor(() =>
                expect(screen.getByTestId("parent-select")).toHaveAttribute(
                    "data-value",
                    "parent"
                )
            );

            // Act —— Root 番兵は null へ畳む（空文字は Radix Select が扱えない）
            fireEvent.click(
                screen.getByRole("option", { name: "Root (no parent)" })
            );

            // Assert
            await waitFor(() =>
                expect(screen.getByTestId("parent-select")).toHaveAttribute(
                    "data-value",
                    "__root__"
                )
            );
        });
    });

    describe("送信", () => {
        /** 新規作成に必要な入力を埋める。 */
        const fillNewCategory = () => {
            fireEvent.click(screen.getByTestId("image-upload"));
            fireEvent.change(screen.getByLabelText("Category name"), {
                target: { value: "Camera" },
            });
            fireEvent.change(screen.getByLabelText("Category url"), {
                target: { value: "camera" },
            });
        };

        it("正常系: 新規作成は uuid を採番して一覧へ遷移する", async () => {
            // Arrange
            mockUpsertCategory.mockResolvedValue(
                category({ name: "Camera" }) as never
            );
            render(<CategoryDetails />);
            fillNewCategory();

            // Act
            fireEvent.click(
                screen.getByRole("button", { name: "Create category" })
            );

            // Assert
            await waitFor(() =>
                expect(mockUpsertCategory).toHaveBeenCalledWith(
                    expect.objectContaining({
                        id: "generated-uuid",
                        name: "Camera",
                        url: "camera",
                        image: "https://example.com/new.jpg",
                        parentId: null,
                        sortOrder: 0,
                    })
                )
            );
            expect(mockToast).toHaveBeenCalledWith({
                title: "Congratulations! 'Camera' is now created.",
            });
            expect(mockPush).toHaveBeenCalledWith(
                "/dashboard/admin/categories"
            );
            expect(mockRefresh).not.toHaveBeenCalled();
        });

        it("正常系: 更新は既存 id を保ち、遷移せず refresh する", async () => {
            // Arrange
            const existing = category({ id: "cat-1", name: "Camera" });
            mockUpsertCategory.mockResolvedValue(existing as never);
            render(<CategoryDetails data={existing} />);

            // Act
            fireEvent.change(screen.getByLabelText("Category name"), {
                target: { value: "Camera Gear" },
            });
            fireEvent.click(
                screen.getByRole("button", {
                    name: "Save category information",
                })
            );

            // Assert
            await waitFor(() =>
                expect(mockUpsertCategory).toHaveBeenCalledWith(
                    expect.objectContaining({
                        id: "cat-1",
                        name: "Camera Gear",
                    })
                )
            );
            expect(mockToast).toHaveBeenCalledWith({
                title: "Category has been updated.",
            });
            expect(mockRefresh).toHaveBeenCalled();
            expect(mockPush).not.toHaveBeenCalled();
        });

        it("異常系: upsertCategory の失敗はサーバーの文言をそのまま出す", async () => {
            // Arrange —— ツリー検証の拒否理由は admin にそのまま見せる必要がある
            mockUpsertCategory.mockRejectedValue(
                new Error("A category cannot be its own parent.")
            );
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            render(<CategoryDetails />);
            fillNewCategory();

            // Act
            fireEvent.click(
                screen.getByRole("button", { name: "Create category" })
            );

            // Assert
            await waitFor(() =>
                expect(mockToast).toHaveBeenCalledWith({
                    variant: "destructive",
                    title: "Oops!",
                    description: "A category cannot be its own parent.",
                })
            );
            expect(mockPush).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it("異常系: Error 以外が投げられても汎用文言で握らずに表示する", async () => {
            // Arrange —— instanceof Error の else 分岐
            mockUpsertCategory.mockRejectedValue("boom");
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            render(<CategoryDetails />);
            fillNewCategory();

            // Act
            fireEvent.click(
                screen.getByRole("button", { name: "Create category" })
            );

            // Assert
            await waitFor(() =>
                expect(mockToast).toHaveBeenCalledWith({
                    variant: "destructive",
                    title: "Oops!",
                    description: "An unknown error occurred",
                })
            );
            consoleSpy.mockRestore();
        });

        it("異常系: 画像未選択ならサーバーを呼ばずに検証エラーを出す", async () => {
            // Arrange
            render(<CategoryDetails />);
            fireEvent.change(screen.getByLabelText("Category name"), {
                target: { value: "Camera" },
            });
            fireEvent.change(screen.getByLabelText("Category url"), {
                target: { value: "camera" },
            });

            // Act
            fireEvent.click(
                screen.getByRole("button", { name: "Create category" })
            );

            // Assert
            await waitFor(() =>
                expect(
                    screen.getByText("Choose a category image.")
                ).toBeInTheDocument()
            );
            expect(mockUpsertCategory).not.toHaveBeenCalled();
        });

        it("異常系: 選んだ画像を外すとサーバーを呼ばずに検証エラーを出す", async () => {
            // Arrange —— image は length(1) 必須。onRemove は選択済みの 1 枚を
            // フォームから落とすため、その後の送信は必ず弾かれる必要がある。
            render(<CategoryDetails />);
            fireEvent.click(screen.getByTestId("image-upload"));
            fireEvent.change(screen.getByLabelText("Category name"), {
                target: { value: "Camera" },
            });
            fireEvent.change(screen.getByLabelText("Category url"), {
                target: { value: "camera" },
            });

            // Act
            fireEvent.click(screen.getByTestId("image-remove"));
            fireEvent.click(
                screen.getByRole("button", { name: "Create category" })
            );

            // Assert
            await waitFor(() =>
                expect(
                    screen.getByText("Choose a category image.")
                ).toBeInTheDocument()
            );
            expect(mockUpsertCategory).not.toHaveBeenCalled();
        });

        it("異常系: url が正準形でなければサーバーを呼ばない", async () => {
            // Arrange —— `/` や `_` は materialized path のセグメントに使えない
            render(<CategoryDetails />);
            fireEvent.click(screen.getByTestId("image-upload"));
            fireEvent.change(screen.getByLabelText("Category name"), {
                target: { value: "Camera" },
            });
            fireEvent.change(screen.getByLabelText("Category url"), {
                target: { value: "Camera_Gear" },
            });

            // Act
            fireEvent.click(
                screen.getByRole("button", { name: "Create category" })
            );

            // Assert —— 検証完了（メッセージ描画）を待ってから未呼び出しを確認する。
            // 先に not.toHaveBeenCalled() を待つと、検証中でも即座に真になり素通りする。
            await waitFor(() =>
                expect(
                    screen.getByText(/lowercase alphanumeric segments/i)
                ).toBeInTheDocument()
            );
            expect(mockUpsertCategory).not.toHaveBeenCalled();
        });
    });
});
