/* Supplemental component fixture: Next adapters and all actions are mocks; no auth/DB writes. */
import React from "react";
import { createRoot } from "react-dom/client";
import FollowingContainer from "@/components/store/profile/following/container";
import HistoryContainer from "@/components/store/profile/history/container";
import { DiscoveryHeading } from "@/components/store/profile/shared/discovery";
import styles from "@/components/store/profile/shared/discovery.module.css";
import type { ProductType } from "@/lib/types";
import NotificationsPage from "@/app/(store)/profile/notifications/page";
import NotificationList from "@/components/store/profile/notifications/notification-list";
import profileStyles from "@/components/store/profile/profile.module.css";
import type { NotificationListItem } from "@/queries/notification";

import WishlistPage from "@/app/(store)/profile/wishlist/[page]/page";
import WishlistLoading from "@/app/(store)/profile/wishlist/[page]/loading";
import ComparePage from "@/app/(store)/compare/page";
import { useCompareStore } from "@/compare-store/useCompareStore";

const parameters = new URLSearchParams(location.search);
const scenario =
    parameters.get("scenario") ??
    (location.pathname.includes("wishlist") ? "wishlist" : location.pathname.includes("history") ? "history" : "following");
const page =
    Number(location.pathname.split("/").pop()) ||
    Number(parameters.get("page")) ||
    1;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const products: ProductType[] = Array.from({ length: 4 }, (_, i) => ({
    id: `p${i}`,
    slug: `piece-${i}`,
    name: "A beautiful piece with a long name ".repeat(3),
    rating: 0,
    sales: 0,
    numReviews: 0,
    variants: [
        {
            variantId: `v${i}`,
            variantSlug: `v${i}`,
            variantName: "Ivory",
            images: [
                {
                    id: `image${i}`,
                    url: "/assets/brand/star.svg",
                    alt: "Ivory piece",
                    productVariantId: `v${i}`,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ],
            sizes: [
                {
                    id: `size${i}`,
                    size: "One size",
                    price: 45,
                    discount: 0,
                    quantity: 2,
                    productVariantId: `v${i}`,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            ],
        },
    ],
    variantImages: [
        { url: `/product/piece-${i}/v${i}`, image: "/assets/brand/star.svg" },
    ],
}));
const historyTotalPages = 20;
// Saved history order; the action must receive exactly these IDs.
const historyIds = ["v1", "v0", "v3", "v2"];
let calls = 0;
const fetchHistoryAction = async (ids: string[], requestedPage: number) => {
    calls++;
    await delay(scenario.includes("pending") ? 10000 : 350);
    if (scenario.includes("error") && calls === 1)
        throw new Error("fixture failure");
    // The requested page or its canonical clamp is the only valid request.
    if (
        requestedPage !== page &&
        requestedPage !== Math.min(page, historyTotalPages)
    )
        throw new Error(`unexpected history page: ${requestedPage}`);
    if (ids.join() !== historyIds.join())
        throw new Error(`unexpected history ids: ${ids.join()}`);
    return {
        products: ids.map((id) => {
            const product = products.find(
                (item) => item.variants[0].variantId === id
            );
            if (!product) throw new Error(`unknown history id: ${id}`);
            return product;
        }),
        totalPages: historyTotalPages,
    };
};
let followCalls = 0;
let following = true;
const followAction = async () => {
    followCalls++;
    await delay(800);
    if (scenario.includes("error") && followCalls === 1)
        throw new Error("fixture failure");
    following = !following;
    return following;
};
if (!scenario.includes("empty") && scenario.startsWith("history"))
    localStorage.setItem("productHistory", JSON.stringify(historyIds));
if (scenario.includes("empty")) localStorage.removeItem("productHistory");

// 通知一覧（plan 086）。?scenario=notifications | notifications-empty | notifications-error
const notifications: NotificationListItem[] = [
    {
        id: "n1",
        title: "Your items have shipped",
        body: `Items from ${"A boutique with a very long name ".repeat(4)}in order-1 are on the way.`,
        linkUrl: "/order/order-1",
        isRead: false,
        createdAt: "2026-10-07T09:30:00.000Z",
    },
    {
        id: "n2",
        title: "Your items were delivered",
        body: "Items from Acme in order-2 were delivered.",
        linkUrl: "/order/order-2",
        isRead: false,
        createdAt: "2026-10-06T18:00:00.000Z",
    },
    {
        id: "n3",
        title: "Your items have shipped",
        body: "Items from Acme in order-2 are on the way.",
        linkUrl: "/order/order-2",
        isRead: true,
        createdAt: "2026-10-05T08:15:00.000Z",
    },
];
let notificationCalls = 0;
const notificationAction = async () => {
    await delay(800);
    notificationCalls++;
    if (scenario === "notifications-error" || (scenario === "notifications-retry" && notificationCalls === 1)) throw new Error("fixture failure");
    return { count: 1 };
};

const root = createRoot(document.getElementById("root")!);
if (scenario.startsWith("compare")) {
    useCompareStore.setState({items: scenario.includes("empty") ? [] : ["v0", "v1", "v2", "v3"]});
    root.render(<ComparePage />);
} else if (scenario.startsWith("wishlist")) {
    const content = scenario.includes("pending")
        ? Promise.resolve(<WishlistLoading />)
        : WishlistPage({params: Promise.resolve({page: String(page)})});
    void content.then(node => root.render(
        <div className={profileStyles.shell} style={{minHeight: "100vh"}}>
            <main style={{maxWidth: 1050, margin: "auto", padding: "40px 6%"}}>{node}</main>
        </div>
    ));
} else if (scenario === "notifications-fetch-error") {
    void NotificationsPage({searchParams: Promise.resolve({cursor: "12345678-1234-1234-1234-123456789abc"})}).then(node => root.render(
        <div className={profileStyles.shell} style={{minHeight: "100vh"}}><main style={{maxWidth: 1050, margin: "auto", padding: "40px 6%"}}>{node}</main></div>
    ));
} else if (scenario.startsWith("notifications")) {
    root.render(
        <div className={profileStyles.shell} style={{ minHeight: "100vh" }}>
            <main
                style={{ maxWidth: 1050, margin: "auto", padding: "40px 6%" }}
            >
                <NotificationList
                    initialItems={
                        scenario.includes("empty") ? [] : notifications.map(item => scenario.includes("nolink") && item.id === "n2" ? {...item, linkUrl: null} : item)
                    }
                    nextCursor={scenario === "notifications-empty" ? null : "n3"}
                    markReadAction={notificationAction}
                    markAllReadAction={notificationAction}
                />
            </main>
        </div>
    );
} else
    root.render(
        <main
            className={`${profileStyles.shell} ${styles.page}`}
            style={{
                background: "#f3f0e8",
                maxWidth: 1050,
                margin: "auto",
                padding: "40px 6%",
                minHeight: "100vh",
            }}
        >
            <DiscoveryHeading
                title={
                    scenario.startsWith("history")
                        ? "Your product view history"
                        : "Stores you follow"
                }
                description="A little space for your discoveries."
            />
            {scenario.startsWith("history") ? (
                <HistoryContainer
                    page={page}
                    fetchHistoryAction={fetchHistoryAction}
                />
            ) : (
                <FollowingContainer
                    stores={
                        scenario.includes("empty")
                            ? []
                            : [
                                  {
                                      id: "s1",
                                      name: "A boutique with a very long name ".repeat(
                                          5
                                      ),
                                      url: "boutique",
                                      logo: "/assets/brand/star.svg",
                                      followersCount: 12,
                                      isUserFollowingStore: true,
                                  },
                              ]
                    }
                    page={page}
                    totalPages={scenario.includes("empty") ? 0 : 20}
                    followAction={followAction}
                />
            )}
        </main>
    );
