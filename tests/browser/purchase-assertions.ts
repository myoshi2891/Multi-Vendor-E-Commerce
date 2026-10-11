import { expect, type Locator } from "@playwright/test";

/** Verify the visible focus indicator against its painted surrounding surface. */
export async function expectReadableFocus(control: Locator) {
    await control.focus();
    await expect(control).toBeFocused();
    await expect(control).toHaveCSS("outline-style", "solid");
    const contrast = await control.evaluate((element) => {
        const rgb = (color: string) => color.match(/[\d.]+/g)!.map(Number);
        const luminance = (channels: number[]) =>
            channels.slice(0, 3).map(value => {
                const s = value / 255;
                return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
            }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
        let parent = element.parentElement;
        let background = [255, 255, 255];
        while (parent) {
            const color = rgb(getComputedStyle(parent).backgroundColor);
            if (color.length === 3 || color[3] === 1) {
                background = color;
                break;
            }
            parent = parent.parentElement;
        }
        const foreground = luminance(rgb(getComputedStyle(element).outlineColor));
        const surface = luminance(background);
        return (Math.max(foreground, surface) + 0.05) / (Math.min(foreground, surface) + 0.05);
    });
    expect(contrast, "Focus indicator must contrast with the surrounding surface").toBeGreaterThanOrEqual(3);
}
