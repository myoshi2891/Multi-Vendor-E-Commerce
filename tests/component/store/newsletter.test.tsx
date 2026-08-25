/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Newsletter from "@/components/store/layout/footer/newsletter";
import toast from "react-hot-toast";

/**
 * Newsletter フォーム（`src/components/store/layout/footer/newsletter.tsx`）の
 * クライアント側配線を固定する。
 *
 * 本コンポーネントは `.claude/steering/tech.md` が**リエントランシーガードの実装例として
 * 指名している**箇所（`isSubmittingRef`）でありながら lcov 0% だった。
 *
 * ⚠️ **成功パスは「配線」の特性化であって、エンドポイントが動くことの証明ではない。**
 * `/api/newsletter` route はリポジトリに存在せず、実ブラウザでは常に 404 になる
 * （dormant 機能ギャップ / TESTS-39。実挙動の固定は `tests/e2e/newsletter.spec.ts` が担当）。
 * ここで検証しているのは「fetch がどこへ何を送り、応答の形ごとに何をするか」だけである。
 */

jest.mock("react-hot-toast", () => ({
    __esModule: true,
    default: {
        error: jest.fn(),
        success: jest.fn(),
    },
}));

describe("Newsletter", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    const mockedFetch = () => global.fetch as jest.Mock;

    /** email を入力して submit する。フォーム submit は HTML5 検証を経由しない */
    const submitWith = (email: string) => {
        const input = screen.getByLabelText("Email address");
        fireEvent.change(input, { target: { value: email } });
        fireEvent.submit(input.closest("form") as HTMLFormElement);
    };

    it("submits the email to /api/newsletter and resets the form on success", async () => {
        // Arrange
        mockedFetch().mockResolvedValue({ ok: true });
        render(<Newsletter />);

        // Act
        submitWith("subscriber@example.com");

        // Assert: fetch の宛先・メソッド・body を固定する
        await waitFor(() => {
            expect(mockedFetch()).toHaveBeenCalledTimes(1);
        });
        const [url, init] = mockedFetch().mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(url).toBe("/api/newsletter");
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body as string)).toEqual({
            email: "subscriber@example.com",
        });

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith(
                "Successfully subscribed to newsletter!"
            );
        });
        // form.reset() は成功時のみ呼ばれる
        expect(screen.getByLabelText("Email address")).toHaveValue("");
    });

    it("guards against double submission while a request is in flight", async () => {
        // Arrange: 解決を握った deferred。`new Promise(() => {})` だと finally へ到達せず
        // ガードが解放されないままテストが終わり、「ガードが効いた」のか
        // 「単に永久 pending だった」のか区別できない。
        let resolveFetch: (value: { ok: boolean }) => void = () => {};
        const pending = new Promise<{ ok: boolean }>((resolve) => {
            resolveFetch = resolve;
        });
        mockedFetch().mockReturnValue(pending);
        render(<Newsletter />);

        // Act: 1 回目の送信が in-flight のまま 2 回目を撃つ
        submitWith("subscriber@example.com");
        await waitFor(() => {
            expect(mockedFetch()).toHaveBeenCalledTimes(1);
        });
        submitWith("subscriber@example.com");

        // Assert: isSubmittingRef により 2 回目は弾かれる
        expect(mockedFetch()).toHaveBeenCalledTimes(1);

        // 解放して finally を通し、ガードが戻ることまで見る
        resolveFetch({ ok: true });
        await waitFor(() => {
            expect(toast.success).toHaveBeenCalled();
        });
        submitWith("subscriber@example.com");
        await waitFor(() => {
            expect(mockedFetch()).toHaveBeenCalledTimes(2);
        });
    });

    it("shows the generic error toast when the response is not ok", async () => {
        // Arrange
        mockedFetch().mockResolvedValue({ ok: false });
        render(<Newsletter />);

        // Act
        submitWith("subscriber@example.com");

        // Assert
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("Failed to subscribe.");
        });
        expect(toast.success).not.toHaveBeenCalled();
        // 失敗時は form.reset() が呼ばれないので入力値が残る
        expect(screen.getByLabelText("Email address")).toHaveValue(
            "subscriber@example.com"
        );
    });

    it("shows the timeout toast when the request aborts", async () => {
        // Arrange: AbortController の 8s タイムアウト経路。name で分岐するので
        // Error のサブクラスではなく name を差し替えた Error を投げる。
        mockedFetch().mockRejectedValue(
            Object.assign(new Error("aborted"), { name: "AbortError" })
        );
        render(<Newsletter />);

        // Act
        submitWith("subscriber@example.com");

        // Assert
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                "Request timed out. Please try again."
            );
        });
        expect(toast.error).not.toHaveBeenCalledWith("Failed to subscribe.");
    });
});
