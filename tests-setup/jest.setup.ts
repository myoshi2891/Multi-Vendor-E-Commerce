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
// jsdom は Element.prototype.scrollIntoView を実装していないため、cmdk (Command) など
// 選択中要素を可視領域へスクロールするライブラリの snapshot テスト用に no-op スタブを供給する。
if (
    typeof globalThis.window !== "undefined" &&
    typeof Element.prototype.scrollIntoView === "undefined"
) {
    Element.prototype.scrollIntoView = function (): void {};
}

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

// [FLAKE-DIAG OI-8] TEMP — remove after review-details flake root-caused (QA_HANDOFF OI-8 / Step 6)
// 握り潰された unhandled rejection を、どのテスト実行中かと共に CI ログへ surface させる。
// review-details.test.tsx の「3×バレット・本文空」OI-8 症状は、--verbose でも本文が出ない
// = console.error ではなく unhandledRejection が Jest reporter に集約されている可能性が高い。
// この一時リスナーで真因スタックを可視化する（観測専用。通常の assertion 失敗には影響しない）。
// Jest は setupFilesAfterEach をテストファイルごとに再評価するため、素の
// process.on(...) はワーカー内でファイル数分だけリスナーを累積させ
// MaxListenersExceededWarning と [FLAKE-DIAG] 行の重複を招く。グローバルフラグで
// 一度だけ登録し、afterAll で解除して「同時に最大 1 リスナー」を保証する。
const FLAKE_DIAG_UNHANDLED_REJECTION_KEY = "__flakeDiagUnhandledRejectionListenerInstalled__";

const unhandledRejectionListener = (reason: unknown): void => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  const current =
    typeof expect !== "undefined" && typeof expect.getState === "function"
      ? expect.getState().currentTestName
      : undefined;
  console.error(
    `[FLAKE-DIAG:unhandledRejection] test="${current ?? "unknown"}"`,
    err.message,
    err.stack,
  );
};

const flakeDiagGlobals = globalThis as Record<string, unknown>;

if (!flakeDiagGlobals[FLAKE_DIAG_UNHANDLED_REJECTION_KEY]) {
  process.on("unhandledRejection", unhandledRejectionListener);
  flakeDiagGlobals[FLAKE_DIAG_UNHANDLED_REJECTION_KEY] = true;
}

afterAll(() => {
  process.off("unhandledRejection", unhandledRejectionListener);
  flakeDiagGlobals[FLAKE_DIAG_UNHANDLED_REJECTION_KEY] = false;
});
