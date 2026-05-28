/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/ui/data-table";
import ModalProvider from "@/providers/modal-provider";

type Row = { id: string; name: string };

const columns: ColumnDef<Row>[] = [
    { accessorKey: "name", header: "Name" },
];

describe("DataTable (snapshot)", () => {
    it("renders empty data table (no results row)", () => {
        const { container } = render(
            <ModalProvider>
                <DataTable<Row, unknown>
                    columns={columns}
                    data={[]}
                    filterValue="name"
                    searchPlaceholder="Search by name"
                />
            </ModalProvider>
        );
        // DataTable は Fragment を返すため container 全体（search bar + テーブル）をスナップショット対象にする。
        expect(container).toMatchSnapshot();
    });

    it("renders populated data table with 2 rows", () => {
        const { container } = render(
            <ModalProvider>
                <DataTable<Row, unknown>
                    columns={columns}
                    data={[
                        { id: "1", name: "Alpha" },
                        { id: "2", name: "Bravo" },
                    ]}
                    filterValue="name"
                    searchPlaceholder="Search by name"
                />
            </ModalProvider>
        );
        // DataTable は Fragment を返すため container 全体（search bar + テーブル）をスナップショット対象にする。
        expect(container).toMatchSnapshot();
    });
});
