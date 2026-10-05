import React from "react";
import Link from "next/link";
import { createRoot } from "react-dom/client";
import NewProductPage from "@/app/dashboard/seller/stores/[storeUrl]/products/new/page";
import NewVariantPage from "@/app/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/new/page";
import EditVariantPage from "@/app/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/[variantId]/page";
import SellerShell from "@/components/dashboard/design/seller-shell";
import ModalProvider from "@/providers/modal-provider";
import { Toaster } from "@/components/ui/toaster";

async function preview() {
    const screen = new URLSearchParams(location.search).get("screen");
    const content =
        screen === "editvariant"
            ? await EditVariantPage({
                  params: Promise.resolve({
                      storeUrl: "example",
                      productId: "product-1",
                      variantId: "variant-1",
                  }),
              })
            : screen === "newvariant"
              ? await NewVariantPage({
                    params: Promise.resolve({
                        storeUrl: "example",
                        productId: "product-1",
                    }),
                })
              : await NewProductPage({
                    params: Promise.resolve({ storeUrl: "example" }),
                });
    createRoot(document.getElementById("root")!).render(
        <ModalProvider>
            <SellerShell
                sidebar={
                    <nav aria-label="Store navigation">
                        <Link href="/?screen=product">Create product</Link>
                    </nav>
                }
                header={<span>Example store</span>}
            >
                {content}
                <Toaster />
            </SellerShell>
        </ModalProvider>
    );
}
void preview();
