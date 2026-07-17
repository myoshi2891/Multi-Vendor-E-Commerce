/**
 * 構造化エラーログの共通ヘルパー。
 * `.claude/steering/tech.md` の規約に合わせ、第1引数を "[Module:Function] message"、
 * 第2引数を { error, stack }（Error 以外は { error }）で出力する。
 *
 * @param tag "[Module:Function] message" 形式のタグ付きメッセージ
 * @param error catch した unknown なエラー値
 */
export function logError(tag: string, error: unknown): void {
    if (error instanceof Error) {
        console.error(tag, { error: error.message, stack: error.stack });
    } else {
        console.error(tag, { error });
    }
}
