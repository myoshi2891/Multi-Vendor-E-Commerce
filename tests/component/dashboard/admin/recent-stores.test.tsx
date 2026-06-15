/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RecentStores } from "@/components/dashboard/admin/recent-stores";
import { StoreStatus } from "@prisma/client";

type Store = React.ComponentProps<typeof RecentStores>["stores"][number];

const makeStore = (overrides: Partial<Store> = {}): Store =>
    ({
        id: "store-001",
        name: "テスト店舗",
        createdAt: new Date("2024-04-01"),
        status: StoreStatus.ACTIVE,
        isDeleted: false,
        url: "test-store",
        userId: "user-001",
        description: null,
        logo: null,
        cover: null,
        updatedAt: new Date("2024-04-01"),
        ...overrides,
    } as Store);

describe("RecentStores", () => {
    it("正常系: ストアリストを描画する", () => {
        // Arrange
        const stores = [
            makeStore({ name: "店舗 A", status: StoreStatus.ACTIVE }),
            makeStore({ id: "store-002", name: "店舗 B", status: StoreStatus.PENDING }),
        ];

        // Act
        render(<RecentStores stores={stores} />);

        // Assert
        expect(screen.getByText("店舗 A")).toBeInTheDocument();
        expect(screen.getByText("店舗 B")).toBeInTheDocument();
    });

    it("正常系: 空の場合「店舗がありません。」を表示する", () => {
        // Arrange & Act — stores.length === 0 の分岐
        render(<RecentStores stores={[]} />);

        // Assert
        expect(screen.getByText("店舗がありません。")).toBeInTheDocument();
    });

    it("正常系: ACTIVE ステータスのバッジを「アクティブ」と表示する", () => {
        // Arrange & Act
        render(<RecentStores stores={[makeStore({ status: StoreStatus.ACTIVE })]} />);

        // Assert — STATUS_LABEL["ACTIVE"] の分岐
        expect(screen.getByText("アクティブ")).toBeInTheDocument();
    });

    it("正常系: PENDING ステータスのバッジを「審査中」と表示する", () => {
        // Arrange & Act
        render(<RecentStores stores={[makeStore({ status: StoreStatus.PENDING })]} />);

        // Assert
        expect(screen.getByText("審査中")).toBeInTheDocument();
    });

    it("正常系: BANNED ステータスのバッジを「BAN」と表示する", () => {
        // Arrange & Act
        render(<RecentStores stores={[makeStore({ status: StoreStatus.BANNED })]} />);

        // Assert
        expect(screen.getByText("BAN")).toBeInTheDocument();
    });

    it("正常系: DISABLED ステータスのバッジを「無効」と表示する", () => {
        // Arrange & Act
        render(<RecentStores stores={[makeStore({ status: StoreStatus.DISABLED })]} />);

        // Assert
        expect(screen.getByText("無効")).toBeInTheDocument();
    });

    it("正常系: 未知ステータスは status をそのまま表示し outline バリアントになる", () => {
        // Arrange — STATUS_LABEL/STATUS_VARIANT の ?? フォールバック分岐をカバー
        const store = makeStore({ status: "UNKNOWN_STATUS" as StoreStatus });

        // Act
        render(<RecentStores stores={[store]} />);

        // Assert
        expect(screen.getByText("UNKNOWN_STATUS")).toBeInTheDocument();
    });

    it("正常系: createdAt を日本語ロケールの日付でフォーマットする", () => {
        // Arrange
        const store = makeStore({ createdAt: new Date("2024-04-01") });

        // Act
        render(<RecentStores stores={[store]} />);

        // Assert
        expect(screen.getByText("2024/4/1")).toBeInTheDocument();
    });
});
