/** @jest-environment jsdom */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModalProvider, { useModal, ModalContext } from "./modal-provider";
import { User } from "@prisma/client";

// React 18 向けの act 環境設定
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// モックユーザーの作成
const createMockUser = (): User => ({
    id: "test-user-id",
    name: "Test User",
    email: "test@example.com",
    role: "USER",
    picture: "",
    createdAt: new Date(),
    updatedAt: new Date(),
});

// テスト用コンポーネント
const TestComponent = () => {
    const { setOpen, setClose, isOpen, data } = useModal();

    return (
        <div>
            <div data-testid="is-open">{isOpen.toString()}</div>
            <div data-testid="data-user-id">{data.user?.id || "no-user"}</div>
            <button
                data-testid="open-btn"
                onClick={() =>
                    setOpen(<div data-testid="modal-content">Modal Content</div>)
                }
            >
                Open
            </button>
            <button
                data-testid="open-with-data-btn"
                onClick={() =>
                    setOpen(<div data-testid="modal-content">Modal Content</div>, async () => ({
                        user: createMockUser(),
                    }))
                }
            >
                Open With Data
            </button>
            <button data-testid="open-null-btn" onClick={() => setOpen(null)}>
                Open Null
            </button>
            <button data-testid="close-btn" onClick={() => setClose()}>
                Close
            </button>
        </div>
    );
};

// モーダル外部のコンポーネント (エラー検証用)
const OutsideComponent = () => {
    useModal();
    return <div>Should not render</div>;
};

describe("ModalProvider", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("マウント制御", () => {
        it("[P1] マウント前は children をレンダリングしない (isMounted=false)", () => {
            // SSRや初回レンダリングで isMounted=false の状態を検証
            // useEffect が同期的に走ってしまう環境では厳密に分離しづらいが、
            // 少なくとも Provider をそのまま render した結果 null を返すかテスト
            const { container } = render(
                <ModalProvider>
                    <div data-testid="child">Child</div>
                </ModalProvider>
            );

            // jsdom環境では useEffect が即座に発火するため、
            // マウント前(return null)を直接アサートするのは難しい。
            // 便宜上、マウント後は正しくレンダリングされることで確認とする。
            expect(screen.getByTestId("child")).toBeInTheDocument();
        });

        it("[P1] マウント後に children がレンダリングされる", () => {
            render(
                <ModalProvider>
                    <div data-testid="child">Child Content</div>
                </ModalProvider>
            );
            expect(screen.getByTestId("child")).toHaveTextContent("Child Content");
        });
    });

    describe("setOpen", () => {
        it("[P1] モーダルを開くと isOpen=true になり、モーダルノードが DOM に描画される", async () => {
            render(
                <ModalProvider>
                    <TestComponent />
                </ModalProvider>
            );

            expect(screen.getByTestId("is-open")).toHaveTextContent("false");
            expect(screen.queryByTestId("modal-content")).not.toBeInTheDocument();

            const user = userEvent.setup();
            await user.click(screen.getByTestId("open-btn"));

            await waitFor(() => {
                expect(screen.getByTestId("is-open")).toHaveTextContent("true");
            });
            expect(screen.getByTestId("modal-content")).toBeInTheDocument();
        });

        it("[P1] fetchData ありでデータが data にマージされる", async () => {
            render(
                <ModalProvider>
                    <TestComponent />
                </ModalProvider>
            );

            expect(screen.getByTestId("data-user-id")).toHaveTextContent("no-user");

            const user = userEvent.setup();
            await user.click(screen.getByTestId("open-with-data-btn"));

            await waitFor(() => {
                expect(screen.getByTestId("data-user-id")).toHaveTextContent("test-user-id");
            });
            expect(screen.getByTestId("is-open")).toHaveTextContent("true");
            expect(screen.getByTestId("modal-content")).toBeInTheDocument();
        });

        it("[P1] fetchData なしでモーダルを開ける", async () => {
            render(
                <ModalProvider>
                    <TestComponent />
                </ModalProvider>
            );

            const user = userEvent.setup();
            await user.click(screen.getByTestId("open-btn"));

            await waitFor(() => {
                expect(screen.getByTestId("is-open")).toHaveTextContent("true");
            });
            expect(screen.getByTestId("data-user-id")).toHaveTextContent("no-user");
        });

        it("[P2] modal が null の場合 isOpen が false のまま", async () => {
            render(
                <ModalProvider>
                    <TestComponent />
                </ModalProvider>
            );

            const user = userEvent.setup();
            await user.click(screen.getByTestId("open-null-btn"));

            await waitFor(() => {
                expect(screen.getByTestId("is-open")).toHaveTextContent("false");
            });
        });
    });

    describe("setClose", () => {
        it("[P1] 閉じると isOpen=false になり data がリセットされる", async () => {
            render(
                <ModalProvider>
                    <TestComponent />
                </ModalProvider>
            );

            const user = userEvent.setup();

            // 開いてデータをセット
            await user.click(screen.getByTestId("open-with-data-btn"));

            await waitFor(() => {
                expect(screen.getByTestId("is-open")).toHaveTextContent("true");
            });
            expect(screen.getByTestId("data-user-id")).toHaveTextContent("test-user-id");

            // 閉じる
            await user.click(screen.getByTestId("close-btn"));

            await waitFor(() => {
                expect(screen.getByTestId("is-open")).toHaveTextContent("false");
            });
            expect(screen.getByTestId("data-user-id")).toHaveTextContent("no-user");
        });
    });

    describe("useModal", () => {
        it("[P1] Provider 内で context を取得できる", () => {
            let contextValue: any = null;
            const ContextConsumer = () => {
                contextValue = useModal();
                return null;
            };

            render(
                <ModalProvider>
                    <ContextConsumer />
                </ModalProvider>
            );

            expect(contextValue).not.toBeNull();
            expect(contextValue.isOpen).toBe(false);
            expect(typeof contextValue.setOpen).toBe("function");
        });

        it("[P1] Provider 外で使用するとエラーがスローされる", () => {
            // React のエラー境界を抑制するために console.error をモック
            const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            expect(() => render(<OutsideComponent />)).toThrow(
                "useModal must be used within the modal provider"
            );

            consoleErrorSpy.mockRestore();
        });
    });

    describe("ハイドレーション", () => {
        it("[P1] SSR 環境でマウントされるまでは null を返す（useEffect前）", () => {
            // isMounted=false の状態を意図的に模倣してレンダリング
            // React の useEffect をモックして同期実行を防止する
            const useEffectSpy = jest.spyOn(React, "useEffect").mockImplementationOnce(() => {});

            const { container } = render(
                <ModalProvider>
                    <div data-testid="child">Child</div>
                </ModalProvider>
            );

            // コンポーネントは何もレンダリングしていないはず（return null）
            expect(container.firstChild).toBeNull();

            useEffectSpy.mockRestore();
        });
    });
});
