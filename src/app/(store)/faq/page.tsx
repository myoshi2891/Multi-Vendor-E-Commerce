import { permanentRedirect } from "next/navigation";

/**
 * 旧 "/faq" リンク（footer:66-68）を正規の "/faqs" に集約する。
 * 恒久的な統合のため 308（Permanent Redirect）を返す `permanentRedirect` を使う
 * （`redirect` は 307 Temporary。統合は恒久的なため 308 を選択）。
 */
export default function FaqRedirectPage() {
    permanentRedirect("/faqs");
}
