/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import ReportProblemPage from "./page";
import { createSupportTicket } from "@/queries/support";
const form = jest.fn();
jest.mock("@/queries/support", () => ({ createSupportTicket: jest.fn() }));
jest.mock("@/components/store/support/support-form", () => ({ __esModule: true, default: (props: unknown) => { form(props); return <div>Form</div>; } }));
it("problem report uses the brand form with the existing action/category and support navigation", () => {
    render(<ReportProblemPage />);
    expect(form).toHaveBeenCalledWith(expect.objectContaining({ appearance: "brand", category: "PROBLEM_REPORT", submitLabel: "報告する", submitAction: createSupportTicket }));
    expect(screen.getByRole("heading", { level: 1, name: "Report a problem" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Customer service" })).toHaveAttribute("href", "/customer-service");
});
