import * as queries from "./user";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

// Describe the new facade contract before its implementation exists.
const api = queries as unknown as {
    getProfileShippingAddresses: () => Promise<unknown>;
    saveProfileShippingAddress: (input: unknown) => Promise<unknown>;
    makeProfileShippingAddressDefault: (id: string) => Promise<unknown>;
};
jest.mock("@/lib/auth-guards", () => ({ requireUser: jest.fn() }));
jest.mock("./product", () => ({}));
jest.mock("@/lib/db", () => ({
    db: {
        shippingAddress: { findMany: jest.fn(), findFirst: jest.fn() },
        country: { findMany: jest.fn() },
        $transaction: jest.fn(),
    },
}));
const mockDb = db as unknown as {
    shippingAddress: { findMany: jest.Mock; findFirst: jest.Mock };
    country: { findMany: jest.Mock };
    $transaction: jest.Mock;
};
const country = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Japan",
    code: "JP",
};
const values = {
    firstName: "Mina",
    lastName: "Mori",
    phone: "+819012345678",
    address1: "12 Garden Street",
    address2: "Apartment 2",
    city: "Tokyo",
    state: "Tokyo",
    zip_code: "1000001",
    countryId: country.id,
    default: false,
};
const address = {
    id: "11111111-1111-4111-8111-111111111111",
    ...values,
    userId: "user-one",
    createdAt: new Date("2020-01-01"),
    updatedAt: new Date("2026-10-01"),
    country,
    user: { email: "private@example.test" },
};
const tx = {
    shippingAddress: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
    },
};
beforeEach(() => {
    jest.resetAllMocks();
    (requireUser as jest.Mock).mockResolvedValue({ id: "user-one" });
    mockDb.shippingAddress.findMany.mockResolvedValue([address]);
    mockDb.shippingAddress.findFirst.mockResolvedValue(address);
    mockDb.country.findMany.mockResolvedValue([country]);
    mockDb.$transaction.mockImplementation(
        (callback: (value: typeof tx) => unknown) => callback(tx)
    );
    tx.shippingAddress.findFirst.mockResolvedValue(address);
    tx.shippingAddress.update.mockImplementation(
        ({ data }: { data: object }) => ({ ...address, ...data })
    );
    tx.shippingAddress.create.mockImplementation(
        ({ data }: { data: object }) => ({ ...address, ...data })
    );
});
describe("profile address facade", () => {
    it("projects only display fields and supported country choices under owner scope", async () => {
        expect(await api.getProfileShippingAddresses()).toEqual({
            addresses: [{ id: address.id, ...values, country }],
            countries: [country],
        });
        expect(mockDb.shippingAddress.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { userId: "user-one" } })
        );
        expect(mockDb.country.findMany).toHaveBeenCalledWith({
            select: { id: true, name: true, code: true },
            orderBy: { name: "asc" },
        });
    });
    it("rejects load before external reads when authentication fails", async () => {
        (requireUser as jest.Mock).mockRejectedValue(
            new Error("Unauthenticated")
        );
        await expect(api.getProfileShippingAddresses()).rejects.toThrow(
            "Unauthenticated"
        );
        expect(mockDb.shippingAddress.findMany).not.toHaveBeenCalled();
        expect(mockDb.country.findMany).not.toHaveBeenCalled();
    });
    it("creates a validated address with server-assigned id/user and DB-owned timestamps", async () => {
        tx.shippingAddress.findFirst.mockResolvedValue(null);
        const result = await api.saveProfileShippingAddress({
            ...values,
            userId: "forged-user",
            createdAt: "forged-date",
        });
        expect(result).toEqual(
            expect.objectContaining({ ...values, id: expect.any(String) })
        );
        const data = tx.shippingAddress.create.mock.calls[0][0].data;
        expect(data).toEqual({
            ...values,
            id: expect.stringMatching(/^[0-9a-f-]{36}$/),
            userId: "user-one",
        });
        expect(data).not.toHaveProperty("createdAt");
        expect(data).not.toHaveProperty("updatedAt");
    });
    it("rejects invalid form input before any write", async () => {
        await expect(
            api.saveProfileShippingAddress({ ...values, firstName: "" })
        ).rejects.toThrow();
        expect(mockDb.$transaction).not.toHaveBeenCalled();
    });
    it("edits only an owned id and preserves its creation timestamp", async () => {
        await api.saveProfileShippingAddress({ ...values, id: address.id });
        expect(mockDb.shippingAddress.findFirst).toHaveBeenCalledWith({
            where: { id: address.id, userId: "user-one" },
        });
        expect(tx.shippingAddress.update).toHaveBeenCalledWith({
            where: { id: address.id },
            data: { ...values, id: address.id, userId: "user-one" },
        });
    });
    it("rejects another user's edit id without starting a write transaction", async () => {
        mockDb.shippingAddress.findFirst.mockResolvedValue(null);
        await expect(
            api.saveProfileShippingAddress({ ...values, id: address.id })
        ).rejects.toThrow();
        expect(mockDb.$transaction).not.toHaveBeenCalled();
    });
    it("makes only an owned address default through the existing atomic update", async () => {
        expect(await api.makeProfileShippingAddressDefault(address.id)).toEqual(
            { id: address.id }
        );
        expect(mockDb.shippingAddress.findFirst).toHaveBeenCalledWith({
            where: { id: address.id, userId: "user-one" },
        });
        expect(tx.shippingAddress.updateMany).toHaveBeenCalledWith({
            where: {
                userId: "user-one",
                default: true,
                NOT: { id: address.id },
            },
            data: { default: false },
        });
        expect(tx.shippingAddress.update).toHaveBeenCalledWith({
            where: { id: address.id },
            data: {
                ...values,
                default: true,
                id: address.id,
                userId: "user-one",
            },
        });
    });
    it("rejects another user's default id without any writes", async () => {
        mockDb.shippingAddress.findFirst.mockResolvedValue(null);
        await expect(
            api.makeProfileShippingAddressDefault(address.id)
        ).rejects.toThrow();
        expect(mockDb.$transaction).not.toHaveBeenCalled();
        expect(tx.shippingAddress.updateMany).not.toHaveBeenCalled();
    });
    it.each(["save", "default"])(
        "stops %s before lookup/writes when the auth guard fails",
        async (action) => {
            (requireUser as jest.Mock).mockRejectedValue(
                new Error("Unauthenticated")
            );
            await expect(
                action === "save"
                    ? api.saveProfileShippingAddress({
                          ...values,
                          id: address.id,
                      })
                    : api.makeProfileShippingAddressDefault(address.id)
            ).rejects.toThrow("Unauthenticated");
            expect(mockDb.shippingAddress.findFirst).not.toHaveBeenCalled();
            expect(mockDb.$transaction).not.toHaveBeenCalled();
            expect(tx.shippingAddress.updateMany).not.toHaveBeenCalled();
        }
    );
    it("rejects invalid default UUIDs before lookup/writes", async () => {
        await expect(
            api.makeProfileShippingAddressDefault("bad-id")
        ).rejects.toThrow();
        expect(mockDb.shippingAddress.findFirst).not.toHaveBeenCalled();
        expect(mockDb.$transaction).not.toHaveBeenCalled();
    });
});

// Post-implementation regression: supported-country lookup failure is generic.
it("handles country lookup failure without exposing DB details", async () => {
    mockDb.country.findMany.mockRejectedValue(new Error("private DB details"));
    await expect(api.getProfileShippingAddresses()).rejects.toThrow(
        "Failed to load shipping destinations."
    );
    expect(mockDb.$transaction).not.toHaveBeenCalled();
});
