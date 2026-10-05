/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import Page from "@/app/dashboard/seller/stores/[storeUrl]/messages/page";
import {
    getStoreConversations,
    getSellerConversations,
} from "@/queries/message";
jest.mock("@/queries/message", () => ({
    getStoreConversations: jest.fn(async () => []),
    getSellerConversations: jest.fn(async () => []),
    getProfileConversationMessages: jest.fn(async () => []),
    getConversationMessages: jest.fn(async () => []),
    sendMessage: jest.fn(),
    markConversationRead: jest.fn(),
}));
it("labels the seller message workspace and conversation refresh", async () => {
    render(await Page({ params: Promise.resolve({ storeUrl: "example" }) }));
    expect(
        screen.getByRole("region", { name: "Message management" })
    ).toBeInTheDocument();
    expect(
        screen.getByRole("button", { name: "Refresh conversations" })
    ).toBeInTheDocument();
});
it("reports a conversation lookup failure with retry", async () => {
    jest.mocked(getStoreConversations).mockRejectedValueOnce(
        new Error("private failure")
    );
    jest.mocked(getSellerConversations).mockRejectedValueOnce(
        new Error("private failure")
    );
    render(await Page({ params: Promise.resolve({ storeUrl: "example" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please try again");
    expect(screen.queryByText(/No conversations yet/)).not.toBeInTheDocument();
});
