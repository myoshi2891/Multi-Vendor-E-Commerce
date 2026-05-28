import "@testing-library/jest-dom";

// jsdom は ResizeObserver を実装していないため、Radix UI の useSize 系
// (Slider / Popover / Tooltip / HoverCard / ScrollArea 等) を含む snapshot テスト用に
// no-op スタブを供給する。実体は不要 — Radix は subscribe して noop でも壊れない。
// `implements ResizeObserver` で TS dom lib の型と構造的に整合させ、unknown キャスト不要。
if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub implements ResizeObserver {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
    }
    globalThis.ResizeObserver = ResizeObserverStub;
}

// jsdom は IntersectionObserver を実装していないため、embla-carousel-react (SlidesInView)
// など viewport 観測を行うライブラリの snapshot テスト用に no-op スタブを供給する。
if (typeof globalThis.IntersectionObserver === "undefined") {
    class IntersectionObserverStub implements IntersectionObserver {
        readonly root = null;
        readonly rootMargin = "";
        readonly thresholds: ReadonlyArray<number> = [];
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
        takeRecords(): IntersectionObserverEntry[] {
            return [];
        }
    }
    globalThis.IntersectionObserver = IntersectionObserverStub;
}

// jsdom は window.matchMedia を実装していないため、embla-carousel-react (OptionsHandler)
// などメディアクエリを購読するライブラリの snapshot テスト用に no-op スタブを供給する。
// 常に matches=false を返し addEventListener/removeEventListener は noop で十分。
if (typeof globalThis.window !== "undefined" && typeof window.matchMedia === "undefined") {
    window.matchMedia = (query: string): MediaQueryList => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    });
}

try {
  // Optional MSW support if tests/mocks/server is defined.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { server } = require("../tests/mocks/server");

  if (server) {
    // onUnhandledRequest: "warn" (ADR-003 仮説 B)
    // 旧設定の "error" は、tests/mocks/server.ts がハンドラ 0 件の空サーバーであるため
    // React 19 / RTL の内部 fetch やテスト中の偶発的 fetch をすべて throw 化していた。
    // それが unhandled rejection として Jest の通常 assertion failure reporter を通らない
    // タイプのエラー (「同名テスト 3 回列挙・本文空」OI-8 症状) を CI runner 上で生んでいた
    // 可能性が高い。"warn" に切り替え、unhandled request は warning log として残しつつ
    // test failure にはしない方針。将来 MSW で外部 API モックを追加した場合も、handler
    // 一致しない fetch は warn として可視化されるため検知性は維持される。
    beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());
  }
} catch {
  // MSW not configured yet.
}
