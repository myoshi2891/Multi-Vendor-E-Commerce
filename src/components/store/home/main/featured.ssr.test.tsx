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
		// サーバーサイド（windowが未定義）でレンダリングしてもクラッシュしないことを期待する
		// 現在の実装では window is not defined エラーにより、このアサーションは失敗（Red）します。
		expect(() => {
			renderToString(<Featured products={[]} />);
		}).not.toThrow();
	});
});
