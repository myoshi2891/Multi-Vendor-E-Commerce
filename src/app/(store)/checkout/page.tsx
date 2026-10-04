import CheckoutContainer from "@/components/store/checkout-page/container";
import { db } from "@/lib/db";
import { parseUserCountryCookie } from "@/lib/utils";
import { serializeCart } from "@/lib/serialize-cart";
import {
    getUserShippingAddresses,
    updateCheckoutProductWithLatest,
    placeOrder,
    emptyUserCart,
    saveProfileShippingAddress,
    makeProfileShippingAddressDefault,
} from "@/queries/user";
import { applyCoupon } from "@/queries/coupon";
import styles from "@/components/store/shared/commerce.module.css";
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Renders the checkout page for the current user.
 *
 * Redirects to `/cart` when the user is not signed in or does not have a cart.
 *
 * @returns The checkout page content.
 */
export default async function CheckoutPage() {
    const user = await currentUser();
    if (!user) {
        redirect("/cart");
    }

    // Get user cart
    const cart = await db.cart.findFirst({
        where: {
            userId: user.id,
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

    if (!cart) redirect("/cart");

    // Get user shipping address
    const addresses = await getUserShippingAddresses();

    // Get list of countries
    const countries = await db.country.findMany({
        orderBy: { name: "desc" },
    });

    const cookieStore = await cookies();
    const userCountry = parseUserCountryCookie(
        cookieStore.get("userCountry")?.value
    );

    const serializedCart = serializeCart(cart);

    return (
        <main className={styles.page}>
            <header className={styles.hero}>
                <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                    <Link href="/">Home</Link>
                    <Link href="/cart">Your bag</Link>
                    <span aria-current="page">Checkout</span>
                </nav>
                <h1>Checkout</h1>
                <p>Confirm your delivery details and review your order.</p>
            </header>
            <CheckoutContainer
                actions={{
                    refreshCartAction: updateCheckoutProductWithLatest,
                    placeOrderAction: placeOrder,
                    emptyCartAction: emptyUserCart,
                    applyCouponAction: applyCoupon,
                    loadAddressesAction: getUserShippingAddresses,
                    saveAddressAction: saveProfileShippingAddress,
                    makeDefaultAction: makeProfileShippingAddressDefault,
                }}
                cart={serializedCart}
                countries={countries}
                addresses={addresses}
                userCountry={userCountry}
            />
        </main>
    );
}
