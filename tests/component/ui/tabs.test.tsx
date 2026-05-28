/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";

describe("Tabs (snapshot)", () => {
    it("renders Tabs with defaultValue selected", () => {
        const { container } = render(
            <Tabs defaultValue="account">
                <TabsList>
                    <TabsTrigger value="account">Account</TabsTrigger>
                    <TabsTrigger value="password">Password</TabsTrigger>
                </TabsList>
                <TabsContent value="account">Account body</TabsContent>
                <TabsContent value="password">Password body</TabsContent>
            </Tabs>
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders Tabs with disabled trigger", () => {
        const { container } = render(
            <Tabs defaultValue="a">
                <TabsList>
                    <TabsTrigger value="a">A</TabsTrigger>
                    <TabsTrigger value="b" disabled>
                        B (disabled)
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="a">A body</TabsContent>
            </Tabs>
        );
        expect(container.firstChild).toMatchSnapshot();
    });
});
