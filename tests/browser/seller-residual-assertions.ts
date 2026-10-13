import { expect, type Locator } from "@playwright/test";

/** Resolve scoped tokens at the painted element, including Portal roots. */
export async function expectTokenColor(target: Locator, property: "color" | "background-color" | "border-top-color" | "outline-color", value: string) {
    const resolved = await target.evaluate((element, token) => {
        const probe = document.createElement("span");
        probe.style.color = token;
        element.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
    }, value);
    await expect(target).toHaveCSS(property, resolved);
}

export async function expectTouch(target: Locator) {
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
}

/** Compare the boundary/focus against the actual opaque surface behind it. */
export async function expectBoundaryContrast(target: Locator, property: "borderTopColor" | "outlineColor") {
    const colors = await target.evaluate((element, key) => {
        // outline は要素の外側に描かれるため、隣接する外側の面（親以上）と比べる。border は従来どおり要素自身から探す。
        let surface: Element | null = key === "outlineColor" ? element.parentElement : element;
        while (surface && /^(transparent|rgba\(.*,[ ]*0\))$/.test(getComputedStyle(surface).backgroundColor)) {
            surface = surface.parentElement;
        }
        return {
            ink: getComputedStyle(element)[key],
            surface: surface ? getComputedStyle(surface).backgroundColor : "rgb(255, 255, 255)",
        };
    }, property);
    const parse = (color: string) => {
        const [r, g, b, a = 1] = color.match(/[\d.]+/g)!.map(Number);
        return { rgb: [r, g, b], alpha: a };
    };
    // 半透明色は下の面へ合成してから輝度を求める（不透明扱いでコントラストを過大評価しない）。
    const over = (top: { rgb: number[]; alpha: number }, base: number[]) => top.rgb.map((channel, index) => channel * top.alpha + base[index] * (1 - top.alpha));
    const ink = parse(colors.ink);
    expect(ink.alpha, `boundary is fully transparent: ${JSON.stringify(colors)}`).toBeGreaterThan(0);
    const surface = over(parse(colors.surface), [255, 255, 255]);
    const luminance = (rgb: number[]) => {
        const channels = rgb.map((channel) => {
            const value = channel / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const values = [luminance(over(ink, surface)), luminance(surface)].sort((a, b) => a - b);
    expect((values[1] + 0.05) / (values[0] + 0.05), JSON.stringify(colors)).toBeGreaterThanOrEqual(3);
}
