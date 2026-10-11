import SellerMessagesContainer from "@/components/dashboard/seller/seller-messages-container";
import type {
    SellerConversation,
    SellerMessageActions,
} from "@/lib/seller-messages";
import SellerOrders from "@/components/dashboard/seller/seller-orders";
import type { SellerOrderRow, SellerOrderActions } from "@/lib/seller-orders";
import SellerInventory from "@/components/dashboard/seller/seller-inventory";
import SellerProducts from "@/components/dashboard/seller/seller-products";
import type { StoreProductRow } from "@/lib/seller-products";
import StoreOverview from "@/components/dashboard/seller/store-overview";
import type { ComponentProps } from "react";
import applicationStyles from "@/components/store/forms/apply-seller/application.module.css";
import Apply from "@/components/store/forms/apply-seller/apply-seller";
import type { applySeller } from "@/queries/store";
import ProfileSettingsPage from "@/app/(store)/profile/settings/page";
import Link from "next/link";
import React from "react";
import { createRoot } from "react-dom/client";
import SellerShell from "@/components/dashboard/design/seller-shell";
import Header from "@/components/dashboard/header/Header";
import styles from "@/components/dashboard/design/seller.module.css";
import ModalProvider from "@/providers/modal-provider";

const sidebar = (
    <nav aria-label="Store navigation">
        <p className={styles.eyebrow}>Seller workspace</p>
        <Link href="/?screen=overview">Overview</Link>
        <br />
        <Link href="/?screen=products">Products</Link>
        <br />
        <Link href="/?screen=inventory">Inventory</Link>
        <br />
        <Link href="/?screen=orders">Orders</Link>
        <br />
        <Link href="/?screen=messages">Messages</Link>
    </nav>
);
const productRows = [
    {
        id: "p1",
        name: "A long product name for testing responsive wrapping in the seller product table",
        brand: "Example",
        store: { url: "example" },
        category: { name: "Accessories" },
        subCategory: { name: "Watches" },
        offerTag: null,
        variants: [
            {
                id: "v1",
                variantName: "Gold variant",
                colors: [{ name: "gold" }],
                images: [],
                sizes: [{ id: "s1", size: "M", quantity: 3, price: 12.5 }],
            },
        ],
    },
] as StoreProductRow[];
let productDeleteAttempts = 0;
const productActions: ComponentProps<typeof SellerProducts>["actions"] = {
    deleteProductAction: async () => {
        await new Promise((r) => setTimeout(r, 300));
        if (++productDeleteAttempts === 1) throw new Error("Fixture failure");
        return productRows[0] as unknown as Awaited<
            ReturnType<
                ComponentProps<
                    typeof SellerProducts
                >["actions"]["deleteProductAction"]
            >
        >;
    },
    upsertProductAction: async () => {},
    getAttributeDefinitionsAction: async () => [],
};
const inventoryRows = [0, 3, 10].map((quantity, index) => ({
    sizeId: `size-${index}`,
    productName: `Stock product ${index}`,
    variantName: "Gold",
    size: "M",
    quantity,
    price: 12.5,
    sku: `SKU-${index}`,
    productSlug: "product",
    variantId: "variant",
}));
let stockAttempts = 0,
    thresholdAttempts = 0;
const stockAction: ComponentProps<
    typeof SellerInventory
>["updateStockAction"] = async (sizeId, quantity) => {
    await new Promise((r) => setTimeout(r, 300));
    if (++stockAttempts === 1) throw new Error("Fixture failure");
    return { sizeId, quantity };
};
const thresholdAction: ComponentProps<
    typeof SellerInventory
>["updateThresholdAction"] = async (_, threshold) => {
    await new Promise((r) => setTimeout(r, 300));
    if (++thresholdAttempts === 1) throw new Error("Fixture failure");
    return { lowStockThreshold: threshold };
};
const orderRows: SellerOrderRow[] = [
    {
        id: "order-1",
        storeId: "store-1",
        status: "Pending",
        total: 19.9,
        paymentStatus: "Paid",
        shippingService: "Standard shipping",
        deliveryRange: "Oct 8 - Oct 10",
        paymentMethod: "Card",
        paymentReference: "payment-1",
        address: "A long shipping address, Tokyo, Japan",
        customer: "Example Buyer, 123456789, buyer@example.test",
        items: [
            {
                id: "item-1",
                name: "A long order product name with responsive wrapping",
                image: "",
                sku: "SKU-1",
                size: "M",
                quantity: 1,
                status: "Pending",
                price: 12.5,
                shippingFee: 7.4,
                totalPrice: 19.9,
            },
        ],
    },
];
let groupAttempts = 0,
    itemAttempts = 0;
const orderActions: SellerOrderActions = {
    updateGroupAction: async () => {
        await new Promise((r) => setTimeout(r, 300));
        if (++groupAttempts === 1) throw new Error("Fixture failure");
        return {} as Awaited<
            ReturnType<SellerOrderActions["updateGroupAction"]>
        >;
    },
    updateItemAction: async () => {
        await new Promise((r) => setTimeout(r, 300));
        if (++itemAttempts === 1) throw new Error("Fixture failure");
        return {} as Awaited<
            ReturnType<SellerOrderActions["updateItemAction"]>
        >;
    },
};
const conversations: SellerConversation[] = [
    {
        id: "conv-1",
        userId: "buyer",
        updatedAt: "2026-10-05T00:00:00Z",
        store: { name: "Example", logo: "" },
        user: {
            name: "A long customer name for responsive wrapping",
            picture: "",
        },
        unreadLatest: true,
        messages: [{ content: "Hello from the buyer" }],
    },
];
let messageLoads = 0,
    readAttempts = 0,
    sendAttempts = 0;
const threadMessages = [
    {
        id: "m1",
        senderId: "buyer",
        content: "Hello from the buyer",
        createdAt: "2026-10-05T00:00:00Z",
    },
    {
        id: "m2",
        senderId: "seller",
        content:
            "Hello from the store. " + "Long message wrapping. ".repeat(20),
        createdAt: "2026-10-05T00:01:00Z",
    },
];
const messageActions: SellerMessageActions = {
    loadConversationsAction: async () => {
        await new Promise((r) => setTimeout(r, 300));
        return conversations;
    },
    loadMessagesAction: async () => {
        await new Promise((r) => setTimeout(r, 300));
        if (++messageLoads === 1) throw new Error("Fixture failure");
        return [...threadMessages];
    },
    markReadAction: async () => {
        await new Promise((r) => setTimeout(r, 300));
        if (++readAttempts === 1) throw new Error("Fixture failure");
        return { count: 1 };
    },
    sendMessageAction: async (_, content) => {
        await new Promise((r) => setTimeout(r, 300));
        if (++sendAttempts === 1) throw new Error("Fixture failure");
        threadMessages.push({
            id: "sent",
            senderId: "seller",
            content,
            createdAt: "2026-10-05T00:02:00Z",
        });
        return { id: "sent" };
    },
};
let applyAttempts = 0;
const applyAction: typeof applySeller = async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (++applyAttempts === 1) throw new Error("Fixture failure");
    return { id: "fixture-store" } as Awaited<ReturnType<typeof applySeller>>;
};
const screen = new URLSearchParams(location.search).get("screen");
createRoot(document.getElementById("root")!).render(
    screen === "apply" ? (
        <div className={applicationStyles.page}>
            <Apply applySellerAction={applyAction} />
        </div>
    ) : screen === "settings" ? (
        <main>
            <ProfileSettingsPage />
        </main>
    ) : (
        <ModalProvider>
            <SellerShell sidebar={sidebar} header={<Header design="seller" />}>
                {screen === "messages" ? (
                    <SellerMessagesContainer
                        initialConversations={
                            new URLSearchParams(location.search).has("empty") ||
                            new URLSearchParams(location.search).has("error")
                                ? []
                                : conversations
                        }
                        initialError={new URLSearchParams(location.search).has(
                            "error"
                        )}
                        {...messageActions}
                    />
                ) : screen === "orders" ? (
                    <SellerOrders orders={orderRows} actions={orderActions} />
                ) : screen === "inventory" ? (
                    <SellerInventory
                        rows={inventoryRows}
                        threshold={5}
                        storeUrl="example"
                        updateStockAction={stockAction}
                        updateThresholdAction={thresholdAction}
                    />
                ) : screen === "products" ? (
                    <SellerProducts
                        products={productRows}
                        categories={[]}
                        countries={[]}
                        offerTags={[]}
                        storeUrl="example"
                        actions={productActions}
                    />
                ) : screen === "overview" ? (
                    <StoreOverview
                        stats={{
                            totalRevenue: new URLSearchParams(location.search).has("large") ? Number.MAX_SAFE_INTEGER : 1234.5,
                            totalOrders: 2,
                            totalViews: 500,
                            totalSales: 3,
                            totalProducts: 1,
                            lowStockCount: 0,
                        }}
                        salesData={
                            new URLSearchParams(location.search).has("empty")
                                ? []
                                : [
                                      { label: "Jan", revenue: 10 },
                                      { label: "Feb", revenue: 30 },
                                      { label: "Mar", revenue: 20 },
                                  ]
                        }
                        recentOrders={[]}
                        topProducts={
                            [
                                {
                                    id: "p1",
                                    name: "A very long product name that should wrap inside the store overview without horizontal overflow",
                                    sales: 3,
                                },
                            ] as ComponentProps<
                                typeof StoreOverview
                            >["topProducts"]
                        }
                    />
                ) : (
                    <section className={styles.page}>
                        <header className={styles.heading}>
                            <p className={styles.eyebrow}>Seller workspace</p>
                            <h1>Store overview</h1>
                            <p className={styles.description}>
                                Manage your store.
                            </p>
                        </header>
                        <div className={styles.panel}>
                            Responsive brand foundation
                        </div>
                    </section>
                )}
            </SellerShell>
        </ModalProvider>
    )
);
