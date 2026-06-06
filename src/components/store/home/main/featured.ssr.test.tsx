/** @jest-environment node */
import React from "react";
import { renderToString } from "react-dom/server";
import Featured from "@/components/store/home/main/featured";

// Swiper などの子コンポーネントをモック化
jest.mock("../../shared/swiper", () => {
	return function MockSwiper() {
		return <div data-testid="mock-swiper" />;
	};
});

describe("Featured Component (SSR environment)", () => {
	it("should not crash during server-side rendering (no window object)", () => {
		// サーバーサイド（windowが未定義）でレンダリングしてもクラッシュしないことを期待する。
		// window 参照は useEffect 内（クライアント専用）にあるため、renderToString では実行されず
		// SSR でも例外は発生しない（Green）。
		expect(() => {
			renderToString(<Featured products={[]} />);
		}).not.toThrow();
	});
});
