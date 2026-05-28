/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useForm } from "react-hook-form";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// 各テストファイル内に local 定義する最小ラッパー（共有ヘルパー化は YAGNI / B1_SNAPSHOT_EXPANSION_PLAN.md 方針）。
function FormFixture() {
    const methods = useForm<{ username: string }>({
        defaultValues: { username: "" },
    });
    return (
        <Form {...methods}>
            <form>
                <FormField
                    control={methods.control}
                    name="username"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                                <Input placeholder="user" {...field} />
                            </FormControl>
                            <FormDescription>Public display name.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </form>
        </Form>
    );
}

describe("Form (snapshot)", () => {
    it("renders empty FormField with label / description", () => {
        const { container } = render(<FormFixture />);
        expect(container.firstChild).toMatchSnapshot();
    });
});
