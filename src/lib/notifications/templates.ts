import type { NotificationType } from "./mapping";

/** テンプレートの差し込み値。PII（宛先・住所・決済情報）は入れない（design §7.2） */
export type NotificationParams = Record<string, string | number>;

/** DB の JSON 列から差し込み値を取り出す（文字列と数値だけを採り、それ以外は捨てる） */
export const toNotificationParams = (value: unknown): NotificationParams => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {};
    }
    const params: NotificationParams = {};
    for (const [key, v] of Object.entries(value)) {
        if (typeof v === "string" || typeof v === "number") params[key] = v;
    }
    return params;
};

export type NotificationTemplate = {
    title(params: NotificationParams): string;
    body(params: NotificationParams): string;
    emailSubject(params: NotificationParams): string;
};

/** 差し込み値が欠けていても "undefined" を出さない */
const param = (
    params: NotificationParams,
    key: string,
    fallback: string
): string => {
    const value = params[key];
    return value === undefined || value === "" ? fallback : String(value);
};

const store = (p: NotificationParams) => param(p, "storeName", "the store");
const order = (p: NotificationParams) => param(p, "orderId", "your order");

/**
 * 種別ごとの文面。`Record<NotificationType, …>` なので、マッピングに種別を足して
 * ここを書き忘れるとコンパイルエラーになる。
 */
export const NOTIFICATION_TEMPLATES: Record<
    NotificationType,
    NotificationTemplate
> = {
    "order.group.shipped": {
        title: () => "Your items have shipped",
        body: (p) => `Items from ${store(p)} in ${order(p)} are on the way.`,
        emailSubject: (p) => `Your items from ${store(p)} have shipped`,
    },
    "order.group.delivered": {
        title: () => "Your items were delivered",
        body: (p) => `Items from ${store(p)} in ${order(p)} were delivered.`,
        emailSubject: (p) => `Your items from ${store(p)} were delivered`,
    },
    "order.payment.refunded": {
        title: () => "Your payment was refunded",
        body: (p) => `The payment for ${order(p)} was refunded.`,
        emailSubject: () => "Your payment was refunded",
    },
    "order.payment.cancelled": {
        title: () => "Your order was cancelled",
        body: (p) => `${order(p)} was cancelled.`,
        emailSubject: () => "Your order was cancelled",
    },
    "store.approved": {
        title: () => "Your store was approved",
        body: (p) => `${store(p)} is now live.`,
        emailSubject: () => "Your store was approved",
    },
    "catalog.review.approved": {
        title: () => "Your product was approved",
        body: (p) => `A product in ${store(p)} passed review.`,
        emailSubject: () => "Your product was approved",
    },
    "catalog.review.rejected": {
        title: () => "Your product needs changes",
        body: (p) => `A product in ${store(p)} did not pass review.`,
        emailSubject: () => "Your product needs changes",
    },
    "rma.requested": {
        title: () => "New return request",
        body: (p) => `A customer requested a return for ${order(p)}.`,
        emailSubject: () => "New return request",
    },
    "rma.approved": {
        title: () => "Your return was approved",
        body: (p) => `Your return for ${order(p)} was approved.`,
        emailSubject: () => "Your return was approved",
    },
    "rma.rejected": {
        title: () => "Your return was declined",
        body: (p) => `Your return for ${order(p)} was declined.`,
        emailSubject: () => "Your return was declined",
    },
    "rma.refunded": {
        title: () => "Your return was refunded",
        body: (p) => `The refund for your return on ${order(p)} was issued.`,
        emailSubject: () => "Your return was refunded",
    },
};
