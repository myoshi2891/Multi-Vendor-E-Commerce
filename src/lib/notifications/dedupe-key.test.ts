import { buildDedupeKey } from "./dedupe-key";

describe("buildDedupeKey", () => {
    it("type:sourceType:sourceId:transition:recipient の形式で返す", () => {
        // Arrange
        const event = {
            type: "order.group.shipped" as const,
            recipientUserId: "user-1",
            source: { type: "OrderGroup", id: "group-1" },
            transition: "Shipped",
        };

        // Act
        const key = buildDedupeKey(event);

        // Assert
        expect(key).toBe(
            "order.group.shipped:OrderGroup:group-1:Shipped:user-1"
        );
    });

    it("256 文字を超えるキーは SHA-256 の hex（64 文字）にする", () => {
        // Arrange
        const event = {
            type: "order.group.shipped" as const,
            recipientUserId: "user-1",
            source: { type: "OrderGroup", id: "g".repeat(300) },
            transition: "Shipped",
        };

        // Act
        const key = buildDedupeKey(event);

        // Assert
        expect(key).toMatch(/^[0-9a-f]{64}$/);
        // 同じ入力なら同じキーになる（決定論的）
        expect(buildDedupeKey(event)).toBe(key);
    });

    it.each([
        ["recipientUserId", { recipientUserId: "" }],
        ["source.id", { source: { type: "OrderGroup", id: "  " } }],
        ["source.type", { source: { type: "", id: "group-1" } }],
        ["transition", { transition: "" }],
    ])(
        "%s が空なら throw する（NULL 相当のキーを作らない）",
        (_label, override) => {
            // Arrange
            const event = {
                type: "order.group.shipped" as const,
                recipientUserId: "user-1",
                source: { type: "OrderGroup", id: "group-1" },
                transition: "Shipped",
                ...override,
            };

            // Act & Assert
            expect(() => buildDedupeKey(event)).toThrow(
                "[Notifications:buildDedupeKey] empty key component"
            );
        }
    );
});
