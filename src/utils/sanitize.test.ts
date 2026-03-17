import { sanitize } from "./sanitize";
import { TEST_CONFIG } from "@/config/test-config";

describe("sanitize", () => {
    describe("正常系", () => {
        it("[P1] プレーンテキストをそのまま返す", () => {
            const input = "Hello, world! This is a simple test.";
            expect(sanitize(input)).toBe(input);
        });

        it("[P1] 安全な HTML タグ (<p>, <b>, <em>, <strong>) を保持する", () => {
            const input =
                "<p>This is <b>bold</b> and <em>italic</em> and <strong>strong</strong>.</p>";
            expect(sanitize(input)).toBe(input);
        });

        it("[P2] 空文字を入力すると空文字を返す", () => {
            expect(sanitize("")).toBe("");
        });
    });

    describe("XSS 防御 (異常系)", () => {
        it("[P0] <script>alert('xss')</script> を除去する", () => {
            const input =
                "Hello <script>alert('xss')</script>World";
            expect(sanitize(input)).toBe("Hello World");
        });

        it("[P0] <img onerror=\"alert(1)\"> の onerror を除去する", () => {
            const input = '<img src="invalid.jpg" onerror="alert(1)">';
            // img タグ自体は残るが、onerror 属性は除去される
            expect(sanitize(input)).toBe('<img src="invalid.jpg">');
        });

        it("[P0] <a href=\"javascript:alert(1)\"> の javascript: URI を除去する", () => {
            const input = '<a href="javascript:alert(1)">Click me</a>';
            // href 属性が除去されるか、安全な href に置き換わる
            expect(sanitize(input)).toBe("<a>Click me</a>");
        });

        it("[P0] <svg onload=\"alert(1)\"> の onload を除去する", () => {
            const input = '<svg onload="alert(1)"><circle/></svg>';
            expect(sanitize(input)).toBe("<svg><circle></circle></svg>");
        });

        it("[P0] <iframe src=\"evil.com\"> を除去する", () => {
            const input = 'Here is an iframe: <iframe src="http://evil.com"></iframe>';
            // iframe はデフォルトで除去されることが多い
            expect(sanitize(input)).toBe("Here is an iframe: ");
        });

        it("[P0] onclick/onmouseover 等のイベントハンドラを除去する", () => {
            const input =
                '<div onclick="alert(1)" onmouseover="alert(2)">Hover me</div>';
            expect(sanitize(input)).toBe("<div>Hover me</div>");
        });

        it("[P0] HTML エンティティエンコードされた XSS を処理する", () => {
            // JavaScript プロトコルがエンコードされているケース
            const input =
                '<a href="jav&#x09;ascript:alert(1)">Click</a>';
            expect(sanitize(input)).toBe("<a>Click</a>");
        });
    });

    describe("エッジケース", () => {
        it("[P1] ネストされた悪意タグの除去", () => {
            const input =
                "<p>Text<script>alert('<script>alert(1)</script>')</script></p>";
            // DOMPurify removes the scripts but might leave trailing string characters from the innermost string literal.
            expect(sanitize(input)).toBe("<p>Text')</p>");
        });

        it("[P2] 1000文字超の長文字列でクラッシュしない", () => {
            const input = TEST_CONFIG.EDGE_CASES.VERY_LONG_STRING;
            const result = sanitize(input);
            expect(result).toBe(input);
            expect(result.length).toBe(1000);
        });

        it("[P2] 日本語テキストを含む HTML を正しく処理する", () => {
            const input = `<p>${TEST_CONFIG.EDGE_CASES.UNICODE_STRING}</p>`;
            expect(sanitize(input)).toBe(input);
        });

        it("[P2] data-* カスタム属性の取り扱い", () => {
            const input = '<div data-custom="value">Content</div>';
            // DOMPurify はデフォルトで data-* を許容する
            expect(sanitize(input)).toBe(input);
        });
    });
});
