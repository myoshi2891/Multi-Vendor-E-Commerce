/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

describe("Table (snapshot)", () => {
    it("renders compound table with header / body / footer", () => {
        const { container } = render(
            <Table>
                <TableCaption>Invoice summary</TableCaption>
                <TableHeader>
                    <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Total</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        <TableCell>Widget</TableCell>
                        <TableCell>2</TableCell>
                        <TableCell>$20</TableCell>
                    </TableRow>
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell>Total</TableCell>
                        <TableCell>2</TableCell>
                        <TableCell>$20</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders selected row with data-state", () => {
        const { container } = render(
            <Table>
                <TableBody>
                    <TableRow data-state="selected">
                        <TableCell>Selected row</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("merges className overrides", () => {
        const { container } = render(
            <Table className="border">
                <TableBody>
                    <TableRow>
                        <TableCell className="font-mono">code</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
