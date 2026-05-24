/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { createMockUser } from "@/config/test-fixtures";
import ModalProvider, { useModal } from "./modal-provider";

// React 18 向けの act 環境設定
declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockUser = createMockUser();

// テスト用コンポーネント
const TestComponent = () => {
    const { setOpen, setClose, isOpen, data } = useModal();

    return (
        <div>
            <div data-testid="is-open">{isOpen.toString()}</div>
            <div data-testid="data-user-id">{data.user?.id || "no-user"}</div>
            <button
                type="button"
                data-testid="open-btn"
                onClick={() =>
                    setOpen(
                        <div data-testid="modal-content">Modal Content</div>
                    )
                }
            >
                Open
            </button>
            <button
                type="button"
                data-testid="open-with-data-btn"
                onClick={() =>
                    setOpen(
                        <div data-testid="modal-content">Modal Content</div>,
                        async () => ({
                            user: mockUser,
                        })
                    )
                }
            >
                Open With Data
            </button>
            <button
                type="button"
                data-testid="open-null-btn"
                onClick={() => setOpen(null)}
            >
                Open Null
            </button>
            <button
                type="button"
                data-testid="close-btn"
                onClick={() => setClose()}
            >
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
        it("[P1] マウント後に children がレンダリングされる", () => {
            // SSRや初回レンダリングで isMounted=false の状態を検証
            // jsdom環境では useEffect が即座に発火するため、
            // マウント前(return null)を直接アサートするのは難しい。
            const { container } = render(
                <ModalProvider>
                    <div data-testid="child">Child</div>
                </ModalProvider>
            );

            expect(screen.getByTestId("child")).toBeInTheDocument();
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
            expect(
                screen.queryByTestId("modal-content")
            ).not.toBeInTheDocument();

            const user = userEvent.setup();
            await user.click(screen.getByTestId("open-btn"));

            // findByTestId は要素が DOM に commit されるまで内部で retry する。
            // React のバッチコミット仕様により、modal-content が見えた時点で
            // 同じ render phase でセットされた isOpen も "true" になっている。
            expect(await screen.findByTestId("modal-content")).toBeInTheDocument();
            expect(screen.getByTestId("is-open")).toHaveTextContent("true");
        });

        it("[P1] fetchData ありでデータが data にマージされる", async () => {
            render(
                <ModalProvider>
                    <TestComponent />
                </ModalProvider>
            );

            expect(screen.getByTestId("data-user-id")).toHaveTextContent(
                "no-user"
            );

            const user = userEvent.setup();
            await user.click(screen.getByTestId("open-with-data-btn"));

            await waitFor(() => {
                expect(screen.getByTestId("data-user-id")).toHaveTextContent(
                    mockUser.id
                );
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
            expect(screen.getByTestId("data-user-id")).toHaveTextContent(
                "no-user"
            );
        });

        it("[P1] fetchData が例外を投げてもモーダルは開き、エラーがログに記録される", async () => {
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});

            try {
                const FailFetchComponent = () => {
                    const { setOpen, isOpen } = useModal();
                    return (
                        <>
                            <div data-testid="is-open-direct">
                                {isOpen.toString()}
                            </div>
                            <button
                                type="button"
                                data-testid="open-fail-btn"
                                onClick={() =>
                                    setOpen(
                                        <div data-testid="modal-content-fail">
                                            Modal
                                        </div>,
                                        async () => {
                                            throw new Error("fetch failed");
                                        }
                                    )
                                }
                            >
                                Open Fail
                            </button>
                        </>
                    );
                };

                render(
                    <ModalProvider>
                        <FailFetchComponent />
                    </ModalProvider>
                );

                const user = userEvent.setup();
                await user.click(screen.getByTestId("open-fail-btn"));

                await waitFor(() => {
                    expect(
                        screen.getByTestId("is-open-direct")
                    ).toHaveTextContent("true");
                });
                // fetchData の失敗がログに記録される
                expect(consoleSpy).toHaveBeenCalledWith(
                    "Failed to fetch modal data:",
                    "fetch failed",
                    expect.any(String)
                );
                // fetchData が失敗してもモーダルコンテンツは表示される（グレースフルデグラデーション）
                expect(
                    screen.getByTestId("modal-content-fail")
                ).toBeInTheDocument();
            } finally {
                consoleSpy.mockRestore();
            }
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
                expect(screen.getByTestId("is-open")).toHaveTextContent(
                    "false"
                );
            });
        });
    });

    describe("setClose", () => {
        it("[P1] 閉じると isOpen=false になり data がリセットされ、モーダルが DOM から除去される", async () => {
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
            expect(screen.getByTestId("data-user-id")).toHaveTextContent(
                mockUser.id
            );
            expect(screen.getByTestId("modal-content")).toBeInTheDocument();

            // 閉じる
            await user.click(screen.getByTestId("close-btn"));

            await waitFor(() => {
                expect(screen.getByTestId("is-open")).toHaveTextContent(
                    "false"
                );
            });
            expect(screen.getByTestId("data-user-id")).toHaveTextContent(
                "no-user"
            );

            // モーダルが DOM から除去されていることを確認
            expect(
                screen.queryByTestId("modal-content")
            ).not.toBeInTheDocument();
        });
    });

    describe("useModal", () => {
        it("[P1] Provider 内で context を取得できる", () => {
            let contextValue: ReturnType<typeof useModal> | null = null;
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
            expect(contextValue!.isOpen).toBe(false);
            expect(typeof contextValue!.setOpen).toBe("function");
        });

        it("[P1] Provider 外で使用するとエラーがスローされる", () => {
            // React のエラー境界を抑制するために console.error をモック
            const consoleErrorSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});

            try {
                expect(() => render(<OutsideComponent />)).toThrow(
                    "useModal must be used within the modal provider"
                );
            } finally {
                consoleErrorSpy.mockRestore();
            }
        });
    });

    describe("ハイドレーション", () => {
        it("[P1] SSR 環境でマウントされるまでは null を返す（useEffect前）", () => {
            // isMounted=false の状態を意図的に模倣してレンダリング
            // React の useEffect をモックして同期実行を防止する
            const useEffectSpy = jest
                .spyOn(React, "useEffect")
                .mockImplementationOnce(() => {});

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
