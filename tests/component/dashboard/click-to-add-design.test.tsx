/** @jest-environment jsdom */
import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import ClickToAddInputs from "@/components/dashboard/forms/click-to-add";

jest.mock("react-color", () => ({ SketchPicker: () => null }));

function Editor({ design, rows = 1 }: { design?: "seller"; rows?: number }) {
    const [details, setDetails] = useState(Array.from({length: rows}, (_, i) => ({name: `Detail ${i + 1}`, value: `Value ${i + 1}`})));
    return <ClickToAddInputs design={design} details={details} setDetails={setDetails} initialDetail={{name:"",value:""}} />;
}

it("seller editor disables removal of the required last row", () => {
    render(<Editor design="seller" />);
    expect(screen.getByRole("button", {name:"Remove detail"})).toBeDisabled();
});

it("keyboard removal returns focus to a surviving field and preserves its value", async () => {
    const user = userEvent.setup();
    render(<Editor design="seller" rows={2} />);
    screen.getAllByRole("button", {name:"Remove detail"})[0].focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("textbox", {name:"name 1"})).toHaveValue("Detail 2");
    expect(screen.getByRole("textbox", {name:"value 1"})).toHaveValue("Value 2");
    expect(screen.getByRole("textbox", {name:"name 1"})).toHaveFocus();
});

it("preserves the default caller's existing removal control", () => {
    render(<Editor />);
    expect(screen.getByRole("button", {name:"Remove detail"})).toBeEnabled();
});
