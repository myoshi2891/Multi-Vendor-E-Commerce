/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Experience from "./experience";

/**
 * ラグジュアリーホームのヒーロー演出（`experience.tsx`）。
 *
 * WebGL の Scene は「reduced-motion でない」「一時停止していない」「WebGL2 が使える」の
 * 3 条件が揃った時だけ描画し、失敗しても商品導線（HTML 側）を壊さない設計。
 * Scene 本体（three.js）は jsdom で描画できないため next/dynamic ごとスタブ化し、
 * 描画可否と渡す props（active / compact）の分岐を固定する。
 */

interface SceneProps {
    active: boolean;
    compact: boolean;
}
const renderSceneStub = (props: SceneProps) => (
    <div
        data-testid="scene"
        data-active={String(props.active)}
        data-compact={String(props.compact)}
    />
);
const mockScene = jest.fn(renderSceneStub);
jest.mock("next/dynamic", () => ({
    __esModule: true,
    default: () =>
        function MockScene(props: SceneProps) {
            return mockScene(props);
        },
}));
jest.mock("next/image", () => ({
    __esModule: true,
    default: () => <span data-testid="gem-fallback" />,
}));
// next/link は prefetch 用に独自の IntersectionObserver を張るため、素の <a> に置き換えて
// 観測対象を experience 自身の observer だけに絞る。
jest.mock("next/link", () => ({
    __esModule: true,
    default: ({
        children,
        href,
        className,
    }: {
        children: React.ReactNode;
        href: string;
        className?: string;
    }) => (
        <a href={href} className={className}>
            {children}
        </a>
    ),
}));
jest.mock("framer-motion", () => ({
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    motion: {
        div: ({
            children,
            className,
        }: {
            children: React.ReactNode;
            className?: string;
        }) => <div className={className}>{children}</div>,
    },
}));

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
const observers: Array<{ callback: ObserverCallback; disconnect: jest.Mock }> =
    [];

const setupEnvironment = ({
    reduced = false,
    compact = false,
    webgl = "supported" as "supported" | "unsupported" | "throws",
} = {}) => {
    const mediaRemove = jest.fn();
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: jest.fn((query: string) => ({
            matches: query.includes("reduce") ? reduced : compact,
            addEventListener: jest.fn(),
            removeEventListener: mediaRemove,
        })),
    });
    Object.defineProperty(window, "requestAnimationFrame", {
        configurable: true,
        writable: true,
        value: (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        },
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
        configurable: true,
        writable: true,
        value: jest.fn(),
    });
    const loseContext = jest.fn();
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        writable: true,
        value: jest.fn(() => {
            if (webgl === "throws") throw new Error("WebGL blocked");
            if (webgl === "unsupported") return null;
            return { getExtension: () => ({ loseContext }) };
        }),
    });
    Object.defineProperty(window, "IntersectionObserver", {
        configurable: true,
        writable: true,
        value: class {
            disconnect = jest.fn();
            constructor(callback: ObserverCallback) {
                observers.push({ callback, disconnect: this.disconnect });
            }
            observe = jest.fn();
        },
    });
    return { mediaRemove, loseContext };
};

const intersect = (isIntersecting: boolean) =>
    act(() => {
        observers.forEach(({ callback }) => callback([{ isIntersecting }]));
    });

const motionButton = () => screen.getByRole("button");

describe("Luxury home experience", () => {
    beforeEach(() => {
        observers.length = 0;
        mockScene.mockClear();
    });
    afterEach(() => {
        mockScene.mockImplementation(renderSceneStub);
    });

    it("カテゴリを 01 始まりの番号付きで、URL エンコードした slug へリンクする", () => {
        // Arrange
        setupEnvironment();

        // Act
        render(
            <Experience
                categories={[
                    { id: "c1", name: "Jewelry", url: "fine jewels" },
                    { id: "c2", name: "Watches", url: "watches" },
                ]}
            />
        );

        // Assert
        expect(
            screen.getByRole("link", { name: /01\s*Jewelry/ })
        ).toHaveAttribute("href", "/browse?category=fine%20jewels");
        expect(
            screen.getByRole("link", { name: /02\s*Watches/ })
        ).toHaveAttribute("href", "/browse?category=watches");
        expect(
            screen.queryByRole("link", { name: /Discover the collections/ })
        ).not.toBeInTheDocument();
    });

    it("カテゴリが空なら /browse への汎用リンクを出す", () => {
        // Arrange
        setupEnvironment();

        // Act
        render(<Experience categories={[]} />);

        // Assert
        expect(
            screen.getByRole("link", { name: /Discover the collections/ })
        ).toHaveAttribute("href", "/browse");
    });

    it("reduced-motion では Scene を描画せず、操作ボタンを無効化する", () => {
        // Arrange
        setupEnvironment({ reduced: true });

        // Act
        render(<Experience categories={[]} />);

        // Assert
        expect(screen.queryByTestId("scene")).not.toBeInTheDocument();
        expect(motionButton()).toBeDisabled();
        expect(motionButton()).toHaveTextContent("STILL EXPERIENCE");
        expect(screen.getByTestId("gem-fallback")).toBeInTheDocument();
    });

    it("WebGL2 が使えれば Scene を描画し、使用後にテスト用コンテキストを解放する", () => {
        // Arrange
        const { loseContext } = setupEnvironment();

        // Act
        render(<Experience categories={[]} />);

        // Assert
        expect(screen.getByTestId("scene")).toBeInTheDocument();
        expect(loseContext).toHaveBeenCalledTimes(1);
        expect(motionButton()).toHaveTextContent("PAUSE MOTION");
        expect(motionButton()).toHaveAttribute("aria-pressed", "false");
    });

    it.each(["unsupported", "throws"] as const)(
        "WebGL2 が %s の場合は Scene を描画しない",
        (webgl) => {
            // Arrange
            setupEnvironment({ webgl });

            // Act
            render(<Experience categories={[]} />);

            // Assert
            expect(screen.queryByTestId("scene")).not.toBeInTheDocument();
            expect(screen.getByTestId("gem-fallback")).toBeInTheDocument();
        }
    );

    it("一時停止で Scene を外し、再開で戻す", () => {
        // Arrange
        setupEnvironment();
        render(<Experience categories={[]} />);

        // Act
        fireEvent.click(motionButton());

        // Assert
        expect(screen.queryByTestId("scene")).not.toBeInTheDocument();
        expect(motionButton()).toHaveAttribute("aria-pressed", "true");
        expect(motionButton()).toHaveTextContent("RESUME MOTION");
        expect(motionButton()).toHaveAccessibleName(
            "Resume animation / 演出を再開"
        );

        // Act
        fireEvent.click(motionButton());

        // Assert
        expect(screen.getByTestId("scene")).toBeInTheDocument();
        expect(motionButton()).toHaveAccessibleName(
            "Pause animation / 演出を停止"
        );
    });

    it("画面内かつタブ表示中の時だけ Scene を active にする", () => {
        // Arrange
        setupEnvironment();
        render(<Experience categories={[]} />);
        expect(screen.getByTestId("scene")).toHaveAttribute(
            "data-active",
            "false"
        );

        // Act & Assert: 画面内に入る
        intersect(true);
        expect(screen.getByTestId("scene")).toHaveAttribute(
            "data-active",
            "true"
        );

        // Act & Assert: タブが非表示になる
        const hidden = jest
            .spyOn(document, "hidden", "get")
            .mockReturnValue(true);
        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
        expect(screen.getByTestId("scene")).toHaveAttribute(
            "data-active",
            "false"
        );
        hidden.mockRestore();

        // Act & Assert: 画面外へ出る
        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
        expect(screen.getByTestId("scene")).toHaveAttribute(
            "data-active",
            "true"
        );
        intersect(false);
        expect(screen.getByTestId("scene")).toHaveAttribute(
            "data-active",
            "false"
        );
    });

    it("モバイル幅では compact を Scene に渡す", () => {
        // Arrange
        setupEnvironment({ compact: true });

        // Act
        render(<Experience categories={[]} />);

        // Assert
        expect(screen.getByTestId("scene")).toHaveAttribute(
            "data-compact",
            "true"
        );
    });

    it("Scene が例外を投げても境界で握り、HTML の導線は残す", () => {
        // Arrange
        setupEnvironment();
        const consoleError = jest
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        // React は並行描画のエラーを 1 度同期で再試行するため、Once ではなく常に throw させる
        mockScene.mockImplementation(() => {
            throw new Error("GPU lost");
        });

        // Act
        render(<Experience categories={[]} />);

        // Assert
        expect(screen.queryByTestId("scene")).not.toBeInTheDocument();
        expect(
            screen.getByRole("heading", { level: 1, name: /Luxuries/ })
        ).toBeInTheDocument();
        consoleError.mockRestore();
    });

    it("アンマウント時に observer / listener / animation frame を解放する", () => {
        // Arrange
        const { mediaRemove } = setupEnvironment();
        const removeSpy = jest.spyOn(document, "removeEventListener");
        const { unmount } = render(<Experience categories={[]} />);

        // Act
        unmount();

        // Assert
        expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
        expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
        expect(mediaRemove).toHaveBeenCalledWith(
            "change",
            expect.any(Function)
        );
        expect(removeSpy).toHaveBeenCalledWith(
            "visibilitychange",
            expect.any(Function)
        );
        removeSpy.mockRestore();
    });
});
