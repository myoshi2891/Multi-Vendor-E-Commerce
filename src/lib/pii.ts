/**
 * SupportTicket の PII 列を消去する際に入れる秘匿プレースホルダ。
 * name/email/subject/message はいずれも NOT NULL のため null 化できず、
 * GDPR 消去では redaction マーカーで上書きする。
 *
 * App Router の route ファイル（`src/app/api/**\/route.ts`）は HTTP メソッドと
 * `dynamic` 等の設定以外の named export を許さないため、ハンドラ側ではなく
 * ここに置き、route とテストの双方から import する。
 */
export const REDACTED_PII = "[deleted]";
