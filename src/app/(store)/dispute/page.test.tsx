/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import DisputePage from "./page";
import { createSupportTicket } from "@/queries/support";
const form = jest.fn();
jest.mock("@/queries/support", () => ({ createSupportTicket: jest.fn() }));
jest.mock("@/components/store/support/support-form", () => ({ __esModule: true, default: (props: unknown) => { form(props); return <div>Form</div>; } }));
it("dispute uses the brand form with the existing action/category and support navigation", () => {
    render(<DisputePage />);
    expect(form).toHaveBeenCalledWith(expect.objectContaining({ appearance: "brand", category: "DISPUTE", submitLabel: "申立を送信する", submitAction: createSupportTicket }));
    expect(screen.getByRole("heading", { level: 1, name: "Order dispute resolution" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Customer service" })).toHaveAttribute("href", "/customer-service");
});
