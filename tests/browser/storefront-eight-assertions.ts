import { expect, type Locator } from "@playwright/test";
import { expectReadableFocus } from "./purchase-assertions";

/** Measure rendered touch targets, including keyboard focus contrast on the painted surface. */
export async function storefrontControls(controls: Locator) {
    for (const control of await controls.all()) {
        if (!(await control.isVisible())) continue;
        const box = await control.boundingBox();
        expect(box, await control.innerText()).not.toBeNull();
        expect(box!.width, await control.innerText()).toBeGreaterThanOrEqual(44);
        expect(box!.height, await control.innerText()).toBeGreaterThanOrEqual(44);
        if (!(await control.isDisabled())) await expectReadableFocus(control);
    }
}

export async function storefrontToken(surface: Locator, token: string, property: string, value: string) {
    const original = await surface.evaluate((node, name) => (node as HTMLElement).style.getPropertyValue(name), token);
    try {
        await surface.evaluate((node, data) => (node as HTMLElement).style.setProperty(data.token, data.value), {token, value});
        await expect(surface).toHaveCSS(property, value);
    } finally {
        await surface.evaluate((node, data) => {
            const style = (node as HTMLElement).style;
            if (data.original) style.setProperty(data.token, data.original);
            else style.removeProperty(data.token);
        }, {token, original});
    }
}
