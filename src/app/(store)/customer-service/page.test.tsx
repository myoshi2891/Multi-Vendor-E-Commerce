/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import CustomerServicePage from "./page";

// next/link を素の <a> に差し替え（jsdom で href 検証を可能にする）
jest.mock("next/link", () => ({
    __esModule: true,
    default: ({
        children,
        href,
    }: React.PropsWithChildren<{ href: string }>) => (
        <a href={href}>{children}</a>
    ),
}));

describe("CustomerServicePage", () => {
    it("5 つの導線リンクを描画する（AC-SP3）", () => {
        // Arrange / Act
        render(<CustomerServicePage />);

        // Assert — 各サポート窓口の href が DOM に存在する
        const expected: Array<[RegExp, string]> = [
            [/Contact us/, "/contact"],
            [/Returns & Exchange/, "/returns-exchange"],
            [/FAQs/, "/faqs"],
            [/Track your order/, "/track-order"],
            [/Product support/, "/product-support"],
        ];
        for (const [name, href] of expected) {
            expect(screen.getByRole("link", { name })).toHaveAttribute(
                "href",
                href
            );
        }
    });
});
