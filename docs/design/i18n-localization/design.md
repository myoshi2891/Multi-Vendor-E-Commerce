# i18n Localization — 設計（design.md）

> 中核設計。実装者が**該当行を特定して差分実装できる**粒度で記述する。
> 要件 ID は [requirements.md](./requirements.md)、手順は [tasks.md](./tasks.md)。

---

## 0. 設計の前提（実コードで確認済みの事実）

| # | 事実 | 出典 |
| --- | --- | --- |
| 0-1 | i18n ライブラリ・翻訳辞書・locale ルーティングは未導入。`<html lang="en">` 固定、metadata は `"GoShop"` | [`layout.tsx:31-34,49`](../../../src/app/layout.tsx#L31-L49) |
| 0-2 | `middleware.ts` は Clerk 認証 + `userCountry` Cookie をセットし `NextResponse.next({ request })` を返す。locale 検出は無い | [`middleware.ts:5-47`](../../../src/middleware.ts#L5-L47) |
| 0-3 | `next.config.mjs` は `reactStrictMode:false` + `images.remotePatterns` のみ。i18n 設定なし | [`next.config.mjs:1-18`](../../../next.config.mjs#L1-L18) |
| 0-4 | DB 依存ページは `export const dynamic = 'force-dynamic'` を宣言する規約（SSG 放棄済） | [`tech.md` 動的レンダリング規約](../../../.claude/steering/tech.md) |
| 0-5 | 認可ガード文言（`"Unauthenticated."` 等）は固定する規約。汎用エラーで上書き禁止 | [`tech.md` エラーハンドリング](../../../.claude/steering/tech.md) |
| 0-6 | 外部 cookie の JSON は `parseUserCountryCookie` 必須。ただし対象は `userCountry`（JSON）。`NEXT_LOCALE` は単純文字列で対象外 | [`tech.md` cookie パース](../../../.claude/steering/tech.md) |
| 0-7 | サイドバー等の定数は `src/constants/data.ts` に `label` 生文字列で定義 | [`constants/data.ts:3-82`](../../../src/constants/data.ts#L3-L82) |
| 0-8 | Zod スキーマはモジュールレベル定数（定義時にロケール未確定）。英日混在 | [`schemas.ts:8,562,658`](../../../src/lib/schemas.ts) |
| 0-9 | layout の provider 階層は `ClerkProvider > html > body > ThemeProvider > ModalProvider > children` + Toaster 群 | [`layout.tsx:47-66`](../../../src/app/layout.tsx#L47-L66) |

> **設計上の最重要事実**: 全ページが `force-dynamic`（0-4）で SSG を放棄しているため、`[locale]` URL セグメントによる多言語 SSG の利点が無い。よって **ルーティング無し（Cookie 判定）** が最小破壊で、既存 middleware（0-2）と force-dynamic 規約（0-4）をそのまま温存できる。

---

## 1. アーキテクチャ

### 1.1 ディレクトリ構成（新規/変更）

```text
src/i18n/
  config.ts            ← 新規（locales/defaultLocale/型）
  request.ts           ← 新規（getRequestConfig: Cookie → locale → messages）
  get-locale.ts        ← 新規（Server 用ヘルパ: cookies() から locale 取得）
  set-locale.ts        ← 新規（切替: NEXT_LOCALE Cookie をセットする server action）
  messages/
    ja.json            ← 新規（日本語辞書・SSOT）
    en.json            ← 新規（構造ミラー・暫定値）
src/types/i18n.d.ts    ← 新規（next-intl 型拡張: Messages 型を ja.json から導出）

next.config.mjs        ← 変更（createNextIntlPlugin で withNextIntl ラップ）
src/app/layout.tsx     ← 変更（NextIntlClientProvider・lang 動的化・generateMetadata）
src/middleware.ts      ← 変更しない（NFR-1）
```

### 1.2 再利用元マトリクス

| 流用するもの | 出典 | 用途 |
| --- | --- | --- |
| provider ラップ位置 | `layout.tsx:47-66` | `NextIntlClientProvider` を `ModalProvider` の外側・`ThemeProvider` 内に挿入 |
| Cookie allowlist 検証パターン | `tech.md` URL/env 正規化規約の発想 | `NEXT_LOCALE` を `locales` 配列で検証し不正値を `defaultLocale` へ |
| `force-dynamic` 規約 | `tech.md` | ロケール解決を SSR 毎に行ってよい根拠 |
| リエントランシー/同期 setter | `modal-provider.tsx`（ADR-003） | 切替ハンドラを floating promise にしない |
| 既存日本語文言 | `schemas.ts` の ja メッセージ群・inventory/messages/support 各所 | `ja.json` の初期値として吸収 |

---

## 2. 機能詳細

### 2.1 `src/i18n/config.ts`

```ts
// 対応ロケールと既定。allowlist 検証の SSOT。
export const locales = ["ja", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ja";

/** 任意文字列を Locale に正規化する（不正値は defaultLocale）。NEXT_LOCALE 検証に使う。 */
export const normalizeLocale = (value: string | undefined | null): Locale =>
    locales.includes(value as Locale) ? (value as Locale) : defaultLocale;
```

### 2.2 `src/i18n/request.ts`（next-intl の getRequestConfig）

```ts
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { normalizeLocale } from "./config";

// ルーティング無し方式: locale は URL ではなく Cookie NEXT_LOCALE から解決する。
export default getRequestConfig(async () => {
    const store = await cookies(); // Next.js 16: async
    const locale = normalizeLocale(store.get("NEXT_LOCALE")?.value);
    const messages = (await import(`./messages/${locale}.json`)).default;
    return { locale, messages };
});
```

### 2.3 `src/i18n/get-locale.ts`（Server ヘルパ）

```ts
import { cookies } from "next/headers";
import { normalizeLocale, type Locale } from "./config";

/** Server Component/layout で現在の locale を得る（<html lang> 等）。 */
export const getLocale = async (): Promise<Locale> => {
    const store = await cookies();
    return normalizeLocale(store.get("NEXT_LOCALE")?.value);
};
```

### 2.4 `src/i18n/set-locale.ts`（切替・最小実装）

```ts
"use server";
import { cookies } from "next/headers";
import { normalizeLocale, type Locale } from "./config";

/** NEXT_LOCALE を切り替える。UI 露出は任意（基盤として配置）。 */
export const setLocale = async (next: Locale): Promise<void> => {
    const store = await cookies();
    store.set("NEXT_LOCALE", normalizeLocale(next), {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
    });
};
```

> 呼び出し側は `await setLocale("en")` 後に `router.refresh()`。consumer が戻り値を使わないため [ADR-003](../../architecture/decisions/003-modal-setopen-sync-for-react19.md) の floating promise 注意は server action 側には及ばないが、client ハンドラ側は `void setLocale(...)` ではなく `await` する。

### 2.5 `next.config.mjs`（変更）

```js
import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    images: { /* 既存のまま保持 */ },
};
export default withNextIntl(nextConfig);
```

### 2.6 `src/app/layout.tsx`（変更）

```tsx
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { getLocale } from "@/i18n/get-locale";

// metadata をロケール対応に（FR-9）。
export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations("meta");
    return { title: t("title"), description: t("description") };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const locale = await getLocale();
    const messages = await getMessages();
    return (
        <ClerkProvider afterSignOutUrl="/">
            <html lang={locale} suppressHydrationWarning>
                <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                        <NextIntlClientProvider messages={messages}>
                            <ModalProvider>{children}</ModalProvider>
                            <Toaster />
                            <SonnerToaster position="bottom-left" />
                        </NextIntlClientProvider>
                    </ThemeProvider>
                </body>
            </html>
        </ClerkProvider>
    );
}
```

> `RootLayout` を `async` 化（Next.js 16 で許容）。`NextIntlClientProvider` は Client コンポーネントへ messages を供給するため `ModalProvider`/Toaster 群を内側に包む。

### 2.7 型拡張 `src/types/i18n.d.ts`（NFR-3）

```ts
import type messages from "@/i18n/messages/ja.json";

declare module "next-intl" {
    interface AppConfig {
        Messages: typeof messages; // ja.json をキーの SSOT として型導出
        Locale: import("@/i18n/config").Locale;
    }
}
```

> これにより `useTranslations`/`getTranslations` の `t('...')` キーが静的型付けされ、未定義キーは tsc で fail（AC-7）。

---

## 3. 辞書構造（`messages/ja.json`）

ネスト名前空間。ドメイン/コンポーネント単位で分割。命名規約 `ドメイン.要素.用途`。

```jsonc
{
  "meta":    { "title": "GoShop", "description": "GoShop へようこそ！" },
  "common":  { "addToCart": "カートに入れる", "buyNow": "今すぐ買う", "save": "保存", "cancel": "キャンセル", "submit": "送信" },
  "header":  { "search": "検索", "wishlist": "お気に入り", "cart": "カート" },
  "home":    { "moreToLove": "もっと見る" },
  "cart":    { "summary": "ご注文内容", "couponApplied": "クーポンを適用しました", "selectAddress": "配送先を選択してください" },
  "product": { "outOfStock": "在庫切れ", "addReview": "レビューを書く", "submitReview": "レビューを送信", "reviewPlaceholder": "レビューを入力してください…" },
  "toast":   { "addedToCart": "カートに追加しました", "addedToWishlist": "お気に入りに追加しました", "copied": "コピーしました" },
  "validation": {
    "category": { "required": "カテゴリ名を入力してください", "minLength": "カテゴリ名は2文字以上で入力してください" },
    "common":   { "email": "有効なメールアドレスを入力してください" }
  },
  "dashboard": {
    "sidebar": { "dashboard": "ダッシュボード", "products": "商品", "orders": "注文", "inventory": "在庫", "coupons": "クーポン", "shipping": "配送", "settings": "設定", "messages": "メッセージ", "stores": "店舗", "categories": "カテゴリ" },
    "stats":   { "totalRevenue": "総売上", "totalOrders": "総注文数", "lowStock": "在庫アラート" },
    "stock":   { "out": "在庫切れ", "low": "残りわずか", "ok": "在庫あり" }
  },
  "static": { "_note": "about/faq/legal 等の長文は messages/ja/static-*.json へ分割（design §6）" }
}
```

`en.json` は**同一キー構造**を持ち、初期は暫定値（既存英語の流用 or 同値）。キー集合一致は NFR-6 のテストで担保。

---

## 4. 文字列カテゴリ別 移行方針

| カテゴリ | 移行方法 | 注意 |
| --- | --- | --- |
| JSX テキスト（Client） | `const t = useTranslations('ns'); {t('key')}` | `"use client"` 内 |
| JSX テキスト（Server Component） | `const t = await getTranslations('ns'); t('key')` | page.tsx 等 |
| 属性（placeholder/aria-label/alt/title） | `placeholder={t('key')}` | alt は意味のある説明を辞書化 |
| toast | client で `useTranslations`、`toast.success(t('toast.addedToCart'))` | メッセージ文字列のみ要る場面はキーを渡し表示境界で翻訳 |
| 定数（`constants/data.ts`） | `label` を**翻訳キー**へ（例 `"dashboard.sidebar.products"`）。描画側で `t(label)` | 定数に生文字列を残さない（0-7） |
| Zod | §5 参照 | — |
| Server Action Error（UI 表示） | エラーキーを throw → 表示境界（toast）で `t()` | 内部ログ専用・認可ガード文言は対象外（0-5） |
| static 長文 | §6 参照 | — |

---

## 5. Zod の i18n 化（要注意ポイント）

スキーマはモジュール定数でロケール未確定（0-8）。2案を比較し、**フェーズ2で既存テスト形態を見て確定**する。

- **案A（推奨）: ファクトリ関数化**
  ```ts
  import type { useTranslations } from "next-intl";
  type T = ReturnType<typeof useTranslations>;
  export const makeCategorySchema = (t: T) =>
      z.object({ name: z.string().min(2, { message: t("validation.category.minLength") }) });
  ```
  フォーム側 `const schema = makeCategorySchema(useTranslations());`。schema 利用箇所すべてに波及するため段階導入。

- **案B（軽量）: メッセージにキー文字列を入れ、表示時翻訳**
  ```ts
  name: z.string().min(2, { message: "validation.category.minLength" })
  // RHF 表示側: <FormMessage>{t(error.message)}</FormMessage>
  ```
  schema 定義の形を変えずキー化のみ。フォーム表示部品の改修が必要。

> **既存テスト追随**: `src/queries/*.test.ts` がメッセージ文字列を assert している箇所を Zod 移行前に grep で洗い出し、キー/翻訳後文字列へ追随（TDD: Red を 1 件確認してから Green）。テスト数が動けば `spec-sync-after-test` を起動。

---

## 6. static 長文の格納

`src/components/store/static/content/*.ts`（about/faq/legal/customer-service/returns/product-support）は長文構造データ。辞書 JSON へ一括は肥大化するため **`src/i18n/messages/ja/static-<page>.json` へドメイン別分割**し、`request.ts` で名前空間マージ（または個別 import）する。en も同名でミラー。

---

## 7. Clerk 認証 UI の日本語化

sign-in/sign-up は Clerk の描画で辞書対象外。`ClerkProvider` の `localization` プロパティに `@clerk/localizations` の `jaJP`（または将来ロケール連動）を渡す。これは next-intl 辞書とは別系統（design として明記、実装はフェーズ1で `layout.tsx` に追加）。

---

## 8. 影響箇所マトリクス

| パス | 変更種別 | 理由 | リスク |
| --- | --- | --- | --- |
| `src/i18n/**`（新規一式） | 新規 | i18n 基盤 | 低 |
| `src/types/i18n.d.ts` | 新規 | 型拡張 | 低 |
| `next.config.mjs` | 変更 | withNextIntl ラップ | 低（images 保持） |
| `src/app/layout.tsx` | 変更 | Provider/lang/metadata | 中（async 化・provider 階層） |
| `src/middleware.ts` | **不変** | NFR-1 | — |
| `src/components/store/**` | 変更（反復） | JSX/属性/toast 辞書化 | 中（量） |
| `src/components/dashboard/**` | 変更（反復） | 同上 | 中 |
| `src/app/(store)/** , dashboard/**` | 変更（反復） | Server Component の t() 化・metadata | 中 |
| `src/constants/data.ts` | 変更 | label をキー化 | 低 |
| `src/lib/schemas.ts` | 変更 | Zod i18n（案A/B） | 中（テスト追随） |
| `eslint.config.mjs` | 変更 | JSX 直書き検出ルール | 低（段階導入） |

---

## 判断1. なぜ「ルーティング無し（Cookie）」方式か

- 全ページ `force-dynamic`（0-4）で SSG 放棄済 → `[locale]` の多言語 SSG 利点が無い。
- `(store)/(auth)/(fullscreen)/dashboard` を `src/app/[locale]/` へ全移動すると import パス・force-dynamic 宣言・既存テスト・middleware matcher へ広範囲に波及する。Cookie 方式はこれを回避（NFR-1）。
- デフォルト ja・将来 en を Cookie 切替で満たせ、要件（FR-2,4,5）と一致。
- トレードオフ（hreflang/多言語 SSG の弱さ）は `product.md` の国際展開スコープ外性により許容。en 本格展開時のみ `[locale]` へ移行し ADR 更新。

## 判断2. なぜ middleware を変更しないか

- ルーティング無し方式は next-intl 専用 middleware を必要としない（locale は `getRequestConfig` が Cookie から解決）。
- 既存 middleware は Clerk 認証 + `userCountry` を担い、locale 関心を混ぜると責務が肥大化。分離を維持（0-2 を温存）。

## 判断3. なぜ辞書を SSOT とし既存日本語も吸収するか

- 現状は英語直書き + 日本語直書きが混在（0-8）。直書き日本語を残すと「辞書 + 直書き」の二重管理になり、en 追加時に漏れる。
- 一貫性確保が最優先要件のため、移行済みドメインでは直書きを禁止し辞書へ一元化（NFR-8, FR-6）。

---

## 9. リスク分析

| リスク | 区分 | 緩和策 |
| --- | --- | --- |
| Zod ファクトリ化の広範囲波及 | 保守性 | フェーズ2で案A/B を比較し段階導入。テスト先行で Red 確認 |
| 既存テストの文字列 assert 崩れ | 回帰 | Zod 移行前に grep 洗い出し → キー/翻訳後値へ追随。`spec-sync-after-test` 起動 |
| layout async 化での provider 順序事故 | 機能 | `NextIntlClientProvider` を `ModalProvider` 外側に固定。フェーズ0 で cart パイロット検証 |
| 直書き日本語の取りこぼし | 一貫性 | ESLint 直書き検出 + grep 回帰（AC-4） |
| en.json キー欠落 | 整合 | `ja↔en` キー一致テスト（NFR-6） |
| next-intl と Next.js 16 の版差 | 互換 | 対応バージョンをピン留め（実装時確認） |

---

## 10. Verification（実装後の検証手順）

1. `bunx tsc --noEmit`（未定義キー検出・AC-7）/ `bun run lint`（直書き検出）/ `bun run test`（キー一致・既存追随）/ `bun run build`。
2. `bun run dev` → 既定で cart 等が日本語・`<html lang="ja">`（AC-1）。
3. Cookie `NEXT_LOCALE=en` → en 値・`lang="en"`（AC-2）。`fr` → ja フォールバック（AC-3）。
4. フォーム未入力 submit → ja バリデーション（AC-5）。
5. 移行完了ディレクトリを grep → 直書き残存なし（AC-4）。
6. `bunx playwright test`（文字列セレクタ追随・AC-8）。
