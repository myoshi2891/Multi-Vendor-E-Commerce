/**
 * jodit 4.6.2 のツールバーが持つ ARIA の不備を補正する（upstream の不具合への局所対応）。
 *
 * - ToolbarButton は名前（tooltip）を外側の `role="listitem"` に付け、実際に押す内側の
 *   `<button>` は名前を持たない（axe: button-name）。
 * - listitem の親グループが `role="list"` を持たない（axe: aria-required-parent）。
 * - ドロップダウン矢印が仕様に無い `role="trigger"` を持つ（axe: aria-roles）。矢印は元から
 *   キーボード操作の対象外の装飾なので、role を外して支援技術から隠す。
 *
 * 何度適用しても同じ結果になる（ツールバーの再構築ごとに再適用するため）。
 */
export function applyJoditToolbarA11y(root: ParentNode): void {
    root.querySelectorAll('[role="listitem"]').forEach((item) => {
        const label = item.getAttribute("aria-label");
        const button = item.querySelector(".jodit-toolbar-button__button");
        if (label && button && !button.hasAttribute("aria-label")) {
            button.setAttribute("aria-label", label);
        }
        const parent = item.parentElement;
        if (parent && !parent.hasAttribute("role")) {
            parent.setAttribute("role", "list");
        }
    });
    root.querySelectorAll('[role="trigger"]').forEach((trigger) => {
        trigger.removeAttribute("role");
        trigger.setAttribute("aria-hidden", "true");
    });
}

/**
 * callback ref として要素へ渡し、配下の Jodit ツールバーへ {@link applyJoditToolbarA11y} を適用し続ける。
 *
 * - Jodit は dynamic import 後の初期化や幅の変化でツールバーを作り直すため、子要素の追加を監視する。
 *   監視は childList のみ（属性の変更は監視しない）なので、補正自身の書き込みで再発火しない。
 * - useEffect ではなく callback ref にしているのは、タブ（Radix TabsContent）の切り替えで後から
 *   マウントされるエディターにも追従するため。React 19 の ref cleanup で監視を止める。
 */
export function observeJoditA11y(
    node: HTMLElement | null
): (() => void) | undefined {
    if (!node) return undefined;
    applyJoditToolbarA11y(node);
    const observer = new MutationObserver(() => applyJoditToolbarA11y(node));
    observer.observe(node, { childList: true, subtree: true });
    return () => observer.disconnect();
}
