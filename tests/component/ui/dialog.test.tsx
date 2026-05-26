/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
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

    it("renders DialogContent in open state", () => {
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
        // DialogContent は role="dialog" の styled div として描画される。
        // document.body 全体ではなくこの要素だけをスナップショット化することで、
        // Radix が body に書き込む scroll-lock 属性 / focus-guard span / overlay div
        // などの周辺要素を除外しスコープを最小化する。
        expect(screen.getByRole("dialog")).toMatchSnapshot();
    });
});
