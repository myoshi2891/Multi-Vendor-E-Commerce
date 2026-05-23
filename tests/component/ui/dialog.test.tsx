/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

describe("Dialog (snapshot)", () => {
    it("renders trigger in closed state", () => {
        const { container } = render(
            <Dialog>
                <DialogTrigger asChild>
                    <Button>Open dialog</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Title</DialogTitle>
                        <DialogDescription>Body</DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders portal content in open state", () => {
        render(
            <Dialog defaultOpen>
                <DialogTrigger asChild>
                    <Button>Open dialog</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Title</DialogTitle>
                        <DialogDescription>Body</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button>OK</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
        expect(document.body).toMatchSnapshot();
    });
});
