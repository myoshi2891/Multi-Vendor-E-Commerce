/* Supplemental component fixture: Next adapters and all actions are mocks; no auth/DB writes. */
import React from "react";
import { createRoot } from "react-dom/client";
import FollowingContainer from "@/components/store/profile/following/container";
import HistoryContainer from "@/components/store/profile/history/container";
import { DiscoveryHeading } from "@/components/store/profile/shared/discovery";
import styles from "@/components/store/profile/shared/discovery.module.css";
import type { ProductType } from "@/lib/types";

const parameters = new URLSearchParams(location.search);
const scenario =
    parameters.get("scenario") ??
    (location.pathname.includes("history") ? "history" : "following");
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
let calls = 0;
const fetchHistoryAction = async () => {
    calls++;
    await delay(scenario.includes("pending") ? 10000 : 350);
    if (scenario.includes("error") && calls === 1)
        throw new Error("fixture failure");
    return { products, totalPages: 20 };
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
    localStorage.setItem("productHistory", '["v1","v0"]');
if (scenario.includes("empty")) localStorage.removeItem("productHistory");

createRoot(document.getElementById("root")!).render(
    <main
        className={styles.page}
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
