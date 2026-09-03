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

describe("CategoryLink — 選択時の URL 書き換え", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("正常系: クリックで ?category= を張り替え、旧 subCategory を落とす", () => {
        // Arrange —— 旧パラメータが残った URL
        renderLink("subCategory=lens&sort=most-popular");

        // Act
        fireEvent.click(screen.getByText("electronics"));

        // Assert —— 正準パラメータは category 1 本。subCategory を残すと
        // 2 つのサブツリーの積になり、意図しない絞り込みが残る。
        expect(mockReplace).toHaveBeenCalledWith(
            "/browse?sort=most-popular&category=electronics"
        );
    });

    it("エッジケース: 選択済みのカテゴリを再クリックしても遷移しない", () => {
        // Arrange
        renderLink("category=electronics");

        // Act
        fireEvent.click(screen.getByText("electronics"));

        // Assert —— 同一 URL への replace は履歴を汚すだけなので早期リターンする
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it("正常系: 子カテゴリを選び直しても親の枝は開いたままになる", () => {
        // Arrange —— 孫が選択済みなので electronics / camera とも開いて始まる
        renderLink("category=lens");

        // Act —— 中間ノードへ選択を移す
        fireEvent.click(screen.getByText("camera"));

        // Assert —— 遷移後も枝は畳まない（絞り込み対象が画面から消えない）
        expect(mockReplace).toHaveBeenCalledWith("/browse?category=camera");
        expect(screen.getByText("camera")).toBeInTheDocument();
    });
});
