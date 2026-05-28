/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

describe("Pagination (snapshot)", () => {
    it("renders basic 3-page nav", () => {
        const { container } = render(
            <Pagination>
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious href="#" />
                    </PaginationItem>
                    <PaginationItem>
                        <PaginationLink href="#" isActive>
                            1
                        </PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                        <PaginationLink href="#">2</PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                        <PaginationLink href="#">3</PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                        <PaginationNext href="#" />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders with ellipsis", () => {
        const { container } = render(
            <Pagination>
                <PaginationContent>
                    <PaginationItem>
                        <PaginationLink href="#">1</PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                        <PaginationEllipsis />
                    </PaginationItem>
                    <PaginationItem>
                        <PaginationLink href="#">9</PaginationLink>
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders with active link variant", () => {
        const { container } = render(
            <Pagination>
                <PaginationContent>
                    <PaginationItem>
                        <PaginationLink href="#" isActive>
                            5
                        </PaginationLink>
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
