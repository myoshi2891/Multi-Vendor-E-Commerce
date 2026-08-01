"use server";

import { db } from "@/lib/db";
import { parseUserCountryCookie, toNumberSafe } from "@/lib/utils";
import { isCouponCurrentlyValid } from "@/lib/coupon-utils";
import { serializeCart } from "@/lib/serialize-cart";
import { retryOnSerializationFailure } from "@/lib/db-retry";
import { CartItem, Country as CountryDB, Prisma } from "@prisma/client";
import { CartProductType, SerializedCartType, Country } from "@/lib/types";
import { currentUser } from "@clerk/nextjs/server";
import { requireUser } from "@/lib/auth-guards";
import { getCookie } from "cookies-next";
import { cookies } from "next/headers";
import {
    getDeliveryDetailsForStoreByCountry,
    getProductShippingFee,
    getShippingDetails,
} from "./product";
import { ShippingAddress } from "@prisma/client";

/**
 * `placeOrder` の注文トランザクションに課す実行時間上限。
 *
 * Prisma の interactive transaction は既定で `maxWait 2s` / `timeout 5s`。
 * 注文トランザクションはカート消費 → 住所の `SELECT … FOR UPDATE` → 商品取得 →
 * 店舗ごとの OrderGroup / OrderItem 作成 → 在庫の条件付き減算 → 合計確定、と
 * 書き込みが多く、**注文点数に比例して伸びる**。既定の 5s を超えると P2028 で
 * ロールバックし、ユーザーには注文失敗として返る。
 *
 * 上限を明示するのは可読性のためだけではない。このトランザクションは住所行の
 * 排他ロックを保持するため、**timeout は並行チェックアウトが待たされる時間の
 * 上限でもある**。暗黙の既定値に委ねてよい値ではない。
 *
 * - `timeout`: 大きめの注文でも通るよう既定 5s → 20s。DB 側で無限に居座らせない
 *   ための天井であって、通常の所要時間ではない。
 * - `maxWait`: プールから接続を待つ上限。既定 2s のままだと接続が逼迫した瞬間に
 *   注文が落ちるため 5s へ。
 */
const ORDER_TRANSACTION_OPTIONS = {
    maxWait: 5_000,
    timeout: 20_000,
} as const;

/**
 * カート検証で読み込む Product の関連込みペイロード型。
 *
 * `variants` / `sizes` は `where` で 1 件に絞り込むが、`where` は payload の型に
 * 影響しないため include の形だけを与える。saveUserCart / placeOrder /
 * updateCartWithLatest / updateCheckoutProductWithLatest の 4 経路が同じ形を共有する。
 */
type CartValidatedProduct = Prisma.ProductGetPayload<{
    include: {
        store: true;
        freeShipping: { include: { eligibleCountries: true } };
        variants: { include: { sizes: true; images: true } };
    };
}>;

type CartValidatedVariant = CartValidatedProduct["variants"][number];
type CartValidatedSize = CartValidatedVariant["sizes"][number];

/**
 * productId / variantId / sizeId の組み合わせで商品を引き、その variant と size が
 * 実在することまで検証する。
 *
 * include は静的にできない —— `variants.where.id` と `sizes.where.id` に引数を
 * 差し込むため、定数ではなく関数内で組み立てる必要がある。
 *
 * **ここでは throw しない**。呼び出し元ごとに投げるメッセージが異なり
 * （saveUserCart / placeOrder は id を含む詳細版、updateCartWithLatest /
 * updateCheckoutProductWithLatest は簡易版）、いずれも既存テストが固定している
 * 契約であるため、メッセージの決定は呼び出し元に残す。
 *
 * @returns 3 つすべてが実在すれば `{ product, variant, size }`、いずれか欠ければ `null`
 */
const findCartProductWithVariantAndSize = async (
    productId: string,
    variantId: string,
    sizeId: string
): Promise<{
    product: CartValidatedProduct;
    variant: CartValidatedVariant;
    size: CartValidatedSize;
} | null> => {
    const product = await db.product.findUnique({
        where: {
            id: productId,
        },
        include: {
            store: true,
            freeShipping: {
                include: {
                    eligibleCountries: true,
                },
            },
            variants: {
                where: {
                    id: variantId,
                },
                include: {
                    sizes: {
                        where: {
                            id: sizeId,
                        },
                    },
                    images: true,
                },
            },
        },
    });

    if (
        !product ||
        product.variants.length === 0 ||
        product.variants[0].sizes.length === 0
    ) {
        return null;
    }

    const variant = product.variants[0];
    return { product, variant, size: variant.sizes[0] };
};

/**
 * 割引後の単価を Prisma.Decimal で算出する。
 *
 * tech.md の「金額を number で積み上げない」に従い、除算まで Decimal のまま行う。
 * `discount` は Float であり `0`（= 割引なし）は falsy として元価格をそのまま返す
 * 既存の truthy 判定を維持している。
 */
const calculateDiscountedUnitPrice = (
    price: Prisma.Decimal,
    discount: number
): Prisma.Decimal =>
    discount
        ? new Prisma.Decimal(price.toString())
              .mul(new Prisma.Decimal((100 - discount).toString()))
              .div("100")
        : new Prisma.Decimal(price.toString());

/**
 * 配送先の国から明細 1 行分の配送料を Decimal で確定する
 * （saveUserCart / placeOrder 共通）。
 *
 * `getShippingDetails` は国が見つからないとき `boolean` を返す仕様のため、
 * 型ガードで弾いて既定値（すべて 0）に留める既存の挙動をそのまま保持する。
 *
 * NOTE: `product.ts` の `getProductShippingFee` に寄せてはならない。あちらは
 * 無料配送時に `shippingRate.findFirst` を発行しないためクエリ形状が変わり、
 * `user.test.ts` は両者を別々にモックしている。
 *
 * @param country - `null` の場合は配送料を算出せず 0 を返す（Cookie 未設定など）
 */
const resolveCartShippingFee = async (
    product: CartValidatedProduct,
    country: Country | null,
    weight: number,
    quantity: number
): Promise<Prisma.Decimal> => {
    let details = {
        shippingFee: 0,
        extraShippingFee: 0,
        isFreeShipping: false,
    };

    if (country) {
        const temp_details = await getShippingDetails(
            product.shippingFeeMethod,
            country,
            product.store,
            product.freeShipping
        );
        if (typeof temp_details !== "boolean") {
            details = temp_details;
        }
    }

    const { shippingFeeMethod } = product;

    if (shippingFeeMethod === "ITEM") {
        return quantity === 1
            ? new Prisma.Decimal(details.shippingFee)
            : new Prisma.Decimal(details.shippingFee).add(
                  new Prisma.Decimal(details.extraShippingFee).mul(quantity - 1)
              );
    }
    if (shippingFeeMethod === "WEIGHT") {
        return new Prisma.Decimal(details.shippingFee)
            .mul(weight)
            .mul(quantity);
    }
    if (shippingFeeMethod === "FIXED") {
        return new Prisma.Decimal(details.shippingFee);
    }
    return new Prisma.Decimal("0");
};

/**
 * 検証済みカート明細（saveUserCart / placeOrder が Cart / Order へ書き込む形）を
 * 組み立てる。
 *
 * `productId` / `variantId` / `sizeId` は DB エンティティではなく入力キーから取る。
 * クエリが同じ id で絞っている以上値は一致するが、既存コードと同一の出所を保つ。
 *
 * `variant.images[0].url` にはあえて optional chaining を入れない。画像 0 件で
 * TypeError になる現行の挙動を維持する（防御の追加は挙動変更にあたる）。
 */
const buildValidatedCartItem = (
    key: { productId: string; variantId: string; sizeId: string },
    product: CartValidatedProduct,
    variant: CartValidatedVariant,
    size: CartValidatedSize,
    quantity: number,
    price: Prisma.Decimal,
    shippingFee: Prisma.Decimal
) => {
    const validQuantityObj = new Prisma.Decimal(quantity.toString());
    const shippingFeeObj = new Prisma.Decimal(shippingFee.toString());
    const totalPrice = price.mul(validQuantityObj).add(shippingFeeObj);

    return {
        productId: key.productId,
        variantId: key.variantId,
        productSlug: product.slug,
        variantSlug: variant.slug,
        sizeId: key.sizeId,
        storeId: product.storeId,
        sku: variant.sku,
        name: `${product.name} ・ ${variant.variantName}`,
        image: variant.images[0].url,
        size: size.size,
        quantity,
        price,
        shippingFee,
        totalPrice,
    };
};

/**
 * @name followStore
 * @description - Toggle follow status for a store by the current user.1
 *              - If the user is already following the store, unfollow it.
 *              - If the user is not following the store, follow it.
 * @access User
 * @param storeId - The ID of the store to be followed or unfollowed.
 * @returns {boolean} - Returns true if the follow status was updated successfully, false otherwise.
 */
export const followStore = async (storeId: string): Promise<boolean> => {
    try {
        // Get the current authenticated user
        const user = await currentUser();

        // Ensure user is authenticated
        if (!user) throw new Error("Unauthenticated.");

        // Check if the store exists
        const store = await db.store.findUnique({ where: { id: storeId } });
        if (!store) throw new Error("Store not found."); // Store does not exist, cannot follow or unfollow

        // Check if the user exists
        const userData = await db.user.findUnique({ where: { id: user.id } });
        if (!userData) throw new Error("User not found."); // User does not exist, cannot follow or unfollow

        // Check if the user is already following the store
        const userFollowingStore = await db.user.findFirst({
            where: {
                id: user.id,
                following: {
                    some: {
                        id: storeId,
                    },
                },
            },
        });

        if (userFollowingStore) {
            // Unfollow the store and return false
            await db.store.update({
                where: {
                    id: storeId,
                },
                data: {
                    followers: {
                        disconnect: { id: userData.id },
                    },
                },
            });
            return false;
        } else {
            // Follow the store and return true
            await db.store.update({
                where: {
                    id: storeId,
                },
                data: {
                    followers: {
                        connect: { id: userData.id },
                    },
                },
            });
            return true; // Follow status updated successfully
        }
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error following store:", error.message, error.stack);
        } else {
            console.error("Error following store:", error);
        }
        throw new Error("Error following store");
    }
};

/**
 * @Function saveUserCart
 * @Description Saves the user's cart by validating product data from the database and ensuring no frontend manipulation.
 * @PermissionLevel User who owns the cart
 * @Parameters
 * - cartProducts: An array of product objects from the frontend cart.
 * @Returns {boolean}
 * - An object containing the updated cart with recalculated total price and validated product data.
 */

export const saveUserCart = async (
    cartProducts: CartProductType[]
): Promise<boolean> => {
    try {
        // Get current user
        const user = await currentUser();

        // Ensure user is authenticated
        if (!user) throw new Error("Unauthenticated.");

        const userId = user.id;

        // Fetch product, variant, and size data from the database for validation
        const validatedCartItems = await Promise.all(
            cartProducts.map(async (cartProduct) => {
                const { productId, variantId, sizeId, quantity } = cartProduct;

                // Fetch the product, variant, and size from the database
                const found = await findCartProductWithVariantAndSize(
                    productId,
                    variantId,
                    sizeId
                );

                if (!found) {
                    throw new Error(
                        `Invalid product, variant, or size combination for productId ${productId}, variantId ${variantId}, sizeId ${sizeId}`
                    );
                }

                const { product, variant, size } = found;

                // Validate stock and price
                const validQuantity = Math.min(quantity, size.quantity);

                const priceObj = calculateDiscountedUnitPrice(
                    size.price,
                    size.discount
                );

                // Calculate shipping details
                const countryCookie = getCookie("userCountry", { cookies }) as
                    | string
                    | undefined;

                const shippingFee = await resolveCartShippingFee(
                    product,
                    countryCookie
                        ? parseUserCountryCookie(countryCookie)
                        : null,
                    variant.weight,
                    validQuantity
                );

                return buildValidatedCartItem(
                    { productId, variantId, sizeId },
                    product,
                    variant,
                    size,
                    validQuantity,
                    priceObj,
                    shippingFee
                );
            })
        );

        // Recalculate the cart's total price and shipping fees
        const subTotal = validatedCartItems.reduce(
            (acc, item) =>
                acc.add(
                    new Prisma.Decimal(item.price.toString()).mul(item.quantity)
                ),
            new Prisma.Decimal("0")
        );

        const shippingFee = validatedCartItems.reduce(
            (acc, item) => acc.add(item.shippingFee),
            new Prisma.Decimal("0")
        );

        const total = subTotal.add(shippingFee);

        // 検証成功後に既存カートを置換する。削除と作成を同一トランザクションに入れ、
        // 作成に失敗した場合も既存カートが失われないようにする。
        //
        // Cart.userId は @unique。同一ユーザーの並行保存では、削除と作成が交錯して
        // delete の P2025 / create の P2002 で正当なリクエストが落ちうる。
        // Serializable で DB 側に直列化させ、deleteMany で削除を冪等にする
        // （他リクエストが先に削除済みでも count:0 が返るだけで失敗しない）。
        //
        // Serializable は競合を「やり直せるエラー(P2034)」へ変換するだけなので、
        // 再試行と組み合わせて初めて正当なリクエストを守れる。トランザクション全体を
        // 再実行対象にする（部分適用による二重適用を避けるため）。
        const cart = await retryOnSerializationFailure(() =>
            db.$transaction(
                async (tx) => {
                    await tx.cart.deleteMany({
                        where: {
                            userId,
                        },
                    });

                    // Save the validated items to the cart in the database
                    return tx.cart.create({
                        data: {
                            cartItems: {
                                create: validatedCartItems.map((item) => ({
                                    productId: item.productId,
                                    variantId: item.variantId,
                                    sizeId: item.sizeId,
                                    storeId: item.storeId,
                                    sku: item.sku,
                                    productSlug: item.productSlug,
                                    variantSlug: item.variantSlug,
                                    name: item.name,
                                    image: item.image,
                                    quantity: item.quantity,
                                    size: item.size,
                                    price: item.price,
                                    shippingFee: item.shippingFee,
                                    totalPrice: item.totalPrice,
                                })),
                            },
                            shippingFees: shippingFee,
                            subTotal,
                            total,
                            userId,
                        },
                    });
                },
                {
                    isolationLevel:
                        Prisma.TransactionIsolationLevel.Serializable,
                }
            )
        );

        if (cart) return true;
        return false;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error saving user cart:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error saving user cart:", error);
        }
        throw error;
    }
};

/**
 * @Function getUserShippingAddresses
 * @Description Retrieves all shipping addresses from a specific user.
 * @PermissionLevel User who owns the addresses
 * @Parameters None
 * @Returns List of shipping addresses associated with the user.
 */

export const getUserShippingAddresses = async () => {
    try {
        // Get current user
        const user = await currentUser();

        // Ensure user is authenticated
        if (!user) throw new Error("Unauthenticated.");

        // Fetch shipping addresses from the database
        const shippingAddresses = await db.shippingAddress.findMany({
            where: {
                userId: user.id,
            },
            include: {
                user: true,
                country: true,
            },
        });

        return shippingAddresses;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error fetching shipping addresses:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error fetching shipping addresses:", error);
        }
        throw error;
    }
};

/**
 * @Function upsertShippingAddress
 * @Description Upserts a shipping address for a specific user.
 * @PermissionLevel User who owns the addresses
 * @Parameters - address: ShippingAddress object containing details of the shipping address to be upserted.
 * @Returns Updated or newly created shipping address details.
 */

export const upsertShippingAddress = async (address: ShippingAddress) => {
    try {
        // Get current user
        const user = await currentUser();

        // Ensure user is authenticated
        if (!user) throw new Error("Unauthenticated.");

        // Ensure address data is provide
        if (!address) throw new Error("Please provide shipping address data.");

        // Handle making the rest of address default false when we are adding a new default
        if (address.default) {
            const addressDB = await db.shippingAddress.findUnique({
                where: {
                    id: address.id,
                },
            });
            if (addressDB) {
                try {
                    await db.shippingAddress.updateMany({
                        where: {
                            userId: user.id,
                            default: true,
                        },
                        data: {
                            default: false,
                        },
                    });
                } catch (error: unknown) {
                    if (error instanceof Error) {
                        console.error(
                            "Error updating default addresses:",
                            error.message,
                            error.stack
                        );
                    } else {
                        console.error(
                            "Error updating default addresses:",
                            error
                        );
                    }
                    throw new Error("Error making the default address.");
                }
            }
        }

        // 所有権検証付きの upsert（他ユーザーのアドレス上書き防止）
        const existing = await db.shippingAddress.findFirst({
            where: { id: address.id, userId: user.id },
        });

        let upsertedAddresses;
        if (existing) {
            upsertedAddresses = await db.shippingAddress.update({
                where: { id: address.id },
                data: { ...address, userId: user.id },
            });
        } else {
            upsertedAddresses = await db.shippingAddress.create({
                data: { ...address, userId: user.id },
            });
        }

        return upsertedAddresses;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error upserting shipping addresses:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error upserting shipping addresses:", error);
        }
        throw error;
    }
};

/**
 * @Function placeOrder
 * @Description Places orders for a specific user.
 * @PermissionLevel User who owns the addresses
 * @Parameters - shippingAddress: ShippingAddress object containing details of the shipping address for the order.
 *  - cartId: ID of the cart to place the order for.
 * @Return Updated or newly created order details.
 */

export const placeOrder = async (
    shippingAddress: ShippingAddress,
    cartId: string
): Promise<{ orderId: string }> => {
    try {
        // Ensure the user is authenticated
        const user = await currentUser();
        if (!user) throw new Error("Unauthenticated.");

        const userId = user.id;

        // Fetch user's cart will all items（userId で所有権検証）
        const cart = await db.cart.findUnique({
            where: { id: cartId, userId },
            include: {
                cartItems: true,
                coupon: true,
            },
        });

        if (!cart) throw new Error("Cart not found.");

        // shippingAddress の所有権検証（IDOR 防止: 他ユーザーの住所 id を注文に付けさせない）
        const ownedAddress = await db.shippingAddress.findFirst({
            where: { id: shippingAddress.id, userId },
        });
        if (!ownedAddress) throw new Error("Shipping address not found.");

        const cartItems = cart.cartItems;
        const cartCoupon = cart.coupon; // The coupon, if it exists

        // Fetch product, variant, and size data from the database for validation
        const validatedCartItems = await Promise.all(
            cartItems.map(async (cartProduct) => {
                const { productId, variantId, sizeId, quantity } = cartProduct;

                // Fetch the product, variant, and size from the database
                const found = await findCartProductWithVariantAndSize(
                    productId,
                    variantId,
                    sizeId
                );

                if (!found) {
                    throw new Error(
                        `Invalid product, variant, or size combination for productId ${productId}, variantId ${variantId}, sizeId ${sizeId}`
                    );
                }

                const { product, variant, size } = found;

                // Validate stock and price
                const validQuantity = Math.min(quantity, size.quantity);

                const priceObj = calculateDiscountedUnitPrice(
                    size.price,
                    size.discount
                );

                // Calculate shipping details
                // 所有権検証済みの ownedAddress（サーバー値）を使う。
                // クライアント供給の shippingAddress.countryId は改ざん可能なため信頼しない。
                const countryId = ownedAddress.countryId;

                const temp_country = await db.country.findUnique({
                    where: {
                        id: countryId,
                    },
                });

                if (!temp_country) {
                    throw new Error(
                        `Failed to get Shipping details for order.`
                    );
                }

                const country = {
                    name: temp_country.name,
                    code: temp_country.code,
                    city: "",
                    region: "",
                };

                const shippingFee = await resolveCartShippingFee(
                    product,
                    country,
                    variant.weight,
                    validQuantity
                );

                return buildValidatedCartItem(
                    { productId, variantId, sizeId },
                    product,
                    variant,
                    size,
                    validQuantity,
                    priceObj,
                    shippingFee
                );
            })
        );

        // console.log('validatedCartItems', validatedCartItems)

        // Define the type for grouped items by store
        type GroupedItems = { [storeId: string]: typeof validatedCartItems };

        // Group validated items by store
        const groupedItems = validatedCartItems.reduce<GroupedItems>(
            (acc, item) => {
                if (!acc[item.storeId]) acc[item.storeId] = [];
                acc[item.storeId].push(item);
                return acc;
            },
            {} as GroupedItems
        );

        // 事前にdelivery詳細を全store分取得（トランザクション外）
        const deliveryDetailsMap = new Map<
            string,
            {
                shippingService: string | undefined;
                deliveryTimeMin: number | undefined;
                deliveryTimeMax: number | undefined;
            }
        >();
        const storeIds = Object.keys(groupedItems);
        const deliveryResults = await Promise.all(
            storeIds.map((storeId) =>
                getDeliveryDetailsForStoreByCountry(
                    storeId,
                    ownedAddress.countryId
                )
            )
        );
        storeIds.forEach((storeId, index) => {
            deliveryDetailsMap.set(storeId, deliveryResults[index]);
        });

        // 全DB操作をトランザクションでラップ（上限は ORDER_TRANSACTION_OPTIONS）
        const order = await db.$transaction(async (tx) => {
            // 冪等性ゲート: カート行を「単一使用トークン」として消費する。
            //
            // place-order.tsx の isPlacingOrderRef はクライアント側ガードにすぎず、
            // Server Action を直接叩けば迂回できる。ここで注文作成より前に条件付き削除を
            // 行うと、カート行の行ロックで並行リクエストが直列化され、削除に成功した
            // 1 リクエストだけが注文へ進む（count === 0 側は下で throw してロールバック）。
            //
            // 在庫不足等で tx がロールバックすればカート削除も巻き戻るため、ユーザーは
            // 再試行できる。CartItem は Cart から onDelete: Cascade で連鎖削除される。
            // 条件式は在庫減算の check-and-decrement（下の tx.size.updateMany）と同じ
            // 「条件付き書き込み + count 判定」イディオム。
            const consumed = await tx.cart.deleteMany({
                where: { id: cartId, userId },
            });
            if (consumed.count === 0) throw new Error("Cart not found.");

            // TOCTOU 閉塞: shippingAddressId を書く「直前」に、同一 tx 内で所有権を
            // **行ロック付きで** 再検証する。tx 外の findFirst（上部の所有権チェック）から
            // order.create までの間には商品取得・配送料計算など長い非同期処理があり、
            // その隙に住所が **別ユーザーへ再割当て** されると、FK は有効なまま他人の住所を
            // 注文に付けられてしまう。
            //
            // 素の SELECT（findFirst）では足りない。削除経路は FK が閉じる —— order.create の
            // INSERT が参照先 ShippingAddress 行へ FOR KEY SHARE を取り、DELETE と競合する
            // ため並行削除は commit までブロックされる。しかし userId 付け替えは参照キー列を
            // 触らないので FOR NO KEY UPDATE となり、FOR KEY SHARE と **競合しない**。
            // 行ロックを取らない再読み取りは窓を縮めるだけで、Read Committed 下では
            // 再読み取りと order.create の間に付け替えが commit されうる。
            //
            // FOR UPDATE は FOR NO KEY UPDATE と競合するため、並行付け替えはこの tx の
            // commit までブロックされる。さらにロック取得後に PostgreSQL が述語を再評価
            // （EvalPlanQual）するので、先に付け替えが commit していた場合は行が脱落し、
            // 下の length === 0 で throw に落ちる。Prisma の fluent API はロック句を
            // 表現できないため $queryRaw を使う（値は常にパラメータ化される）。
            const lockedAddress = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "ShippingAddress"
            WHERE "id" = ${ownedAddress.id} AND "userId" = ${userId}
            FOR UPDATE
        `;
            if (lockedAddress.length === 0)
                throw new Error("Shipping address not found.");

            // Create the order
            const order = await tx.order.create({
                data: {
                    userId,
                    shippingAddressId: lockedAddress[0].id,
                    orderStatus: "Pending",
                    paymentStatus: "Pending",
                    shippingFees: 0,
                    subTotal: 0,
                    total: 0,
                },
            });

            // Iterate over each store's items and create OrderGroup and OrderItems
            let orderTotalPrice = new Prisma.Decimal("0");
            let orderShippingFee = new Prisma.Decimal("0");

            // PLATFORM スコープのクーポンはカート全体の割引総額を先に算出し、
            // 最終グループで「総割引 − Σ確定済グループ割引」を割り当てて端数を吸収する（判断5-4）
            const cartCouponValid = cartCoupon
                ? isCouponCurrentlyValid(cartCoupon)
                : false;
            const isPlatformCoupon =
                cartCoupon?.scope === "PLATFORM" && cartCouponValid;
            const cartTotalPrice = validatedCartItems.reduce(
                (acc, item) => acc.add(item.totalPrice),
                new Prisma.Decimal("0")
            );
            const platformTotalDiscount =
                isPlatformCoupon && cartCoupon
                    ? cartTotalPrice.mul(cartCoupon.discount).div(100)
                    : new Prisma.Decimal("0");
            let cumulativePlatformDiscount = new Prisma.Decimal("0");

            // 端数吸収するストアが実行ごとにブレないよう、storeId でソートして決定論的な順序にする
            const storeEntries = Object.entries(groupedItems).sort(([a], [b]) =>
                a.localeCompare(b)
            );

            for (const [index, [storeId, items]] of storeEntries.entries()) {
                // Calculate store-specific totals
                const groupedTotalPrice = items.reduce(
                    (acc, item) => acc.add(item.totalPrice),
                    new Prisma.Decimal("0")
                );

                const groupShippingFee = items.reduce(
                    (acc, item) => acc.add(item.shippingFee),
                    new Prisma.Decimal("0")
                );

                const deliveryDetails = deliveryDetailsMap.get(storeId);
                const shippingService = deliveryDetails?.shippingService;
                const deliveryTimeMin = deliveryDetails?.deliveryTimeMin;
                const deliveryTimeMax = deliveryDetails?.deliveryTimeMax;

                // Check coupon scope/store and validity（isActive=false または期間外のクーポンは割引不適用）
                const check =
                    isPlatformCoupon ||
                    (storeId === cartCoupon?.storeId && cartCouponValid);

                // Calculate discount based on coupon
                let discountedAmount = new Prisma.Decimal("0");
                if (check && cartCoupon) {
                    if (isPlatformCoupon && index === storeEntries.length - 1) {
                        discountedAmount = platformTotalDiscount.sub(
                            cumulativePlatformDiscount
                        );
                    } else {
                        discountedAmount = groupedTotalPrice
                            .mul(cartCoupon.discount)
                            .div(100);
                        if (isPlatformCoupon) {
                            cumulativePlatformDiscount =
                                cumulativePlatformDiscount.add(
                                    discountedAmount
                                );
                        }
                    }
                }

                // Calculate the total after applying the discount
                const totalAfterDiscount =
                    groupedTotalPrice.sub(discountedAmount);

                // Create an OrderGroup for this store
                const orderGroup = await tx.orderGroup.create({
                    data: {
                        orderId: order.id,
                        storeId,
                        status: "Pending",
                        subTotal: groupedTotalPrice.sub(groupShippingFee),
                        shippingFees: groupShippingFee,
                        total: totalAfterDiscount,
                        shippingService:
                            shippingService || "International Delivery",
                        shippingDeliveryMin: deliveryTimeMin || 7,
                        shippingDeliveryMax: deliveryTimeMax || 30,
                        couponId: check && cartCoupon ? cartCoupon?.id : null,
                    },
                });

                // Create OrderItems for this OrderGroup
                for (const item of items) {
                    await tx.orderItem.create({
                        data: {
                            orderGroupId: orderGroup.id,
                            productId: item.productId,
                            variantId: item.variantId,
                            sizeId: item.sizeId,
                            productSlug: item.productSlug,
                            variantSlug: item.variantSlug,
                            sku: item.sku,
                            name: item.name,
                            image: item.image,
                            size: item.size,
                            quantity: item.quantity,
                            price: item.price,
                            shippingFee: item.shippingFee,
                            totalPrice: item.totalPrice,
                        },
                    });

                    // F3: 在庫のアトミック減算（check-and-decrement）
                    // 条件付き updateMany で「読み取り → 減算」を単一 UPDATE に畳み込み、
                    // count===0（条件を満たす行なし）を在庫不足として検知する（TOCTOU レース回避）。
                    // 減算量は確定済み item.quantity（= validQuantity, L494 のクランプ値）を使う。
                    const stock = await tx.size.updateMany({
                        where: {
                            id: item.sizeId,
                            quantity: { gte: item.quantity },
                        },
                        data: { quantity: { decrement: item.quantity } },
                    });
                    if (stock.count === 0) {
                        // $transaction 全体をロールバック（部分確定なし）
                        throw new Error("在庫が不足しています");
                    }
                }

                // Update order totals
                orderTotalPrice = orderTotalPrice.add(totalAfterDiscount);
                orderShippingFee = orderShippingFee.add(groupShippingFee);
            }

            // Update the main order with the final totals
            await tx.order.update({
                where: {
                    id: order.id,
                },
                data: {
                    subTotal: orderTotalPrice.sub(orderShippingFee),
                    shippingFees: orderShippingFee,
                    total: orderTotalPrice,
                },
            });

            return order;
        }, ORDER_TRANSACTION_OPTIONS);

        return { orderId: order.id };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                `Error in placeOrder (cartId: ${cartId}):`,
                error.message,
                error.stack
            );
        } else {
            console.error(`Error in placeOrder (cartId: ${cartId}):`, error);
        }
        throw error;
    }
};

export const emptyUserCart = async () => {
    try {
        // Ensure the user is authenticated
        const user = await currentUser();
        if (!user) throw new Error("Unauthenticated.");

        const userId = user.id;

        // placeOrder が注文トランザクション内でカートを消費済みの場合があるため、
        // delete（対象なしで P2025）ではなく deleteMany を使い冪等にする。
        // 「カートを空にする」操作は結果状態が同じなら成功とみなしてよい。
        await db.cart.deleteMany({
            where: {
                userId,
            },
        });

        return true;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error in emptyUserCart:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error in emptyUserCart:", error);
        }
        throw error;
    }
};

/**
 * @Function updateCartWithLatest
 * @Description Updates the cart with the latest product, variant, and size data
 * @PermissionLevel Authenticated
 * @Parameters  cartProducts: CartProductType[]
 *  - productId: The ID of the product to update the cart with.
 * @returns CartProductType[]
 */
export const updateCartWithLatest = async (
    cartProducts: CartProductType[]
): Promise<CartProductType[]> => {
    // Fetch product, variant, and size data from the database for validation
    const validatedCartItems = await Promise.all(
        cartProducts.map(async (cartProduct) => {
            const { productId, variantId, sizeId, quantity } = cartProduct;

            // Fetch the product, variant, and size from the database
            const found = await findCartProductWithVariantAndSize(
                productId,
                variantId,
                sizeId
            );

            if (!found) {
                // return cartProduct
                throw new Error(
                    `Product not found or variant or size not found.`
                );
            }
            const { product, variant, size } = found;

            // Calculate Shipping details
            const countryCookie = getCookie("userCountry", { cookies }) as
                | string
                | undefined;

            let details = {
                shippingService: product.store.defaultShippingService,
                shippingFee: 0,
                extraShippingFee: 0,
                isFreeShipping: false,
                deliveryTimeMin: 0,
                deliveryTimeMax: 0,
            };

            if (countryCookie) {
                const country = parseUserCountryCookie(countryCookie);
                const temp_details = await getShippingDetails(
                    product.shippingFeeMethod,
                    country,
                    product.store,
                    product.freeShipping
                );

                if (typeof temp_details !== "boolean") {
                    details = temp_details;
                }
            }

            const priceNumber = toNumberSafe(size.price);
            const price = size.discount
                ? priceNumber - (priceNumber * size.discount) / 100
                : priceNumber;

            const validated_qty = Math.min(quantity, size.quantity);

            return {
                productId,
                variantId,
                productSlug: product.slug,
                variantSlug: variant.slug,
                sizeId,
                sku: variant.sku,
                name: product.name,
                variantName: variant.variantName,
                image: variant.images[0].url,
                variantImage: variant.variantImage,
                stock: size.quantity,
                weight: variant.weight,
                shippingMethod: product.shippingFeeMethod,
                size: size.size,
                quantity: validated_qty,
                price: price,
                shippingService: details.shippingService,
                shippingFee: details.shippingFee,
                extraShippingFee: details.extraShippingFee,
                deliveryTimeMin: details.deliveryTimeMin,
                deliveryTimeMax: details.deliveryTimeMax,
                isFreeShipping: details.isFreeShipping,
            };
        })
    );
    return validatedCartItems;
};

/**
 * Add a product to the user's wishlist.
 * @param productId - The ID of the product to add to the wishlist.
 * @param variantId - The ID of the variant of the product.
 * @param sizeId - Optional size ID if applicable.
 * @returns The created wishlist item.
 */
export const addToWishlist = async (
    productId: string,
    variantId: string,
    sizeId?: string
) => {
    try {
        // Ensure the user is authenticated
        const user = await currentUser();
        if (!user) throw new Error("Unauthenticated.");

        const userId = user.id;
        // Create the wishlist item
        const existingWishlistItem = await db.wishlist.findFirst({
            where: {
                userId,
                productId,
                variantId,
            },
        });

        if (existingWishlistItem) {
            throw new Error("Product is already in the wishlist.");
        }

        return await db.wishlist.create({
            data: {
                userId,
                productId,
                variantId,
                sizeId,
            },
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(
                "Error in addToWishlist:",
                error.message,
                error.stack
            );
        } else {
            console.error("Error in addToWishlist:", error);
        }
        throw error;
    }
};

/**
 * @Function updateCheckoutProductWithLatest
 * @Description Keeps the cart in sync with the latest info (price, quantity, shipping fee, etc.)
 * @PermissionLevel Authenticated
 * @Parameters
 *  - cartProducts: An array of product objects from the frontend cart
 *  - address: Country
 * @Return
 *  - An object containing the updated cart with recalculated total price and validated product data
 */

export const updateCheckoutProductWithLatest = async (
    cartProducts: Pick<
        CartItem,
        "id" | "cartId" | "productId" | "variantId" | "sizeId" | "quantity"
    >[],
    address: CountryDB | undefined
): Promise<SerializedCartType> => {
    if (cartProducts.length === 0)
        throw new Error("No cart products provided.");
    const user = await requireUser();

    const cartId = cartProducts[0].cartId;
    // payload 整合性: 全 item が単一 cartId に属すること（複数カート混在を拒否）
    if (cartProducts.some((p) => p.cartId !== cartId)) {
        throw new Error("Unauthorized: cart items belong to multiple carts.");
    }

    // 所有権 + 実在 cartItem を権威ソースとして取得（id だけで update する前のガード）
    const ownedCart = await db.cart.findFirst({
        where: { id: cartId, userId: user.id },
        include: { cartItems: { select: { id: true } } },
    });
    if (!ownedCart)
        throw new Error("Unauthorized: cart does not belong to current user.");

    // cartProduct.id が実際にこのカートに属することを検証（他カートの item.id 混入による IDOR を防止）
    const ownedItemIds = new Set(ownedCart.cartItems.map((item) => item.id));
    if (cartProducts.some((p) => !ownedItemIds.has(p.id))) {
        throw new Error(
            "Unauthorized: cart item does not belong to current user."
        );
    }

    // Fetch product, variant, and size data from the database for validation
    const validatedCartItems = await Promise.all(
        cartProducts.map(async (cartProduct) => {
            const { productId, variantId, sizeId, quantity } = cartProduct;

            // Fetch the product, variant, and size from the database
            const found = await findCartProductWithVariantAndSize(
                productId,
                variantId,
                sizeId
            );

            if (!found) {
                // return cartProduct
                throw new Error(
                    `Product not found or variant or size not found.`
                );
            }

            const { product, variant, size } = found;

            // Calculate Shipping details
            const countryCookie = getCookie("userCountry", { cookies }) as
                | string
                | undefined;

            const country: Country | null = address
                ? {
                      name: address.name,
                      code: address.code,
                      city: "",
                      region: "",
                  }
                : countryCookie
                  ? parseUserCountryCookie(countryCookie)
                  : null;

            if (!country) {
                throw new Error("Couldn't retrieve country data.");
            }

            const { shippingFeeMethod, freeShipping, store } = product;

            const priceObj = calculateDiscountedUnitPrice(
                size.price,
                size.discount
            );

            const validated_qty = Math.min(quantity, size.quantity);

            let shippingFee = new Prisma.Decimal("0");

            const fee = await getProductShippingFee(
                shippingFeeMethod,
                country,
                store,
                freeShipping,
                variant.weight,
                validated_qty
            );

            if (!fee.isZero()) {
                shippingFee = fee;
            }

            const totalPrice = priceObj.mul(validated_qty).add(shippingFee);

            try {
                const newCartItem = await db.cartItem.update({
                    where: {
                        id: cartProduct.id,
                    },
                    data: {
                        name: `${product.name} ・ ${variant.variantName}`,
                        image: variant.images[0].url,
                        price: priceObj,
                        quantity: validated_qty,
                        shippingFee,
                        totalPrice,
                    },
                });
                return newCartItem;
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error(
                        `Error updating cart item (id: ${cartProduct.id}):`,
                        error.message,
                        error.stack
                    );
                } else {
                    console.error(
                        `Error updating cart item (id: ${cartProduct.id}):`,
                        error
                    );
                }
                throw error;
            }
        })
    );

    // Apply coupon if exist
    const cartCoupon = await db.cart.findUnique({
        where: {
            id: cartId,
        },
        select: {
            coupon: {
                include: {
                    store: true,
                },
            },
        },
    });
    // Recalculate the cart's total price and shipping fees
    const subTotal = validatedCartItems.reduce(
        (acc, item) =>
            acc.add(
                new Prisma.Decimal(item.price.toString()).mul(item.quantity)
            ),
        new Prisma.Decimal("0")
    );
    const shippingFees = validatedCartItems.reduce(
        (acc, item) => acc.add(item.shippingFee),
        new Prisma.Decimal("0")
    );
    let total = subTotal.add(shippingFees);

    // Apply coupon discount if applicable
    if (cartCoupon?.coupon) {
        const { coupon } = cartCoupon;

        if (isCouponCurrentlyValid(coupon)) {
            // PLATFORM スコープは全item対象、STORE スコープは対象店舗のみ
            const isPlatform = coupon.scope === "PLATFORM";
            const applicableStoreItems = isPlatform
                ? validatedCartItems
                : validatedCartItems.filter(
                      (item) => item.storeId === coupon.storeId
                  );

            if (applicableStoreItems.length > 0) {
                // Calculate subTotal for the coupon's store (including shipping fees)
                const storeSubTotal = applicableStoreItems.reduce(
                    (acc, item) =>
                        acc
                            .add(
                                new Prisma.Decimal(item.price.toString()).mul(
                                    item.quantity
                                )
                            )
                            .add(item.shippingFee),
                    new Prisma.Decimal("0")
                );
                // Apply coupon discount to the store's subTotal
                const discountedAmount = storeSubTotal
                    .mul(new Prisma.Decimal(coupon.discount.toString()))
                    .div("100");
                total = total.sub(discountedAmount);
            }
        }
    }

    const cart = await db.cart.update({
        where: {
            id: cartId,
        },
        data: {
            subTotal,
            shippingFees,
            total,
        },
        include: {
            cartItems: true,
            coupon: {
                include: {
                    store: true,
                },
            },
        },
    });

    if (!cart) throw new Error("Something went wrong while updating the cart.");

    return serializeCart(cart);
};
