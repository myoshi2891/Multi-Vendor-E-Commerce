import type { SeedUser } from "../types";
import { SEED_EMAIL_PREFIX } from "../helpers";

const p = SEED_EMAIL_PREFIX;
const defaultPicture = "/assets/images/no_image.png";

/** 管理者ユーザー */
const ADMINS: SeedUser[] = [
  {
    name: "Luxury Admin",
    email: `${p}admin@example.com`,
    picture: defaultPicture,
    role: "ADMIN",
  },
];

/** 販売者ユーザー（各店舗オーナー） */
const SELLERS: SeedUser[] = [
  {
    name: "Noir Elegance Owner",
    email: `${p}seller-noir@example.com`,
    picture: defaultPicture,
    role: "SELLER",
  },
  {
    name: "Maison Luxe Owner",
    email: `${p}seller-maison@example.com`,
    picture: defaultPicture,
    role: "SELLER",
  },
  {
    name: "Atelier Divine Owner",
    email: `${p}seller-atelier@example.com`,
    picture: defaultPicture,
    role: "SELLER",
  },
  {
    name: "Velvet Crown Owner",
    email: `${p}seller-velvet@example.com`,
    picture: defaultPicture,
    role: "SELLER",
  },
  {
    name: "Oro Palazzo Owner",
    email: `${p}seller-oro@example.com`,
    picture: defaultPicture,
    role: "SELLER",
  },
  {
    name: "Lumiere Paris Owner",
    email: `${p}seller-lumiere@example.com`,
    picture: defaultPicture,
    role: "SELLER",
  },
];

/** 顧客ユーザー */
const CUSTOMERS: SeedUser[] = [
  {
    name: "Yuki Tanaka",
    email: `${p}customer-01@example.com`,
    picture: defaultPicture,
    role: "USER",
  },
  {
    name: "Emily Chen",
    email: `${p}customer-02@example.com`,
    picture: defaultPicture,
    role: "USER",
  },
  {
    name: "Sophie Martin",
    email: `${p}customer-03@example.com`,
    picture: defaultPicture,
    role: "USER",
  },
  {
    name: "Alexander Kim",
    email: `${p}customer-04@example.com`,
    picture: defaultPicture,
    role: "USER",
  },
  {
    name: "Isabella Romano",
    email: `${p}customer-05@example.com`,
    picture: defaultPicture,
    role: "USER",
  },
];

export const SEED_USERS: SeedUser[] = [...ADMINS, ...SELLERS, ...CUSTOMERS];
