/** @jest-environment jsdom */
import React from "react";
import {
    render,
    screen,
    fireEvent,
    waitFor,
    act,
} from "@testing-library/react";
import SupportForm from "@/components/store/support/support-form";
import { createSupportTicket } from "@/queries/support";
jest.mock("@/queries/support", () => ({ createSupportTicket: jest.fn() }));
const action = jest.mocked(createSupportTicket);
beforeEach(() => jest.clearAllMocks());
it.each(["DISPUTE", "PROBLEM_REPORT"] as const)(
    "brand %s preserves category fields and payload, locks pending and permits retry",
    async (category) => {
        let reject!: (error: Error) => void;
        action.mockImplementationOnce(
            () =>
                new Promise((_, fail) => {
                    reject = fail;
                })
        );
        action.mockResolvedValueOnce({ id: "ticket-1" });
        render(
            <SupportForm
                category={category}
                appearance="brand"
                submitAction={createSupportTicket}
            />
        );
        for (const [label, value] of [
            ["お名前", "Test"],
            ["メールアドレス", "test@example.com"],
            ["件名", "Test request"],
            ["内容", "Test details"],
        ])
            fireEvent.change(screen.getByLabelText(label), {
                target: { value },
            });
        const order = screen.queryByLabelText("対象の注文番号");
        expect(Boolean(order)).toBe(category === "DISPUTE");
        if (order) {
            fireEvent.click(screen.getByRole("button", { name: "送信" }));
            expect(
                await screen.findByText("対象の注文番号を入力してください。")
            ).toBeInTheDocument();
            expect(action).not.toHaveBeenCalled();
            fireEvent.change(order, {
                target: { value: "123e4567-e89b-12d3-a456-426614174000" },
            });
        }
        fireEvent.click(screen.getByRole("button", { name: "送信" }));
        await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
        for (const textbox of screen.getAllByRole("textbox"))
            expect(textbox).toBeDisabled();
        expect(screen.getByRole("button", { name: "送信中…" })).toBeDisabled();
        expect(action).toHaveBeenCalledWith(
            expect.objectContaining({
                category,
                message: "Test details",
                orderId:
                    category === "DISPUTE"
                        ? "123e4567-e89b-12d3-a456-426614174000"
                        : undefined,
            })
        );
        await act(async () => reject(new Error("Request failed")));
        expect(screen.getByRole("alert")).toHaveTextContent("Request failed");
        expect(screen.getByLabelText("内容")).toHaveValue("Test details");
        fireEvent.click(screen.getByRole("button", { name: "送信" }));
        expect(await screen.findByRole("status")).toHaveTextContent(
            "受け付けました。"
        );
        expect(action).toHaveBeenCalledTimes(2);
    }
);
