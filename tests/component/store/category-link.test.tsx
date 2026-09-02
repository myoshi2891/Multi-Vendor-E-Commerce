/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import CategoryLink from "@/components/store/browse-page/filters/category/category-link";
import { CategoryTreeType } from "@/lib/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// next/navigation は App Router のランタイム依存のため jsdom では動作しない。
// 3 フックのみをモックし、CategoryLink の開閉同期を検証する。
jest.mock("next/navigation", () => ({
    usePathname: jest.fn(),
    useRouter: jest.fn(),
    useSearchParams: jest.fn(),
}));

const mockReplace = jest.fn();

/** ツリーノードの最小スタブ（CategoryLink は id / name / url / children しか読まない）。 */
const node = (
    url: string,
    children: CategoryTreeType[] = []
): CategoryTreeType =>
    ({ id: url, name: url, url, children }) as unknown as CategoryTreeType;

/** electronics > camera > lens の 3 階層。 */
const tree = () => node("electronics", [node("camera", [node("lens")])]);

const renderLink = (search = "") => {
    (useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams(search) as unknown as ReturnType<
            typeof useSearchParams
        >
    );
    (usePathname as jest.Mock).mockReturnValue("/browse");
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
    return render(<CategoryLink category={tree()} />);
};

/** URL の変化を再現する（枝はマウントされたまま ?category= だけが変わる）。 */
const rerenderWith = (
    rerender: (ui: React.ReactElement) => void,
    search: string
) => {
    (useSearchParams as jest.Mock).mockReturnValue(
        new URLSearchParams(search) as unknown as ReturnType<
            typeof useSearchParams
        >
    );
    rerender(<CategoryLink category={tree()} />);
};

describe("CategoryLink — 選択肢の開閉同期", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("マウント時に子孫が選択されていれば開いた状態で描く", () => {
        // Arrange / Act
        renderLink("category=lens");

        // Assert
        expect(screen.getByText("camera")).toBeInTheDocument();
        expect(screen.getByText("lens")).toBeInTheDocument();
    });

    it("マウント後に子孫が選択されたら開く（URL 変化に追随する）", () => {
        // Arrange —— 未選択でマウント。閉じているので子孫は描かれない。
        const { rerender } = renderLink("");
        expect(screen.queryByText("camera")).not.toBeInTheDocument();

        // Act —— クライアント遷移で ?category= だけが変わる
        rerenderWith(rerender, "category=lens");

        // Assert —— 絞り込み対象が画面に現れる
        expect(screen.getByText("camera")).toBeInTheDocument();
        expect(screen.getByText("lens")).toBeInTheDocument();
    });

    it("子孫が選択されていなければユーザーの折りたたみを維持する", () => {
        // Arrange —— 選択肢なので開いた状態で始まる
        const { rerender } = renderLink("category=camera");
        expect(screen.getByText("camera")).toBeInTheDocument();

        // Act —— 選択を外し、ユーザーが自分で閉じる
        rerenderWith(rerender, "");
        fireEvent.click(screen.getByLabelText("Collapse"));

        // Assert —— 開く方向にしか同期しないので、閉じたままを維持する
        expect(screen.queryByText("camera")).not.toBeInTheDocument();
        rerenderWith(rerender, "");
        expect(screen.queryByText("camera")).not.toBeInTheDocument();
    });
});
