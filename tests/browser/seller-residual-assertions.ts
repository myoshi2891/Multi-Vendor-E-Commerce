import { expect, type Locator } from "@playwright/test";

/** Resolve scoped tokens at the painted element, including Portal roots. */
export async function expectTokenColor(target: Locator, property: "color" | "background-color" | "border-top-color", value: string) {
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
