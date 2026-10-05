import React from "react";
import Link from "next/link";
import { createRoot } from "react-dom/client";
import NewProductPage from "@/app/dashboard/seller/stores/[storeUrl]/products/new/page";
import SellerShell from "@/components/dashboard/design/seller-shell";
import ModalProvider from "@/providers/modal-provider";
import { Toaster } from "@/components/ui/toaster";

async function preview() {
    const content = await NewProductPage({
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
