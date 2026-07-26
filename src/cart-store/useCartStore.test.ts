import { CartProductType } from "@/lib/types";

// localStorage モック
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: jest.fn((key: string) => store[key] ?? null),
        setItem: jest.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
    };
})();
Object.defineProperty(global, "localStorage", { value: localStorageMock });

import { useCartStore } from "./useCartStore";

// テスト用カート商品データ
const createCartProduct = (
    overrides: Partial<CartProductType> = {}
): CartProductType => ({
    productId: "product-001",
    variantId: "variant-001",
    productSlug: "test-product",
    variantSlug: "test-variant",
    name: "Test Product",
    variantName: "Black",
    image: "img.jpg",
    variantImage: "variant.jpg",
    sizeId: "size-001",
    size: "M",
    quantity: 1,
    price: 29.99,
    stock: 10,
    weight: 0.5,
    shippingMethod: "ITEM",
    shippingService: "Standard",
    shippingFee: 5.0,
    extraShippingFee: 2.0,
    deliveryTimeMin: 3,
    deliveryTimeMax: 7,
    isFreeShipping: false,
    ...overrides,
});

beforeEach(() => {
    // 永続化ストレージとインメモリ状態の両方をリセット
    localStorageMock.clear();
    useCartStore.setState({ cart: [], totalItems: 0, totalPrice: 0 });
    jest.clearAllMocks();
});

// ==================================================
// addToCart
// ==================================================
describe("addToCart", () => {
    it("新規商品をカートに追加する", () => {
        const product = createCartProduct();

        useCartStore.getState().addToCart(product);

        const state = useCartStore.getState();
        expect(state.cart).toHaveLength(1);
        expect(state.totalItems).toBe(1);
        expect(state.totalPrice).toBe(29.99);
    });

    it("異なる商品を複数追加する", () => {
        const product1 = createCartProduct({ productId: "p1", price: 10 });
        const product2 = createCartProduct({ productId: "p2", price: 20 });

        useCartStore.getState().addToCart(product1);
        useCartStore.getState().addToCart(product2);

        const state = useCartStore.getState();
        expect(state.cart).toHaveLength(2);
        expect(state.totalItems).toBe(2);
        expect(state.totalPrice).toBe(30);
    });

    it("同一商品（productId+variantId+sizeId）を追加すると数量がマージされる", () => {
        const product = createCartProduct({ quantity: 2, price: 10 });

        useCartStore.getState().addToCart(product);
        useCartStore.getState().addToCart(createCartProduct({ quantity: 3, price: 10 }));

        const state = useCartStore.getState();
        expect(state.cart).toHaveLength(1);
        expect(state.cart[0].quantity).toBe(5);
        expect(state.totalItems).toBe(1); // アイテム数は増えない
        expect(state.totalPrice).toBe(50); // 10 * 2 + 10 * 3
    });

    it("在庫上限を超える場合、在庫数までに制限される", () => {
        const product = createCartProduct({ quantity: 8, stock: 10, price: 10 });

        useCartStore.getState().addToCart(product);
        useCartStore.getState().addToCart(createCartProduct({ quantity: 5, stock: 10, price: 10 }));

        const state = useCartStore.getState();
        expect(state.cart[0].quantity).toBe(10); // stock上限
        expect(state.totalPrice).toBe(100); // 10 * 10
    });

    it("在庫が既に上限の場合、追加しない", () => {
        const product = createCartProduct({ quantity: 10, stock: 10, price: 10 });

        useCartStore.getState().addToCart(product);
        const priceAfterFirst = useCartStore.getState().totalPrice;

        useCartStore.getState().addToCart(createCartProduct({ quantity: 1, stock: 10, price: 10 }));

        const state = useCartStore.getState();
        expect(state.cart[0].quantity).toBe(10);
        expect(state.totalPrice).toBe(priceAfterFirst); // 変化なし
    });

    it("stock=0の商品は追加されない", () => {
        const product = createCartProduct({ stock: 0 });

        useCartStore.getState().addToCart(product);

        const state = useCartStore.getState();
        expect(state.cart).toHaveLength(0);
    });

    it("数量がstockを超える新規追加はstockに丸められる", () => {
        const product = createCartProduct({ quantity: 15, stock: 5, price: 10 });

        useCartStore.getState().addToCart(product);

        const state = useCartStore.getState();
        expect(state.cart[0].quantity).toBe(5);
        expect(state.totalPrice).toBe(50);
    });
});

// ==================================================
// updateProductQuantity
// ==================================================
describe("updateProductQuantity", () => {
    it("商品の数量を更新する", () => {
        const product = createCartProduct({ price: 10 });
        useCartStore.getState().addToCart(product);

        useCartStore.getState().updateProductQuantity(product, 5);

        const state = useCartStore.getState();
        expect(state.cart[0].quantity).toBe(5);
        expect(state.totalPrice).toBe(50);
    });

    it("数量が在庫を超える場合、在庫数に制限される", () => {
        const product = createCartProduct({ stock: 5, price: 10 });
        useCartStore.getState().addToCart(product);

        useCartStore.getState().updateProductQuantity(product, 100);

        const state = useCartStore.getState();
        expect(state.cart[0].quantity).toBe(5);
    });

    it("数量0でカートから削除される", () => {
        const product = createCartProduct({ price: 10 });
        useCartStore.getState().addToCart(product);

        useCartStore.getState().updateProductQuantity(product, 0);

        const state = useCartStore.getState();
        expect(state.cart).toHaveLength(0);
        expect(state.totalPrice).toBe(0);
    });

    it("負の数量でカートから削除される", () => {
        const product = createCartProduct();
        useCartStore.getState().addToCart(product);

        useCartStore.getState().updateProductQuantity(product, -1);

        expect(useCartStore.getState().cart).toHaveLength(0);
    });

    it("totalPriceを全商品で再計算する", () => {
        const product1 = createCartProduct({
            productId: "p1",
            price: 10,
            quantity: 2,
        });
        const product2 = createCartProduct({
            productId: "p2",
            price: 20,
            quantity: 1,
        });
        useCartStore.getState().addToCart(product1);
        useCartStore.getState().addToCart(product2);

        useCartStore.getState().updateProductQuantity(product1, 3);

        const state = useCartStore.getState();
        expect(state.totalPrice).toBe(50); // 10*3 + 20*1
    });
});

// ==================================================
// removeFromCart
// ==================================================
describe("removeFromCart", () => {
    it("指定商品をカートから削除する", () => {
        const product = createCartProduct();
        useCartStore.getState().addToCart(product);

        useCartStore.getState().removeFromCart(product);

        const state = useCartStore.getState();
        expect(state.cart).toHaveLength(0);
        expect(state.totalItems).toBe(0);
        expect(state.totalPrice).toBe(0);
    });

    it("他の商品は残る", () => {
        const product1 = createCartProduct({ productId: "p1", price: 10 });
        const product2 = createCartProduct({ productId: "p2", price: 20 });
        useCartStore.getState().addToCart(product1);
        useCartStore.getState().addToCart(product2);

        useCartStore.getState().removeFromCart(product1);

        const state = useCartStore.getState();
        expect(state.cart).toHaveLength(1);
        expect(state.cart[0].productId).toBe("p2");
        expect(state.totalPrice).toBe(20);
    });

    it("削除後もZustand persistのラッパー形式で保存する", () => {
        const product = createCartProduct();
        useCartStore.getState().addToCart(product);

        useCartStore.getState().removeFromCart(product);

        const raw = localStorage.getItem("cart");
        expect(raw).toBeTruthy();
        const parsed = JSON.parse(raw as string);
        expect(parsed).toHaveProperty("state");
        expect(Array.isArray(parsed)).toBe(false);
        expect(parsed.state.cart).toEqual([]);
    });
});

// ==================================================
// removeMultipleFromCart
// ==================================================
describe("removeMultipleFromCart", () => {
    it("複数商品を一括削除する", () => {
        const product1 = createCartProduct({ productId: "p1", price: 10 });
        const product2 = createCartProduct({ productId: "p2", price: 20 });
        const product3 = createCartProduct({ productId: "p3", price: 30 });
        useCartStore.getState().addToCart(product1);
        useCartStore.getState().addToCart(product2);
        useCartStore.getState().addToCart(product3);

        useCartStore.getState().removeMultipleFromCart([product1, product3]);

        const state = useCartStore.getState();
        expect(state.cart).toHaveLength(1);
        expect(state.cart[0].productId).toBe("p2");
        expect(state.totalPrice).toBe(20);
    });

    it("複数削除後もZustand persistのラッパー形式で保存する", () => {
        const product = createCartProduct();
        useCartStore.getState().addToCart(product);

        useCartStore.getState().removeMultipleFromCart([product]);

        const raw = localStorage.getItem("cart");
        expect(raw).toBeTruthy();
        expect(JSON.parse(raw as string).state.cart).toEqual([]);
    });
});

// ==================================================
// emptyCart
// ==================================================
describe("emptyCart", () => {
    it("カートを空にする", () => {
        useCartStore.getState().addToCart(createCartProduct({ productId: "p1" }));
        useCartStore.getState().addToCart(createCartProduct({ productId: "p2" }));

        useCartStore.getState().emptyCart();

        const state = useCartStore.getState();
        expect(state.cart).toEqual([]);
        expect(state.totalItems).toBe(0);
        expect(state.totalPrice).toBe(0);
    });

    it("空状態をZustand persistのラッパー形式で保存する", () => {
        useCartStore.getState().addToCart(createCartProduct());

        useCartStore.getState().emptyCart();

        const raw = localStorage.getItem("cart");
        expect(raw).toBeTruthy();
        expect(JSON.parse(raw as string).state.cart).toEqual([]);
    });
});

// ==================================================
// setCart
// ==================================================
describe("setCart", () => {
    it("カートを指定内容で置換する", () => {
        const newCart = [
            createCartProduct({ productId: "p1", price: 10, quantity: 2 }),
            createCartProduct({ productId: "p2", price: 20, quantity: 1 }),
        ];

        useCartStore.getState().setCart(newCart);

        const state = useCartStore.getState();
        expect(state.cart).toEqual(newCart);
        expect(state.totalItems).toBe(2);
        expect(state.totalPrice).toBe(40); // 10*2 + 20*1
    });

    it("空配列でカートをリセットする", () => {
        useCartStore.getState().addToCart(createCartProduct());

        useCartStore.getState().setCart([]);

        const state = useCartStore.getState();
        expect(state.cart).toEqual([]);
        expect(state.totalItems).toBe(0);
        expect(state.totalPrice).toBe(0);
    });
});

// ==================================================
// persist ラウンドトリップ（リロード再現）
//
// plan 005 の主張「永続化されたカートはリロード後も復元される」を検証する。
// 上の各 describe は localStorage に書かれた「形」しか見ておらず、その中身が
// 実際に読み戻せるかは未検証だった。
//
// 重要: rehydrate() の前に **インメモリ状態を捨てる**こと。同一ストアインスタンスは
// 変更直後の値を既に保持しているため、状態を残したまま rehydrate() を呼んで
// getState() を見るテストは、rehydrate() が完全な no-op でも通ってしまい、
// 検出対象の回帰では落ちない（plan 005「Corrections to the test steps」参照）。
// ==================================================
describe("persist ラウンドトリップ", () => {
    /**
     * リロードを再現する: 保存済みペイロードを退避 → インメモリ状態を破棄 →
     * ペイロードを書き戻して rehydrate。復元値は storage 由来でしか説明がつかない。
     */
    const reloadFromStorage = async (): Promise<void> => {
        const persisted = localStorage.getItem("cart");
        // null なら書き込み自体が起きていない = 検出すべき回帰。`as string` / `!` で
        // 握りつぶさず早期に失敗させ、同時に型も string へ絞る。
        if (persisted === null) {
            throw new Error("cart was not persisted before rehydrate");
        }

        // setState 自体が persist を走らせて空状態を書くため、退避したペイロードを
        // その後に書き戻す（順序が逆だと空カートを読むだけになる）。
        useCartStore.setState({ cart: [], totalItems: 0, totalPrice: 0 });
        localStorage.setItem("cart", persisted);

        await useCartStore.persist.rehydrate();
    };

    it("追加した商品がリロード後も復元される", async () => {
        const product1 = createCartProduct({ productId: "p1", price: 10 });
        const product2 = createCartProduct({
            productId: "p2",
            price: 20,
            quantity: 2,
        });
        useCartStore.getState().addToCart(product1);
        useCartStore.getState().addToCart(product2);

        await reloadFromStorage();

        const state = useCartStore.getState();
        expect(state.cart).toHaveLength(2);
        expect(state.cart.map((item) => item.productId)).toEqual(["p1", "p2"]);
        expect(state.totalItems).toBe(2);
        expect(state.totalPrice).toBe(50); // 10*1 + 20*2
    });

    it("削除後の残り商品がリロード後も復元される", async () => {
        // 手動 localStorage 書き込みが persist のラッパーを潰していた元バグの経路。
        // 素の配列が書かれていると rehydrate が state を読み出せず、カートは空のまま復元されない。
        const product1 = createCartProduct({ productId: "p1", price: 10 });
        const product2 = createCartProduct({ productId: "p2", price: 20 });
        useCartStore.getState().addToCart(product1);
        useCartStore.getState().addToCart(product2);

        useCartStore.getState().removeFromCart(product1);
        await reloadFromStorage();

        const state = useCartStore.getState();
        expect(state.cart).toHaveLength(1);
        expect(state.cart[0].productId).toBe("p2");
        expect(state.totalItems).toBe(1);
        expect(state.totalPrice).toBe(20);
    });

    it("空にしたカートはリロード後も空のまま（古い内容が甦らない）", async () => {
        useCartStore.getState().addToCart(createCartProduct());

        useCartStore.getState().emptyCart();
        await reloadFromStorage();

        const state = useCartStore.getState();
        expect(state.cart).toEqual([]);
        expect(state.totalItems).toBe(0);
        expect(state.totalPrice).toBe(0);
    });
});
