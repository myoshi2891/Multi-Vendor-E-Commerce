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

    it("localStorageに同期する", () => {
        const product = createCartProduct();
        useCartStore.getState().addToCart(product);

        useCartStore.getState().removeFromCart(product);

        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            "cart",
            JSON.stringify([])
        );
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

    it("localStorageに同期する", () => {
        const product = createCartProduct();
        useCartStore.getState().addToCart(product);

        useCartStore.getState().removeMultipleFromCart([product]);

        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            "cart",
            JSON.stringify([])
        );
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

    it("localStorageからcartを削除する", () => {
        useCartStore.getState().addToCart(createCartProduct());

        useCartStore.getState().emptyCart();

        expect(localStorageMock.removeItem).toHaveBeenCalledWith("cart");
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
