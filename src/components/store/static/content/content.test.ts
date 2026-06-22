import { FAQ_SECTIONS } from "./faqs";
import { LEGAL_SECTIONS } from "./legal";
import { PRODUCT_SUPPORT_SECTIONS } from "./product-support";
import { RETURNS_POLICY_SUMMARY } from "./returns";
import type { StaticSection } from "../static-page-layout";

/**
 * 静的コンテンツ定数の構造検証。
 * 文章はプレースホルダのため内容は検証せず、StaticPageLayout が
 * 期待する shape（非空配列・heading/body 文字列）のみを保証する。
 */
describe("static content data", () => {
    const sectionLists: ReadonlyArray<[string, StaticSection[]]> = [
        ["FAQ_SECTIONS", FAQ_SECTIONS],
        ["LEGAL_SECTIONS", LEGAL_SECTIONS],
        ["PRODUCT_SUPPORT_SECTIONS", PRODUCT_SUPPORT_SECTIONS],
    ];

    it.each(sectionLists)(
        "%s は非空で各要素が heading/body 文字列を持つ",
        (_name, sections) => {
            // Assert
            expect(sections.length).toBeGreaterThan(0);
            for (const section of sections) {
                expect(typeof section.heading).toBe("string");
                expect(section.heading.length).toBeGreaterThan(0);
                expect(typeof section.body).toBe("string");
                expect(section.body.length).toBeGreaterThan(0);
            }
        }
    );

    it("RETURNS_POLICY_SUMMARY は title/intro 文字列と非空 points を持つ", () => {
        // Assert
        expect(typeof RETURNS_POLICY_SUMMARY.title).toBe("string");
        expect(RETURNS_POLICY_SUMMARY.title.length).toBeGreaterThan(0);
        expect(typeof RETURNS_POLICY_SUMMARY.intro).toBe("string");
        expect(RETURNS_POLICY_SUMMARY.intro.length).toBeGreaterThan(0);
        expect(RETURNS_POLICY_SUMMARY.points.length).toBeGreaterThan(0);
        for (const point of RETURNS_POLICY_SUMMARY.points) {
            expect(typeof point).toBe("string");
        }
    });
});
