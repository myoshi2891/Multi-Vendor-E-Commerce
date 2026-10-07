import { NOTIFICATION_MAPPING, type NotificationType } from "./mapping";
import { NOTIFICATION_TEMPLATES } from "./templates";

describe("NOTIFICATION_MAPPING / NOTIFICATION_TEMPLATES", () => {
    const types = Object.keys(NOTIFICATION_MAPPING) as NotificationType[];

    it("初期の種別（発送・配達）が in-app と email の両方を持つ", () => {
        // Arrange & Act
        const shipped = NOTIFICATION_MAPPING["order.group.shipped"];
        const delivered = NOTIFICATION_MAPPING["order.group.delivered"];

        // Assert
        expect(shipped.channels).toEqual(["in_app", "email"]);
        expect(delivered.channels).toEqual(["in_app", "email"]);
        expect(shipped.recipient).toBe("customer");
    });

    it("すべての種別が in-app を持つ（in-app は必須・design §3.2）", () => {
        for (const type of types) {
            expect(NOTIFICATION_MAPPING[type].channels).toContain("in_app");
        }
    });

    it("すべての種別がトランザクショナル（販促は本基盤で送らない・design §7.1）", () => {
        for (const type of types) {
            expect(NOTIFICATION_MAPPING[type].category).toBe("transactional");
        }
    });

    it("すべての種別にテンプレートがあり、空でない文面を返す", () => {
        // Arrange
        const params = { storeName: "Acme", orderId: "order-1" };

        for (const type of types) {
            // Act
            const template = NOTIFICATION_TEMPLATES[type];

            // Assert
            expect(template.title(params).trim()).not.toBe("");
            expect(template.body(params).trim()).not.toBe("");
            expect(template.emailSubject(params).trim()).not.toBe("");
        }
    });

    it("発送のテンプレートは店舗名を差し込む", () => {
        // Act
        const body = NOTIFICATION_TEMPLATES["order.group.shipped"].body({
            storeName: "Acme",
            orderId: "order-1",
        });

        // Assert
        expect(body).toContain("Acme");
    });

    it("差し込み値が欠けても例外にせず、汎用の表記にする", () => {
        // Act
        const body = NOTIFICATION_TEMPLATES["order.group.shipped"].body({});

        // Assert
        expect(body).not.toContain("undefined");
    });
});
