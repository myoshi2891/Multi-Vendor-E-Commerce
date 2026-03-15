import type { SeedShippingAddress } from "../types";

/** 配送先住所データ */
export const SEED_SHIPPING_ADDRESSES: SeedShippingAddress[] = [
  {
    "userEmail": "lux-seed-customer-01@example.com",
    "firstName": "Yuki",
    "lastName": "Tanaka",
    "phone": "+81-3-1234-5678",
    "address1": "1-2-3 Shibuya",
    "address2": "Apt 101",
    "state": "Tokyo",
    "city": "Shibuya-ku",
    "zip_code": "150-0002",
    "countryCode": "JP",
    "default": true
  },
  {
    "userEmail": "lux-seed-customer-01@example.com",
    "firstName": "Yuki",
    "lastName": "Tanaka",
    "phone": "+81-3-1234-5678",
    "address1": "4-5-6 Roppongi",
    "state": "Tokyo",
    "city": "Minato-ku",
    "zip_code": "106-0032",
    "countryCode": "JP",
    "default": false
  },
  {
    "userEmail": "lux-seed-customer-02@example.com",
    "firstName": "Emily",
    "lastName": "Chen",
    "phone": "+1-212-555-0198",
    "address1": "123 Broadway",
    "address2": "Suite 400",
    "state": "NY",
    "city": "New York",
    "zip_code": "10001",
    "countryCode": "US",
    "default": true
  },
  {
    "userEmail": "lux-seed-customer-03@example.com",
    "firstName": "Sophie",
    "lastName": "Martin",
    "phone": "+33-1-40-20-50-50",
    "address1": "15 Rue de Rivoli",
    "state": "Île-de-France",
    "city": "Paris",
    "zip_code": "75001",
    "countryCode": "FR",
    "default": true
  },
  {
    "userEmail": "lux-seed-customer-04@example.com",
    "firstName": "Alexander",
    "lastName": "Kim",
    "phone": "+82-2-123-4567",
    "address1": "Gangnam-daero",
    "address2": "Building B",
    "state": "Seoul",
    "city": "Gangnam-gu",
    "zip_code": "06000",
    "countryCode": "KR",
    "default": true
  },
  {
    "userEmail": "lux-seed-customer-05@example.com",
    "firstName": "Isabella",
    "lastName": "Romano",
    "phone": "+39-06-6982",
    "address1": "Via del Corso 12",
    "state": "Lazio",
    "city": "Rome",
    "zip_code": "00186",
    "countryCode": "IT",
    "default": true
  }
];
