import type {
    EmailProvider,
    EmailSendInput,
    EmailSendResult,
} from "./email-provider";

type StubEmailProvider = EmailProvider & {
    /** 実際に「送った」内容（同じ冪等キーの再送は含まない） */
    readonly sent: EmailSendInput[];
};

/**
 * 実送信しないプロバイダ。ローカル・CI・テストの既定。
 * Resend と同じく、同じ冪等キーの再送は新しく送らず前回の結果を返す。
 */
export const createStubEmailProvider = (): StubEmailProvider => {
    const sent: EmailSendInput[] = [];
    const results = new Map<string, EmailSendResult>();

    return {
        name: "stub",
        idempotencyWindowMs: 24 * 60 * 60 * 1000,
        sent,
        send: async (input) => {
            const previous = results.get(input.idempotencyKey);
            if (previous) return previous;

            sent.push(input);
            const result: EmailSendResult = {
                ok: true,
                providerMessageId: `stub-${sent.length}`,
            };
            results.set(input.idempotencyKey, result);
            return result;
        },
    };
};

/** プロセス内で共有する stub（`getEmailProvider` が返す） */
export const stubEmailProvider = createStubEmailProvider();
