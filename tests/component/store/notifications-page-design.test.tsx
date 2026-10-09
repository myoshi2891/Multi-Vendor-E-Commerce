/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import NotificationsPage from "@/app/(store)/profile/notifications/page";
import { getMyNotifications } from "@/queries/notification";

jest.mock("@/queries/notification", () => ({
    getMyNotifications: jest.fn(),
    markNotificationRead: jest.fn(),
    markAllNotificationsRead: jest.fn(),
}));

it("retains a named notification section and cursor reload link after lookup failure", async () => {
    jest.mocked(getMyNotifications).mockRejectedValueOnce(
        new Error("private database failure")
    );
    const cursor = "12345678-1234-1234-1234-123456789abc";
    render(
        await NotificationsPage({ searchParams: Promise.resolve({ cursor }) })
    );
    expect(
        screen.getByRole("heading", { name: "Notifications", level: 1 })
    ).toBeInTheDocument();
    expect(
        screen.getByRole("region", { name: "Notifications" })
    ).toContainElement(screen.getByRole("alert"));
    expect(screen.getByRole("alert")).not.toHaveTextContent(
        "private database failure"
    );
    expect(
        screen.getByRole("link", { name: "Reload notifications" })
    ).toHaveAttribute("href", `/profile/notifications?cursor=${cursor}`);
});
