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
import ProductDetails from "@/components/dashboard/forms/product-details";
import { Category, Country, OfferTag, ShippingFeeMethod } from "@prisma/client";
import { ProductWithVariantType } from "@/lib/types";
import { upsertProduct } from "@/queries/product";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

/**
 * seller の商品編集フォーム（`src/components/dashboard/forms/product-details.tsx`）。
 *
 * plan 068 のカットオーバーで、**カテゴリ選択が「カテゴリ + サブカテゴリの 2 段」から
 * ツリー 1 本の選択へ置き換わった**。ここで固定するのはその 2 点:
 *
 * 1. 選択できるのは商品を紐づけられる深さのノードだけ（`isProductAssignableCategory`）。
 *    緩むと upsertProduct 側 V-5 / V-5b で必ず失敗する選択肢を seller が選べてしまう。
 * 2. 選んだリーフから **ルートの categoryId を導出**する。Phase B の Product は旧 2 FK が
 *    NOT NULL のままなので、リーフだけでは書き込めない（導出が落ちると保存が壊れる）。
 *
 * リッチエディタ・タグ入力・日時ピッカー等の外部ウィジェットは jsdom で動かないため、
 * 値を素通しする最小スタブへ差し替える（検証対象はフォームの配線であってウィジェットではない）。
 */

jest.mock("@/queries/product", () => ({ upsertProduct: jest.fn() }));
jest.mock("@/hooks/use-toast");
jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("uuid", () => ({ v4: () => "generated-uuid" }));
jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light" }) }));

// 外部ウィジェットのスタブは「値を素通しする」だけでなく、**渡されたコールバックを
// 発火できる操作面**を持たせる。product-details 側の配線（inline ハンドラ）は
// ウィジェット経由でしか呼ばれないため、ここを潰すと検証不能になる。
jest.mock("jodit-react", () => ({
    __esModule: true,
    default: ({
        value,
        onChange,
        onBlur,
    }: {
        value?: string;
        onChange?: (value: string) => void;
        onBlur?: (value: string) => void;
    }) => (
        <textarea
            data-testid="jodit"
            defaultValue={value}
            onChange={(e) => onChange?.(e.target.value)}
            onBlur={(e) => onBlur?.(e.target.value)}
        />
    ),
}));
jest.mock("react-tag-input", () => ({
    WithOutContext: ({
        handleAddition,
    }: {
        handleAddition: (keyword: { id: string; text: string }) => void;
    }) => (
        <div data-testid="react-tags">
            <button
                type="button"
                data-testid="add-keyword"
                onClick={() =>
                    handleAddition({ id: "added", text: "added-keyword" })
                }
            >
                add keyword
            </button>
        </div>
    ),
}));
jest.mock("react-multi-select-component", () => ({
    MultiSelect: ({
        options,
        onChange,
    }: {
        options: { label: string; value: string }[];
        onChange: (selected: { label: string; value: string }[]) => void;
    }) => (
        <div data-testid="multi-select">
            <button
                type="button"
                data-testid="select-countries"
                onClick={() => onChange(options)}
            >
                select countries
            </button>
        </div>
    ),
}));
jest.mock("react-datetime-picker", () => ({
    __esModule: true,
    default: ({
        value,
        onChange,
    }: {
        value: Date | null;
        onChange: (date: Date | null) => void;
    }) => (
        <div data-testid="datetime-picker">
            <span data-testid="datetime-value">
                {value ? value.toISOString() : "none"}
            </span>
            <button
                type="button"
                data-testid="set-date"
                onClick={() => onChange(new Date(2026, 0, 2, 3, 4, 5))}
            >
                set date
            </button>
            <button
                type="button"
                data-testid="clear-date"
                onClick={() => onChange(null)}
            >
                clear date
            </button>
        </div>
    ),
}));
jest.mock("@tremor/react", () => ({
    NumberInput: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
        <input type="number" {...props} />
    ),
}));
// ImageUpload は商品画像（type="standard"）とバリアント画像（type="profile"）の
// 2 箇所で使われ、onChange / onRemove の中身が別物なので type で撃ち分ける。
jest.mock("@/components/dashboard/shared/image-upload", () => ({
    __esModule: true,
    default: ({
        type,
        value,
        onChange,
        onRemove,
    }: {
        type: string;
        value: string[];
        onChange: (url: string) => void;
        onRemove: (url: string) => void;
    }) => (
        <div data-testid={`image-upload-${type}`}>
            <button
                type="button"
                data-testid={`image-add-${type}`}
                onClick={() =>
                    onChange(`https://example.com/added-${type}.jpg`)
                }
            >
                add image
            </button>
            <button
                type="button"
                data-testid={`image-remove-${type}`}
                onClick={() => onRemove(value[0] ?? "")}
            >
                remove image
            </button>
        </div>
    ),
}));
jest.mock("@/components/dashboard/shared/images-preview-grid", () => ({
    __esModule: true,
    default: ({
        images,
        onRemove,
    }: {
        images: { url: string }[];
        onRemove: (url: string) => void;
    }) => (
        <div data-testid="images-preview-grid">
            {images.map((image, index) => (
                <button
                    key={image.url}
                    type="button"
                    data-testid={`preview-remove-${index}`}
                    onClick={() => onRemove(image.url)}
                >
                    {image.url}
                </button>
            ))}
        </div>
    ),
}));
jest.mock("@/components/dashboard/shared/input-fieldset", () => ({
    __esModule: true,
    default: ({
        label,
        children,
    }: {
        label: string;
        children: React.ReactNode;
    }) => (
        <fieldset>
            <legend>{label}</legend>
            {children}
        </fieldset>
    ),
}));
jest.mock("@/components/dashboard/forms/click-to-add", () => ({
    __esModule: true,
    default: () => <div data-testid="click-to-add" />,
}));

// Radix Select はポインタ操作に依存し jsdom で開けない。選択肢の列挙・disabled 状態と
// onValueChange の配線だけを見たいので、素のボタンへ置き換える。
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
                <div data-value={value}>{children}</div>
            </Ctx.Provider>
        ),
        SelectContent: ({ children }: Children) => <div>{children}</div>,
        SelectTrigger: ({ children }: Children) => <div>{children}</div>,
        SelectValue: ({ placeholder }: { placeholder?: string }) => (
            <span>{placeholder}</span>
        ),
        SelectItem: ({
            children,
            value,
            disabled,
        }: Children & { value: string; disabled?: boolean }) => {
            const onValueChange = react.useContext(Ctx);
            return (
                <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    aria-disabled={disabled ?? false}
                    disabled={disabled}
                    data-value={value}
                    onClick={() => onValueChange(value)}
                >
                    {children}
                </button>
            );
        },
    };
});

const mockUpsertProduct = upsertProduct as jest.MockedFunction<
    typeof upsertProduct
>;

const ROOT_ID = "11111111-1111-4111-8111-111111111111";
const LEAF_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_LEAF_ID = "33333333-3333-4333-8333-333333333333";
const GRANDCHILD_ID = "44444444-4444-4444-8444-444444444444";

/** ツリー列を持つ Category の最小ビルダー。 */
const node = (overrides: Partial<Category>): Category =>
    ({
        id: ROOT_ID,
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
 * ルート / 子 / 孫の 3 階層。
 *
 * 商品を付けられるのは **リーフ（childCount 0）かつ depth 1** のノードだけ
 * （`isProductAssignableCategory`）。この 3 件で 2 条件それぞれの否定を踏む:
 * Electronics は depth 0、Camera は子を持つ、Lens は depth 2。
 */
const categories: Category[] = [
    node({ childCount: 2 }),
    node({
        id: LEAF_ID,
        name: "Camera",
        url: "camera",
        parentId: ROOT_ID,
        path: "electronics/camera",
        depth: 1,
        childCount: 1,
    }),
    node({
        id: OTHER_LEAF_ID,
        name: "Phone",
        url: "phone",
        parentId: ROOT_ID,
        path: "electronics/phone",
        depth: 1,
        childCount: 0,
    }),
    node({
        id: GRANDCHILD_ID,
        name: "Lens",
        url: "lens",
        parentId: LEAF_ID,
        path: "electronics/camera/lens",
        depth: 2,
        childCount: 0,
    }),
];

const offerTags = [
    { id: "offer-1", name: "Sale", url: "sale" },
] as unknown as OfferTag[];
const countries = [
    { id: "country-1", name: "Japan", code: "JP" },
] as unknown as Country[];

/** schema を満たす最小の編集データ（description は 200 文字以上が必須）。 */
const validData = (
    overrides: Partial<ProductWithVariantType> = {}
): Partial<ProductWithVariantType> =>
    ({
        productId: "product-1",
        variantId: "variant-1",
        name: "Camera Body",
        description: "d".repeat(220),
        variantName: "Black",
        variantDescription: "",
        images: [
            { url: "https://example.com/1.jpg" },
            { url: "https://example.com/2.jpg" },
            { url: "https://example.com/3.jpg" },
        ],
        variantImage: "https://example.com/v.jpg",
        categoryId: ROOT_ID,
        subCategoryId: LEAF_ID,
        brand: "Acme",
        sku: "SKU-0001",
        weight: 1.5,
        keywords: ["a", "b", "c", "d", "e"],
        colors: [{ color: "#000000" }],
        sizes: [{ size: "M", quantity: 3, price: 10, discount: 0 }],
        product_specs: [{ name: "spec", value: "value" }],
        variant_specs: [{ name: "vspec", value: "value" }],
        questions: [],
        isSale: false,
        shippingFeeMethod: ShippingFeeMethod.ITEM,
        freeShippingForAllCountries: false,
        freeShippingCountriesIds: [],
        ...overrides,
    }) as Partial<ProductWithVariantType>;

const renderForm = (data?: Partial<ProductWithVariantType>) =>
    render(
        <ProductDetails
            data={data}
            categories={categories}
            offerTags={offerTags}
            countries={countries}
            storeUrl="my-store"
        />
    );

/** カテゴリ選択肢を「ラベル → 選択可否」で取り出す（先頭の全角スペース埋めは除去）。 */
const categoryOptions = (): Record<string, boolean> =>
    Object.fromEntries(
        screen
            .getAllByRole("option")
            .filter((option) =>
                categories.some(
                    (c) => c.id === option.getAttribute("data-value")
                )
            )
            .map((option) => [
                (option.textContent ?? "").replace(/\u00A0/g, ""),
                !(option as HTMLButtonElement).disabled,
            ])
    );

const mockToast = jest.fn();
const mockPush = jest.fn();
const mockRefresh = jest.fn();

describe("ProductDetails", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
        (useRouter as jest.Mock).mockReturnValue({
            push: mockPush,
            refresh: mockRefresh,
        });
    });

    describe("カテゴリ選択（plan 068 のツリー化）", () => {
        it("正常系: 商品を紐づけられる深さのノードだけを選択可能にする", () => {
            // Arrange / Act
            renderForm();

            // Assert —— Phase B では depth 1 のみ（ルートと孫には旧 SubCategory 行が無い）
            expect(categoryOptions()).toEqual({
                Electronics: false, // depth 0（旧 SubCategory 行が無い）
                Camera: false, // 子を持つ = リーフではない（V-5）
                Phone: true,
                Lens: false, // depth 2（旧 SubCategory 行が無い）
            });
        });

        it("正常系: リーフを選ぶとルートの categoryId を導出して保存に載せる", async () => {
            // Arrange —— カテゴリだけ差し替えた編集データ
            mockUpsertProduct.mockResolvedValue({} as never);
            renderForm(
                validData({ categoryId: undefined, subCategoryId: undefined })
            );

            // Act —— 子ノード Phone を選択
            fireEvent.click(screen.getByRole("option", { name: "Phone" }));
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert —— リーフだけでは Product の NOT NULL 2 FK を満たせない
            await waitFor(() =>
                expect(mockUpsertProduct).toHaveBeenCalledWith(
                    expect.objectContaining({
                        categoryId: ROOT_ID,
                        subCategoryId: OTHER_LEAF_ID,
                    }),
                    "my-store"
                )
            );
        });

        it("エッジケース: ツリーに無い id が選ばれても categoryId を書き換えない", async () => {
            // Arrange
            mockUpsertProduct.mockResolvedValue({} as never);
            renderForm(
                validData({
                    subCategoryId: "99999999-9999-4999-8999-999999999999",
                })
            );

            // Act
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert —— 導出できない場合は既存値を保つ（黙って別カテゴリへ移さない）
            await waitFor(() =>
                expect(mockUpsertProduct).toHaveBeenCalledWith(
                    expect.objectContaining({ categoryId: ROOT_ID }),
                    "my-store"
                )
            );
        });
    });

    describe("送信", () => {
        it("正常系: 更新は productId / variantId を保ち、遷移せず refresh する", async () => {
            // Arrange
            mockUpsertProduct.mockResolvedValue({} as never);
            renderForm(validData());

            // Act
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert
            await waitFor(() =>
                expect(mockUpsertProduct).toHaveBeenCalledWith(
                    expect.objectContaining({
                        productId: "product-1",
                        variantId: "variant-1",
                        name: "Camera Body",
                    }),
                    "my-store"
                )
            );
            expect(mockToast).toHaveBeenCalledWith({
                title: "Product has been updated.",
            });
            expect(mockRefresh).toHaveBeenCalled();
            expect(mockPush).not.toHaveBeenCalled();
        });

        it("正常系: 新規作成は uuid を採番して商品一覧へ遷移する", async () => {
            // Arrange —— productId / variantId を持たない = 新規
            mockUpsertProduct.mockResolvedValue({} as never);
            renderForm(
                validData({ productId: undefined, variantId: undefined })
            );

            // Act
            fireEvent.click(screen.getByRole("button", { name: /Create/i }));

            // Assert
            await waitFor(() =>
                expect(mockUpsertProduct).toHaveBeenCalledWith(
                    expect.objectContaining({
                        productId: "generated-uuid",
                        variantId: "generated-uuid",
                    }),
                    "my-store"
                )
            );
            expect(mockToast).toHaveBeenCalledWith({
                title: "Congratulations! Product is now created.",
            });
            expect(mockPush).toHaveBeenCalledWith(
                "/dashboard/seller/stores/my-store/products"
            );
        });

        it("正常系: 空の色プレースホルダーは保存前に落とす", async () => {
            // Arrange —— ClickToAddInputs の初期行は空文字で残る
            mockUpsertProduct.mockResolvedValue({} as never);
            renderForm(
                validData({ colors: [{ color: "#000000" }, { color: "  " }] })
            );

            // Act
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert
            await waitFor(() =>
                expect(mockUpsertProduct).toHaveBeenCalledWith(
                    expect.objectContaining({ colors: [{ color: "#000000" }] }),
                    "my-store"
                )
            );
        });

        it("異常系: upsertProduct の失敗はサーバーの文言をそのまま出す", async () => {
            // Arrange —— V-5 の拒否理由は seller にそのまま見せる必要がある
            mockUpsertProduct.mockRejectedValue(
                new Error("Products can only be attached to leaf categories.")
            );
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            renderForm(validData());

            // Act
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert
            await waitFor(() =>
                expect(mockToast).toHaveBeenCalledWith({
                    variant: "destructive",
                    title: "Oops!",
                    description:
                        "Products can only be attached to leaf categories.",
                })
            );
            expect(mockRefresh).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it("異常系: Error 以外が投げられても汎用文言で表示する", async () => {
            // Arrange —— instanceof Error の else 分岐
            mockUpsertProduct.mockRejectedValue("boom");
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            renderForm(validData());

            // Act
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

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

        it("異常系: 必須項目が欠けていればサーバーを呼ばない", async () => {
            // Arrange —— description が 200 文字未満
            renderForm(validData({ description: "too short" }));

            // Act
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert
            await waitFor(() =>
                expect(
                    screen.getByText(/at least 200 characters/i)
                ).toBeInTheDocument()
            );
            expect(mockUpsertProduct).not.toHaveBeenCalled();
        });
    });

    describe("画像ウィジェットの配線", () => {
        it("正常系: ImageUpload の onChange で商品画像を 1 枚足す", async () => {
            // Arrange
            mockUpsertProduct.mockResolvedValue({} as never);
            renderForm(validData());

            // Act
            fireEvent.click(screen.getByTestId("image-add-standard"));
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert —— setImages と field.onChange の両方に反映される必要がある
            await waitFor(() =>
                expect(mockUpsertProduct).toHaveBeenCalledWith(
                    expect.objectContaining({
                        images: [
                            { url: "https://example.com/1.jpg" },
                            { url: "https://example.com/2.jpg" },
                            { url: "https://example.com/3.jpg" },
                            { url: "https://example.com/added-standard.jpg" },
                        ],
                    }),
                    "my-store"
                )
            );
        });

        it("正常系: ImagesPreviewGrid の onRemove で商品画像を落とす", async () => {
            // Arrange —— 3 枚必須なので 4 枚から 1 枚落とす
            mockUpsertProduct.mockResolvedValue({} as never);
            renderForm(
                validData({
                    images: [
                        { url: "https://example.com/1.jpg" },
                        { url: "https://example.com/2.jpg" },
                        { url: "https://example.com/3.jpg" },
                        { url: "https://example.com/4.jpg" },
                    ],
                })
            );

            // Act
            fireEvent.click(screen.getByTestId("preview-remove-0"));
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert
            await waitFor(() =>
                expect(mockUpsertProduct).toHaveBeenCalledWith(
                    expect.objectContaining({
                        images: [
                            { url: "https://example.com/2.jpg" },
                            { url: "https://example.com/3.jpg" },
                            { url: "https://example.com/4.jpg" },
                        ],
                    }),
                    "my-store"
                )
            );
        });

        it("異常系: 商品画像を 3 枚未満にすると保存させない", async () => {
            // Arrange
            renderForm(validData());

            // Act —— ImageUpload 側の onRemove（field.value から除去）
            fireEvent.click(screen.getByTestId("image-remove-standard"));
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert
            await waitFor(() =>
                expect(
                    screen.getByText(/at least 3 images/i)
                ).toBeInTheDocument()
            );
            expect(mockUpsertProduct).not.toHaveBeenCalled();
        });

        it("正常系: バリアント画像は onChange で 1 枚に差し替わる", async () => {
            // Arrange —— variantImage は length(1) 固定なので上書きセマンティクス
            mockUpsertProduct.mockResolvedValue({} as never);
            renderForm(validData());

            // Act
            fireEvent.click(screen.getByTestId("image-add-profile"));
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert
            await waitFor(() =>
                expect(mockUpsertProduct).toHaveBeenCalledWith(
                    expect.objectContaining({
                        variantImage: "https://example.com/added-profile.jpg",
                    }),
                    "my-store"
                )
            );
        });

        it("異常系: バリアント画像を外すと保存させない", async () => {
            // Arrange
            renderForm(validData());

            // Act
            fireEvent.click(screen.getByTestId("image-remove-profile"));
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert
            await waitFor(() =>
                expect(
                    screen.getByText(/Choose a variant image/i)
                ).toBeInTheDocument()
            );
            expect(mockUpsertProduct).not.toHaveBeenCalled();
        });
    });

    describe("キーワード", () => {
        const keywords = (count: number) =>
            Array.from({ length: count }, (_, i) => `kw-${i}`);

        it("正常系: 追加したキーワードが保存に載る", async () => {
            // Arrange
            mockUpsertProduct.mockResolvedValue({} as never);
            renderForm(validData({ keywords: keywords(5) }));

            // Act
            fireEvent.click(screen.getByTestId("add-keyword"));
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert
            await waitFor(() =>
                expect(mockUpsertProduct).toHaveBeenCalledWith(
                    expect.objectContaining({
                        keywords: [...keywords(5), "added-keyword"],
                    }),
                    "my-store"
                )
            );
        });

        it("エッジケース: 10 件に達したら追加を黙って無視する", async () => {
            // Arrange —— schema の max(10) に触れる前にハンドラ側で止める
            mockUpsertProduct.mockResolvedValue({} as never);
            renderForm(validData({ keywords: keywords(10) }));

            // Act
            fireEvent.click(screen.getByTestId("add-keyword"));
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert —— 11 件目は入らず、バリデーションエラーにもならない
            await waitFor(() =>
                expect(mockUpsertProduct).toHaveBeenCalledWith(
                    expect.objectContaining({ keywords: keywords(10) }),
                    "my-store"
                )
            );
        });

        it("正常系: チップの x で該当キーワードだけ落とす", async () => {
            // Arrange —— min(5) を割らないよう 6 件から 1 件落とす
            mockUpsertProduct.mockResolvedValue({} as never);
            renderForm(validData({ keywords: keywords(6) }));

            // Act —— チップ内の x（同じ文字が国チップにもあるので chip 内に限定）
            const chip = screen.getByText("kw-0").closest("div");
            fireEvent.click(within(chip as HTMLElement).getByText("x"));
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert
            await waitFor(() =>
                expect(mockUpsertProduct).toHaveBeenCalledWith(
                    expect.objectContaining({
                        keywords: ["kw-1", "kw-2", "kw-3", "kw-4", "kw-5"],
                    }),
                    "my-store"
                )
            );
        });
    });

    describe("説明エディタ", () => {
        it("正常系: 商品説明の onChange が保存値へ反映される", async () => {
            // Arrange
            mockUpsertProduct.mockResolvedValue({} as never);
            renderForm(validData());
            const edited = "x".repeat(240);

            // Act
            fireEvent.change(screen.getByTestId("jodit"), {
                target: { value: edited },
            });
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert
            await waitFor(() =>
                expect(mockUpsertProduct).toHaveBeenCalledWith(
                    expect.objectContaining({ description: edited }),
                    "my-store"
                )
            );
        });

        it("正常系: バリアント説明タブの onChange が保存値へ反映される", async () => {
            // Arrange —— Radix Tabs は非アクティブ側を描画しないので切り替える
            mockUpsertProduct.mockResolvedValue({} as never);
            renderForm(validData());

            // Act
            // Radix Tabs は click ではなく mousedown / focus で切り替わる
            // （activationMode="automatic"）。click だけだと選択が動かない。
            const variantTab = screen.getByRole("tab", {
                name: /Variant description/i,
            });
            fireEvent.mouseDown(variantTab);
            fireEvent.focus(variantTab);
            fireEvent.change(screen.getByTestId("jodit"), {
                target: { value: "variant only note" },
            });
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert
            await waitFor(() =>
                expect(mockUpsertProduct).toHaveBeenCalledWith(
                    expect.objectContaining({
                        variantDescription: "variant only note",
                    }),
                    "my-store"
                )
            );
        });
    });

    describe("セール終了日", () => {
        it("正常系: 選んだ日時をピッカーへ返す", () => {
            // Arrange —— isSale が false だとピッカー自体が描画されない
            renderForm(validData({ isSale: true }));

            // Act
            fireEvent.click(screen.getByTestId("set-date"));

            // Assert —— format() → new Date() の往復でローカル日時が保たれる
            expect(screen.getByTestId("datetime-value")).toHaveTextContent(
                new Date(2026, 0, 2, 3, 4, 5).toISOString()
            );
        });

        it("エッジケース: クリアすると値を空にする", () => {
            // Arrange
            renderForm(validData({ isSale: true }));
            fireEvent.click(screen.getByTestId("set-date"));

            // Act —— onChange(null) 側の三項分岐
            fireEvent.click(screen.getByTestId("clear-date"));

            // Assert
            expect(screen.getByTestId("datetime-value")).toHaveTextContent(
                "none"
            );
        });
    });

    describe("無料配送の対象国", () => {
        it("正常系: MultiSelect の選択がそのまま保存に載る", async () => {
            // Arrange
            mockUpsertProduct.mockResolvedValue({} as never);
            renderForm(validData());

            // Act
            fireEvent.click(screen.getByTestId("select-countries"));
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert —— countries prop が label/value 形式へ写像されている
            await waitFor(() =>
                expect(mockUpsertProduct).toHaveBeenCalledWith(
                    expect.objectContaining({
                        freeShippingCountriesIds: [
                            { label: "Japan", value: "country-1" },
                        ],
                    }),
                    "my-store"
                )
            );
        });

        it("正常系: 国チップの x で該当国だけ外す", async () => {
            // Arrange
            mockUpsertProduct.mockResolvedValue({} as never);
            renderForm(
                validData({
                    freeShippingCountriesIds: [
                        { id: "fs-1", label: "Japan", value: "country-1" },
                        { id: "fs-2", label: "France", value: "country-2" },
                    ],
                } as Partial<ProductWithVariantType>)
            );

            // Act
            const chip = screen.getByText("Japan").closest("div");
            fireEvent.click(within(chip as HTMLElement).getByText("x"));
            fireEvent.click(screen.getByRole("button", { name: /Save/i }));

            // Assert
            await waitFor(() =>
                expect(mockUpsertProduct).toHaveBeenCalledWith(
                    expect.objectContaining({
                        freeShippingCountriesIds: [
                            { id: "fs-2", label: "France", value: "country-2" },
                        ],
                    }),
                    "my-store"
                )
            );
        });
    });
});
