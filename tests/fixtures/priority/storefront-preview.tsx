import React from "react";
import About from "@/app/(store)/about/page";
import Contact from "@/app/(store)/contact/page";
import Faqs from "@/app/(store)/faqs/page";
import ProductSupport from "@/app/(store)/product-support/page";

/** Production page bodies; support submission is adapted by the existing priority server. */
export function storefrontPreview(scenario: string) {
    if (scenario.startsWith("storefront-contact")) return <Contact />;
    if (scenario === "storefront-faqs") return <Faqs />;
    if (scenario === "storefront-product-support") return <ProductSupport />;
    return <About />;
}
