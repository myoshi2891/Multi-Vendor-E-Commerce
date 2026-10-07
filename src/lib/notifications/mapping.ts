/**
 * イベント → 通知のマッピング（design §6.1）。
 *
 * DB テーブルではなくコード内の定数にしている。`NotificationType` が union になるので、
 * 存在しない種別の発火やテンプレートの欠落をコンパイル時に検出できる。
 * 新しい状態遷移に通知を足すときは、ここに行を追加して `templates.ts` に文面を書く。
 */

export type NotificationChannel = "in_app" | "email";

export type NotificationRule = {
    /** 受信者のロール。実際の userId は発火点が導く */
    recipient: "customer" | "seller";
    /** in-app は必須（design §3.2） */
    channels: readonly NotificationChannel[];
    /** 販促（marketing）は本基盤では送らない（design §7.1） */
    category: "transactional";
};

export const NOTIFICATION_MAPPING = {
    // 配線済み（plan 086）
    "order.group.shipped": {
        recipient: "customer",
        channels: ["in_app", "email"],
        category: "transactional",
    },
    "order.group.delivered": {
        recipient: "customer",
        channels: ["in_app", "email"],
        category: "transactional",
    },
    // 行のみ定義（配線は後続プラン）
    "order.payment.refunded": {
        recipient: "customer",
        channels: ["in_app", "email"],
        category: "transactional",
    },
    "order.payment.cancelled": {
        recipient: "customer",
        channels: ["in_app", "email"],
        category: "transactional",
    },
    "store.approved": {
        recipient: "seller",
        channels: ["in_app", "email"],
        category: "transactional",
    },
    // 予約（spike 016 / 018 が確定させる）
    "catalog.review.approved": {
        recipient: "seller",
        channels: ["in_app"],
        category: "transactional",
    },
    "catalog.review.rejected": {
        recipient: "seller",
        channels: ["in_app", "email"],
        category: "transactional",
    },
    "rma.requested": {
        recipient: "seller",
        channels: ["in_app", "email"],
        category: "transactional",
    },
    "rma.approved": {
        recipient: "customer",
        channels: ["in_app", "email"],
        category: "transactional",
    },
    "rma.rejected": {
        recipient: "customer",
        channels: ["in_app", "email"],
        category: "transactional",
    },
    "rma.refunded": {
        recipient: "customer",
        channels: ["in_app", "email"],
        category: "transactional",
    },
} as const satisfies Record<string, NotificationRule>;

export type NotificationType = keyof typeof NOTIFICATION_MAPPING;

/** 種別が email チャネルを持つか */
export const hasEmailChannel = (type: NotificationType): boolean =>
    (
        NOTIFICATION_MAPPING[type].channels as readonly NotificationChannel[]
    ).includes("email");

/** 既知の種別の一覧（DB の where で未知の種別を除くのに使う） */
export const NOTIFICATION_TYPES = Object.keys(
    NOTIFICATION_MAPPING
) as NotificationType[];

/** 文字列が既知の NotificationType かを判定する型ガード（DB から読んだ値の検証に使う） */
export const isNotificationType = (value: string): value is NotificationType =>
    Object.prototype.hasOwnProperty.call(NOTIFICATION_MAPPING, value);
