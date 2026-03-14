import { seedBase } from "../seeders/base-seeder";
import { SEED_COUNTRIES } from "../constants/countries";
import { SEED_USERS } from "../constants/users";
import { SEED_CATEGORIES, SEED_SUB_CATEGORIES } from "../constants/categories";
import { SEED_OFFER_TAGS } from "../constants/offer-tags";

// Prisma mock
const mockUpsert = jest.fn();

function createMockPrisma(): Pick<
  import("@prisma/client").PrismaClient,
  "country" | "user" | "category" | "subCategory" | "offerTag"
> {
  const upsertFn = () => mockUpsert;
  return {
    country: { upsert: upsertFn() },
    user: { upsert: upsertFn() },
    category: { upsert: upsertFn() },
    subCategory: { upsert: upsertFn() },
    offerTag: { upsert: upsertFn() },
  };
}

describe("seedBase", () => {
  let idCounter: number;

  beforeEach(() => {
    jest.clearAllMocks();
    idCounter = 0;
    mockUpsert.mockImplementation(() => ({
      id: `mock-id-${++idCounter}`,
    }));
  });

  it("正常ケース: 全エンティティのupsertが呼ばれること", async () => {
    const prisma = createMockPrisma();
    await seedBase(prisma as import("@prisma/client").PrismaClient);

    const expectedCalls =
      SEED_COUNTRIES.length +
      SEED_USERS.length +
      SEED_CATEGORIES.length +
      SEED_SUB_CATEGORIES.length +
      SEED_OFFER_TAGS.length;

    expect(mockUpsert).toHaveBeenCalledTimes(expectedCalls);
  });

  it("正常ケース: 戻り値のMapが正しいサイズであること", async () => {
    const prisma = createMockPrisma();
    const result = await seedBase(prisma);

    expect(result.countries.size).toBe(SEED_COUNTRIES.length);
    expect(result.users.size).toBe(SEED_USERS.length);
    expect(result.categories.size).toBe(SEED_CATEGORIES.length);
    expect(result.subCategories.size).toBe(SEED_SUB_CATEGORIES.length);
    expect(result.offerTags.size).toBe(SEED_OFFER_TAGS.length);
  });

  it("正常ケース: countriesマップがcodeをキーとしていること", async () => {
    const prisma = createMockPrisma();
    const result = await seedBase(prisma);

    for (const country of SEED_COUNTRIES) {
      expect(result.countries.has(country.code)).toBe(true);
    }
  });

  it("正常ケース: usersマップがemailをキーとしていること", async () => {
    const prisma = createMockPrisma();
    const result = await seedBase(prisma);

    for (const user of SEED_USERS) {
      expect(result.users.has(user.email)).toBe(true);
    }
  });

  it("正常ケース: categoriesマップがurlをキーとしていること", async () => {
    const prisma = createMockPrisma();
    const result = await seedBase(prisma);

    for (const cat of SEED_CATEGORIES) {
      expect(result.categories.has(cat.url)).toBe(true);
    }
  });

  it("正常ケース: Country upsertがwhere: { code }で呼ばれること", async () => {
    const prisma = createMockPrisma();
    await seedBase(prisma as import("@prisma/client").PrismaClient);

    // 最初の呼び出しはCountryのupsert
    const firstCall = mockUpsert.mock.calls[0][0];
    expect(firstCall.where).toHaveProperty("code", SEED_COUNTRIES[0].code);
  });

  it("正常ケース: User upsertがwhere: { email }で呼ばれること", async () => {
    const prisma = createMockPrisma();
    await seedBase(prisma as import("@prisma/client").PrismaClient);

    // CountryのあとにUserが呼ばれる
    const userCallIndex = SEED_COUNTRIES.length;
    const userCall = mockUpsert.mock.calls[userCallIndex][0];
    expect(userCall.where).toHaveProperty("email", SEED_USERS[0].email);
  });

  it("異常ケース: DB接続失敗時にエラーがthrowされること", async () => {
    mockUpsert.mockRejectedValue(new Error("DB connection failed"));
    const prisma = createMockPrisma();

    await expect(seedBase(prisma)).rejects.toThrow("DB connection failed");
  });
});
