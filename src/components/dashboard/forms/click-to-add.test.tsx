/** @jest-environment jsdom */
import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ClickToAddInputs, {
    type Detail,
} from "@/components/dashboard/forms/click-to-add";

// react-color は重いので軽量モックに置換 (colorPicker 経路用)
jest.mock("react-color", () => ({
    SketchPicker: () => <div data-testid="sketch-picker" />,
}));

type SizeDetail = Detail & { size: string; quantity: number };

/**
 * details を内部 state で保持する制御ラッパー。
 * setDetails の関数/配列両更新を実コンポーネントで検証するため。
 */
function Harness({ initial }: { initial: SizeDetail[] }) {
    const [details, setDetails] = useState<SizeDetail[]>(initial);
    return (
        <div>
            <div data-testid="count">{details.length}</div>
            <div data-testid="json">{JSON.stringify(details)}</div>
            <ClickToAddInputs<SizeDetail>
                details={details}
                setDetails={setDetails}
                initialDetail={{ size: "", quantity: 0 }}
            />
        </div>
    );
}

describe("ClickToAddInputs", () => {
    it("renders an input per property of each detail", () => {
        // Arrange & Act
        render(<Harness initial={[{ size: "M", quantity: 3 }]} />);

        // Assert: size / quantity の 2 入力
        expect(screen.getByPlaceholderText("size")).toHaveValue("M");
        expect(screen.getByPlaceholderText("quantity")).toHaveValue(3);
    });

    it("appends a new detail when the add button is clicked", () => {
        // Arrange
        render(<Harness initial={[{ size: "M", quantity: 3 }]} />);

        // Act: PlusButton (title="Add nre detail") を押す
        fireEvent.click(screen.getAllByTitle("Add nre detail")[0]);

        // Assert: 行が 1 → 2 に増える
        expect(screen.getByTestId("count")).toHaveTextContent("2");
    });

    it("removes a detail but keeps at least one row", () => {
        // Arrange: 2 行
        render(
            <Harness
                initial={[
                    { size: "M", quantity: 3 },
                    { size: "L", quantity: 5 },
                ]}
            />,
        );

        // Act: 先頭行の MinusButton を押す
        fireEvent.click(screen.getAllByTitle("Remove detail")[0]);

        // Assert: 2 → 1
        expect(screen.getByTestId("count")).toHaveTextContent("1");
    });

    it("does not remove the final remaining detail", () => {
        // Arrange: 1 行のみ
        render(<Harness initial={[{ size: "M", quantity: 3 }]} />);

        // Act
        fireEvent.click(screen.getByTitle("Remove detail"));

        // Assert: 1 のまま (最低 1 行保持)
        expect(screen.getByTestId("count")).toHaveTextContent("1");
    });

    it("updates a property value on input change", () => {
        // Arrange
        render(<Harness initial={[{ size: "M", quantity: 3 }]} />);

        // Act: size を変更
        fireEvent.change(screen.getByPlaceholderText("size"), {
            target: { value: "XL" },
        });

        // Assert
        expect(screen.getByTestId("json")).toHaveTextContent('"size":"XL"');
    });

    it("renders the PlusButton when details is empty", () => {
        // Arrange & Act
        render(<Harness initial={[]} />);

        // Assert: 空配列時は単独の PlusButton
        expect(screen.getByTitle("Add nre detail")).toBeInTheDocument();
        expect(screen.getByTestId("count")).toHaveTextContent("0");
    });
});
