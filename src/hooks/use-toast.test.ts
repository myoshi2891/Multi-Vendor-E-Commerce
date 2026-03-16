import { reducer } from "./use-toast";

describe("toast reducer", () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const initialState = { toasts: [] };

  describe("ADD_TOAST", () => {
    it("正常系: トーストが追加される", () => {
      const toast = { id: "1", title: "Test Toast" };
      const action = { type: "ADD_TOAST", toast } as const;
      const state = reducer(initialState, action);

      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0]).toEqual(toast);
    });

    it("正常系: TOAST_LIMIT (1) を超えると最新のみ保持される", () => {
      const state1 = reducer(initialState, {
        type: "ADD_TOAST",
        toast: { id: "1", title: "First" },
      });
      const state2 = reducer(state1, {
        type: "ADD_TOAST",
        toast: { id: "2", title: "Second" },
      });

      expect(state2.toasts).toHaveLength(1);
      expect(state2.toasts[0].id).toBe("2");
      expect(state2.toasts[0].title).toBe("Second");
    });
  });

  describe("UPDATE_TOAST", () => {
    it("正常系: 指定 id のトーストが更新される", () => {
      const state1 = reducer(initialState, {
        type: "ADD_TOAST",
        toast: { id: "1", title: "Original" },
      });

      const state2 = reducer(state1, {
        type: "UPDATE_TOAST",
        toast: { id: "1", title: "Updated" },
      });

      expect(state2.toasts[0].title).toBe("Updated");
    });

    it("正常系: 存在しない id では state が変わらない", () => {
      const state1 = reducer(initialState, {
        type: "ADD_TOAST",
        toast: { id: "1", title: "Original" },
      });

      const state2 = reducer(state1, {
        type: "UPDATE_TOAST",
        toast: { id: "2", title: "Updated" },
      });

      expect(state2.toasts[0].title).toBe("Original");
    });
  });

  describe("DISMISS_TOAST", () => {
    it("正常系: 指定 id の open が false になる", () => {
      const state1 = reducer(initialState, {
        type: "ADD_TOAST",
        toast: { id: "1", title: "Test", open: true },
      });

      const state2 = reducer(state1, {
        type: "DISMISS_TOAST",
        toastId: "1",
      });

      expect(state2.toasts[0].open).toBe(false);
    });

    it("正常系: toastId=undefined で全トーストが dismiss (open: false) される", () => {
      // LIMITが1なので、内部ロジック的には1つだけだが、配列に対する操作としてテスト
      const customInitialState = {
        toasts: [
          { id: "1", open: true },
          { id: "2", open: true },
        ],
      };

      const state = reducer(customInitialState, {
        type: "DISMISS_TOAST",
      });

      expect(state.toasts.every((t) => t.open === false)).toBe(true);
    });

    it("エッジケース: 空 toasts 配列で DISMISS しても例外なし", () => {
      expect(() => {
        reducer(initialState, { type: "DISMISS_TOAST" });
      }).not.toThrow();
    });
  });

  describe("REMOVE_TOAST", () => {
    it("正常系: 指定 id のトーストが除去される", () => {
      const state1 = reducer(initialState, {
        type: "ADD_TOAST",
        toast: { id: "1", title: "Test" },
      });

      const state2 = reducer(state1, {
        type: "REMOVE_TOAST",
        toastId: "1",
      });

      expect(state2.toasts).toHaveLength(0);
    });

    it("正常系: toastId=undefined で全トーストが除去される", () => {
      const customInitialState = {
        toasts: [{ id: "1" }, { id: "2" }],
      };

      const state = reducer(customInitialState, {
        type: "REMOVE_TOAST",
      });

      expect(state.toasts).toHaveLength(0);
    });

    it("エッジケース: 存在しない id で状態が変わらない", () => {
      const state1 = reducer(initialState, {
        type: "ADD_TOAST",
        toast: { id: "1", title: "Test" },
      });

      const state2 = reducer(state1, {
        type: "REMOVE_TOAST",
        toastId: "999",
      });

      expect(state2.toasts).toHaveLength(1);
      expect(state2.toasts[0].id).toBe("1");
    });
  });
});
