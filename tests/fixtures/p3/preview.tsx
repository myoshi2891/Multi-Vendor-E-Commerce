import Link from "next/link";
import React from "react";
import { createRoot } from "react-dom/client";
import Page from "@/app/dashboard/admin/page";
import Shell from "@/components/dashboard/design/seller-shell";
import ThemeToggle from "@/components/shared/theme-toggle";
import ModalProvider from "@/providers/modal-provider";
async function preview() {
    const content = await Page();
    createRoot(document.getElementById("root")!).render(
        <ModalProvider>
            <Shell
                navigationLabel="Administration navigation"
                sidebar={
                    <nav aria-label="Administration">
                        <Link href="/?screen=overview">Overview</Link>
                        <Link href="/?screen=orders">Orders</Link>
                    </nav>
                }
                header={<ThemeToggle design="seller" />}
            >
                {content}
            </Shell>
        </ModalProvider>
    );
}
void preview();
