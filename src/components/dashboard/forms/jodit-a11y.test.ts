/** @jest-environment jsdom */
import { applyJoditToolbarA11y, observeJoditA11y } from "./jodit-a11y";

// jodit 4.6.2 の ToolbarButton が組み立てる DOM と同じ形（modules/toolbar/button/button.js）
const toolbarHtml = `
<div class="jodit-toolbar__box">
  <div class="jodit-ui-group jodit-ui-group_group_font-style">
    <span class="jodit-toolbar-button jodit-toolbar-button_bold" role="listitem" aria-label="Bold">
      <button class="jodit-toolbar-button__button" role="button" type="button" tabindex="-1"><svg></svg></button>
    </span>
    <span class="jodit-toolbar-button jodit-toolbar-button_ul" role="listitem" aria-label="Insert Unordered List">
      <button class="jodit-toolbar-button__button" role="button" type="button" tabindex="-1"><svg></svg></button>
      <span role="trigger" class="jodit-toolbar-button__trigger"><svg></svg></span>
    </span>
  </div>
</div>`;

const mount = () => {
    const root = document.createElement("div");
    root.innerHTML = toolbarHtml;
    document.body.appendChild(root);
    return root;
};

afterEach(() => {
    document.body.innerHTML = "";
});

describe("applyJoditToolbarA11y", () => {
    it("ツールバーのボタンに名前を付け、listitem の親を list にし、不正な role を外す", () => {
        // Arrange
        const root = mount();

        // Act
        applyJoditToolbarA11y(root);

        // Assert
        const buttons = root.querySelectorAll(".jodit-toolbar-button__button");
        expect(
            Array.from(buttons, (b) => b.getAttribute("aria-label"))
        ).toEqual(["Bold", "Insert Unordered List"]);
        root.querySelectorAll('[role="listitem"]').forEach((item) => {
            expect(item.parentElement?.getAttribute("role")).toBe("list");
        });
        expect(root.querySelector('[role="trigger"]')).toBeNull();
        expect(
            root
                .querySelector(".jodit-toolbar-button__trigger")
                ?.getAttribute("aria-hidden")
        ).toBe("true");
    });

    it("繰り返し適用しても結果が変わらない（ツールバー再構築時の再適用に備える）", () => {
        // Arrange
        const root = mount();
        applyJoditToolbarA11y(root);
        const once = root.innerHTML;

        // Act
        applyJoditToolbarA11y(root);

        // Assert
        expect(root.innerHTML).toBe(once);
    });

    it("既に role を持つ親や名前の無い listitem は変更しない", () => {
        // Arrange
        const root = document.createElement("div");
        root.innerHTML = `<div role="toolbar"><span role="listitem"><button class="jodit-toolbar-button__button"></button></span></div>`;

        // Act
        applyJoditToolbarA11y(root);

        // Assert
        expect(root.firstElementChild?.getAttribute("role")).toBe("toolbar");
        expect(root.querySelector("button")?.hasAttribute("aria-label")).toBe(
            false
        );
    });
});

describe("observeJoditA11y", () => {
    it("マウント後に差し込まれたツールバーにも補正を適用し、cleanup 後は適用しない", async () => {
        // Arrange
        const container = document.createElement("div");
        document.body.appendChild(container);
        const cleanup = observeJoditA11y(container);

        // Act: Jodit は dynamic import 後に非同期でツールバーを差し込む
        container.innerHTML = toolbarHtml;
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Assert
        expect(
            container
                .querySelector(".jodit-toolbar-button__button")
                ?.getAttribute("aria-label")
        ).toBe("Bold");
        expect(container.querySelector('[role="trigger"]')).toBeNull();

        // Act: アンマウント（タブ切替）後は監視しない
        cleanup?.();
        container.innerHTML = toolbarHtml;
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Assert
        expect(container.querySelector('[role="trigger"]')).not.toBeNull();
    });

    it("要素が外れたとき（null）は何もしない", () => {
        expect(observeJoditA11y(null)).toBeUndefined();
    });
});
