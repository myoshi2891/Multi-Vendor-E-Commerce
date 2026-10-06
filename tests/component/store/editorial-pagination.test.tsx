/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Pagination from "@/components/store/shared/pagination";
it("provides named review pagination with current page and disabled boundaries", () => {
    const setPage = jest.fn();
    render(
        <Pagination
            page={1}
            totalPages={3}
            setPage={setPage}
            {...{ variant: "editorial" as const }}
        />
    );
    const navigation = screen.getByRole("navigation", { name: "Review pages" });
    expect(
        within(navigation).getByRole("button", { name: "Previous" })
    ).toBeDisabled();
    expect(
        within(navigation).getByRole("button", { name: "1" })
    ).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(navigation).getByRole("button", { name: "2" }));
    expect(setPage).toHaveBeenCalledWith(2);
});
