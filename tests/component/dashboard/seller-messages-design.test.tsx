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
it("logs store lookup and ownership failures with structured context", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    // requireStoreOwner は getStoreConversations の try の外なので、所有権エラーはそのまま伝播する
    jest.mocked(getSellerConversations).mockRejectedValueOnce(
        new Error("Forbidden: you do not own this store.")
    );
    render(await Page({ params: Promise.resolve({ storeUrl: "example" }) }));
    expect(spy).toHaveBeenCalledWith(
        "[SellerMessagesPage] Failed to load conversations",
        expect.objectContaining({
            error: "Forbidden: you do not own this store.",
        })
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Please try again");
    expect(screen.queryByText(/Forbidden/)).not.toBeInTheDocument();
    jest.mocked(getSellerConversations).mockRejectedValueOnce("raw failure");
    await Page({ params: Promise.resolve({ storeUrl: "example" }) });
    expect(spy).toHaveBeenCalledWith("[SellerMessagesPage] Unknown error", {
        error: "raw failure",
    });
    spy.mockRestore();
});
