/* Production presentation with action adapters; no DB, auth or external writes. */
import React from "react";
import { createRoot } from "react-dom/client";
import OrdersTable, {
    type OrderHistoryEntry,
} from "@/components/store/profile/orders/orders-table";
import PaymentsTable, {
    type PaymentHistoryEntry,
} from "@/components/store/profile/payments/payments-table";
import AddressContainer from "@/components/store/profile/addresses/container";
import ReviewsContainer, {
    type ReviewHistoryEntry,
} from "@/components/store/profile/reviews/reviews-container";
import MessagesContainer from "@/components/store/profile/messages/messages-container";
import MessagesLoading from "@/app/(store)/profile/messages/loading";
import AccountView from "@/components/store/profile/account-view";
import ProfileOverview from "@/components/store/profile/overview";
import styles from "@/components/store/profile/profile.module.css";
import type { AddressActions, ProfileAddress } from "@/lib/profile-addresses";
import type {
    ProfileMessage,
    ProfileMessageActions,
} from "@/lib/profile-messages";

const params = new URLSearchParams(location.search);
const screen = params.get("screen") ?? "orders";
const state = params.get("state") ?? "normal";
const image = "/assets/images/default-user.jpg";
const country = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Japan",
    code: "JP",
};
const address: ProfileAddress = {
    id: "11111111-1111-4111-8111-111111111111",
    firstName: "Mina",
    lastName: "Mori",
    phone: "+819012345678",
    address1: "12 Garden Street",
    address2: "Apartment 2",
    city: "Tokyo",
    state: "Tokyo",
    zip_code: "1000001",
    countryId: country.id,
    default: false,
    country,
};
const orders: OrderHistoryEntry[] = [
    {
        id: "order-" + "long-identifier-".repeat(5),
        createdAt: "2026-10-01T00:00:00Z",
        total: 25.5,
        paymentStatus: "Pending",
        orderStatus: "Processing",
        groups: [{ _count: { items: 2 }, items: [{ image }] }],
    },
];
const payments: PaymentHistoryEntry[] = [
    {
        id: "payment-" + "long-identifier-".repeat(5),
        paymentIntentId: "pi_" + "long".repeat(20),
        paymentMethod: "Stripe",
        amount: 25.5,
        status: "Paid",
        orderId: orders[0].id,
        updatedAt: "2026-10-01T00:00:00Z",
    },
];
const reviews: ReviewHistoryEntry[] = [
    {
        id: "review-one",
        rating: 4.5,
        review: "A lovely discovery.\n" + "LongReview".repeat(30),
        variant: "Silk scarf",
        color: "Gold, Green",
        size: "One size",
        quantity: "2",
        updatedAt: "2026-10-01T00:00:00Z",
        user: { name: "Mina Mori", picture: image },
        images: [{ id: "photo-one", url: image, alt: "Scarf detail" }],
    },
];
const conversations = [
    {
        id: "conversation-one",
        userId: "buyer",
        updatedAt: "2026-10-01T00:00:00Z",
        store: { name: "Garden Store", logo: image },
        messages: [{ content: "Welcome to our store" }],
    },
];
const messages: ProfileMessage[] = [
    {
        id: "message-one",
        senderId: "seller",
        content: "Hello from the store\n" + "LongMessage".repeat(30),
        createdAt: "2026-10-01T00:00:00Z",
    },
];
const calls = new Map<string, number>();
async function operation(name: string) {
    const count = (calls.get(name) ?? 0) + 1;
    calls.set(name, count);
    await new Promise((resolve) =>
        setTimeout(
            resolve,
            state === "pending" && (screen !== "messages" || name === "send")
                ? 60000
                : 300
        )
    );
    if (state === "retry" && count === 1)
        throw new Error("Fixture request failure");
}
const addressActions: AddressActions = {
    async loadAddressesAction() {
        await operation("load");
        return { addresses: [address], countries: [country] };
    },
    async saveAddressAction(input) {
        await operation("save");
        return { ...address, ...input, id: input.id ?? address.id };
    },
    async makeDefaultAction(id) {
        await operation("default");
        return { id };
    },
};
const messageActions: ProfileMessageActions = {
    async loadConversationsAction() {
        await operation("list");
        return conversations;
    },
    async loadMessagesAction() {
        await operation("thread");
        return messages;
    },
    async markReadAction() {
        return { count: 1 };
    },
    async sendMessageAction(_id, content) {
        await operation("send");
        messages.push({
            id: "message-two",
            senderId: "buyer",
            content,
            createdAt: "2026-10-02T00:00:00Z",
        });
        return { id: "message-two" };
    },
};
async function preview() {
    const empty = state === "empty";
    const initialError = state === "error";
    let body: React.ReactNode;
    switch (screen) {
        case "payment":
            body = (
                <PaymentsTable
                    payments={empty ? [] : payments}
                    totalPages={empty ? 0 : 3}
                    initialError={initialError}
                    fetchPaymentsAction={async (_filter, _period, search) => {
                        await operation("load");
                        return {
                            payments: search === "missing" ? [] : payments,
                            totalPages: 3,
                        };
                    }}
                />
            );
            break;
        case "addresses":
            body = (
                <AddressContainer
                    addresses={empty ? [] : [address]}
                    countries={[country]}
                    initialError={initialError}
                    {...addressActions}
                />
            );
            break;
        case "reviews":
            body = (
                <ReviewsContainer
                    reviews={empty ? [] : reviews}
                    totalPages={empty ? 0 : 3}
                    initialError={initialError}
                    fetchReviewsAction={async (_filter, _period, search) => {
                        await operation("load");
                        return {
                            reviews: search === "missing" ? [] : reviews,
                            totalPages: 3,
                        };
                    }}
                />
            );
            break;
        case "messages":
            if (state === "loading") {
                body = <MessagesLoading />;
                break;
            }
            body = (
                <MessagesContainer
                    initialConversations={
                        empty || initialError ? [] : conversations
                    }
                    initialError={initialError}
                    {...messageActions}
                />
            );
            break;
        case "overview":
            // Resolve the RSC identity before client render; the frame is the production AccountView.
            body = <AccountView identity={await ProfileOverview()} />;
            break;
        default:
            body = (
                <OrdersTable
                    orders={empty ? [] : orders}
                    totalPages={empty ? 0 : 3}
                    initialError={initialError}
                    prev_filter={
                        params.get("filter") === "unpaid" ? "unpaid" : ""
                    }
                    fetchOrdersAction={async (_filter, _period, search) => {
                        await operation("load");
                        return {
                            orders: search === "missing" ? [] : orders,
                            totalPages: 3,
                        };
                    }}
                />
            );
    }
    createRoot(document.getElementById("root")!).render(
        <div
            className={styles.shell}
            data-postpurchase-shell
            style={{ minHeight: "100vh" }}
        >
            <main
                style={{ maxWidth: 1050, margin: "auto", padding: "40px 6%" }}
            >
                {body}
            </main>
        </div>
    );
}
void preview();
