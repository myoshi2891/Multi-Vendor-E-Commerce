/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MasterDialog from "@/components/dashboard/admin/master-dialog";
import ConfirmDelete from "@/components/dashboard/design/confirm-delete";
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));
it("rejects a missing edit result and offers retry without showing stale row data", async () => {
    const load = jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ name: "Fresh data" });
    render(
        <MasterDialog label="Edit example" loadAction={load}>
            {(data) => <p>{data?.name}</p>}
        </MasterDialog>
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit example" }));
    await screen.findByRole("alert");
    expect(screen.queryByText("Fresh data")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry load" }));
    await screen.findByText("Fresh data");
    expect(load).toHaveBeenCalledTimes(2);
});
it("ignores a completed load from a dismissed edit session", async () => {
    let resolve!: (value: { name: string }) => void;
    const load = jest
        .fn()
        .mockImplementationOnce(
            () =>
                new Promise((done) => {
                    resolve = done;
                })
        )
        .mockResolvedValueOnce({ name: "Current session" });
    render(
        <MasterDialog label="Edit example" loadAction={load}>
            {(data) => <p>{data?.name}</p>}
        </MasterDialog>
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Edit example" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Edit example" }));
    await screen.findByText("Current session");
    resolve({ name: "Stale session" });
    await waitFor(() =>
        expect(screen.getByText("Current session")).toBeVisible()
    );
    expect(screen.queryByText("Stale session")).not.toBeInTheDocument();
});
it("deletion requires confirmation, locks pending and retries a failure", async () => {
    let reject!: (error: Error) => void;
    const remove = jest
        .fn()
        .mockImplementationOnce(
            () =>
                new Promise((_, fail) => {
                    reject = fail;
                })
        )
        .mockResolvedValueOnce(undefined);
    render(<ConfirmDelete label="example" deleteAction={remove} />);
    const user = userEvent.setup();
    await user.click(
        screen.getByRole("button", { name: "Delete example", exact: true })
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(remove).not.toHaveBeenCalled();
    await user.click(
        screen.getByRole("button", { name: "Delete example", exact: true })
    );
    await user.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeVisible();
    reject(Error("private"));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Retry delete" }));
    await screen.findByText("Deleted example.");
    expect(remove).toHaveBeenCalledTimes(2);
});
