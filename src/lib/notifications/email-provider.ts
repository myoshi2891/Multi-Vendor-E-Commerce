import type { NotificationType } from "./mapping";
import { stubEmailProvider } from "./stub-provider";
import type { NotificationParams } from "./templates";

/**
 * メール送信の結果。リポジトリに汎用の Result 型は無いので判別共用体で表す。
 * `errorKind` には宛先・本文を含めない（ログと `lastError` にそのまま入るため）。
 */
export type EmailSendResult =
    | { ok: true; providerMessageId: string }
    | { ok: false; retryable: boolean; errorKind: string };

export type EmailSendInput = {
    to: string;
    templateKey: NotificationType;
    params: NotificationParams;
    /** プロバイダへ渡す冪等キー（`${dedupeKey}:email`） */
    idempotencyKey: string;
};

/**
 * メールプロバイダの差し替え口（design §3.1 / ADR-010）。
 * 実装は SDK の失敗を catch して `EmailSendResult` に変換し、throw しないこと。
 */
export interface EmailProvider {
    readonly name: string;
    /**
     * プロバイダが冪等キーを保持する時間（ミリ秒）。0 なら非対応。
     * 0 のとき sweeper はリース切れの行を再送しない（二重送信を避ける側に倒す・design §4.4）。
     */
    readonly idempotencyWindowMs: number;
    send(input: EmailSendInput): Promise<EmailSendResult>;
}

/**
 * `EMAIL_PROVIDER` で実装を選ぶ。未設定・空白は stub（ローカル・CI では実送信しない）。
 * 未知の値は throw する —— 設定ミスのまま黙って stub に落ちると、本番で
 * 「送ったつもりで送られていない」状態に気づけないため。
 */
export const getEmailProvider = (): EmailProvider => {
    const name = process.env.EMAIL_PROVIDER?.trim();
    if (!name || name === "stub") return stubEmailProvider;
    throw new Error(
        `[Notifications:getEmailProvider] unknown EMAIL_PROVIDER: ${name}`
    );
};
