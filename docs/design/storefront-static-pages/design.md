# Storefront Static Pages — 設計（design.md）

> 中核設計。実装者（Sonnet）が**該当行を特定して差分実装できる**粒度で記述する。
> 要件 ID は [requirements.md](./requirements.md)、手順は [tasks.md](./tasks.md)。

---

## 0. 設計の前提（実コードで確認済みの事実）

| #   | 事実                                                                                                                                                                                               | 出典（行番号）                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0-1 | footer の `footer_links` に `/about` `/contact` `/compare` `/faq` `/track-order` `/customer-service` `/returns-exchange` `/faqs` `/product-support` が定義済み（リンクは生きているがページが無い） | [`footer/links.tsx:49-98`](../../../src/components/store/layout/footer/links.tsx#L49-L98)                                                                       |
| 0-2 | `/faq`（title "FAQ"）と `/faqs`（title "FAQs"）が**両方**定義されている（重複）                                                                                                                    | [`links.tsx:66-68`](../../../src/components/store/layout/footer/links.tsx#L66) / [`links.tsx:90-93`](../../../src/components/store/layout/footer/links.tsx#L90) |
| 0-3 | user-menu の `extraLinks` で「Help Center」=`""`、「Legal & Privacy」=`""`（空文字リンク）                                                                                                         | [`user-menu.tsx:185-196`](../../../src/components/store/layout/header/user-menu/user-menu.tsx#L185-L196)                                                        |
| 0-4 | middleware の保護対象は `/dashboard` `/dashboard/(.*)` `/checkout` `/profile` `/profile/(.*)` のみ。本設計の全ルートは**公開**                                                                     | [`middleware.ts:6-13`](../../../src/middleware.ts#L6-L13)                                                                                                       |
| 0-5 | `(store)` セグメントに layout があり、ストアフロント共通ヘッダー/フッターが付く                                                                                                                    | [`src/app/(store)/layout.tsx`](<../../../src/app/(store)/layout.tsx>)                                                                                           |
| 0-6 | クラス結合は `cn`（`src/lib/utils.ts`）を使用                                                                                                                                                      | [`src/lib/utils.ts`](../../../src/lib/utils.ts)                                                                                                                 |

---

## 1. 共通設計

### 1.1 ディレクトリ構成（新規/変更）

```
src/app/(store)/
  ├─ about/page.tsx                 ← 新規（server component）
  ├─ legal/page.tsx                 ← 新規
  ├─ faqs/page.tsx                  ← 新規（正規 FAQ）
  ├─ faq/page.tsx                   ← 新規（redirect("/faqs") のみ）
  ├─ customer-service/page.tsx      ← 新規（ポータル）
  └─ product-support/page.tsx       ← 新規

src/components/store/static/
  ├─ static-page-layout.tsx         ← 新規（共有プレゼンテーション部品）
  └─ content/
       ├─ about.ts                  ← 新規（コンテンツ定数）
       ├─ legal.ts                  ← 新規
       ├─ faqs.ts                   ← 新規
       ├─ customer-service.ts       ← 新規（導線カード定義）
       └─ product-support.ts        ← 新規

src/components/store/layout/header/user-menu/
  └─ user-menu.tsx                  ← 変更（Help Center / Legal & Privacy 配線）
```

### 1.2 再利用元マトリクス

| 流用するもの             | 出典                                                               | 用途                                              |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------- |
| `(store)` 共通レイアウト | `src/app/(store)/layout.tsx`                                       | ヘッダー/フッターは自動付与（各 page は本文のみ） |
| `cn` ユーティリティ      | `src/lib/utils.ts`                                                 | クラス結合                                        |
| リンク回帰テストの型     | [`profile-settings/design.md` §2.2](../profile-settings/design.md) | user-menu リンク修正の RTL パターン               |
| Next.js `redirect`       | `next/navigation`                                                  | `/faq` → `/faqs`                                  |
| shadcn `Card` 等         | `src/components/ui/`                                               | customer-service の導線カード                     |

### 1.3 認可方針

- 全ルートが公開（事実 0-4）。認可ガード不要。`requireUser` 等は**使わない**。

---

## 2. 機能詳細

### 2.0 共有レイアウト部品 `static-page-layout.tsx`

**方針**: 見出し・リード文・「セクション（見出し+本文）」配列・任意の目次を受け取り、体裁を一元化する presentational component（NFR-SP3）。

```tsx
// src/components/store/static/static-page-layout.tsx
import { cn } from "@/lib/utils";

export interface StaticSection {
    /** セクション見出し（目次にも使用）。一意であること */
    heading: string;
    /** 本文。改行は段落として描画する（plain text 前提・HTML 注入しない） */
    body: string;
}

interface StaticPageLayoutProps {
    title: string;
    /** タイトル直下のリード文（任意） */
    lead?: string;
    sections: StaticSection[];
    /** true で左に目次（アンカー）を表示。長文の legal 等で使用 */
    withToc?: boolean;
    className?: string;
}

/**
 * 静的コンテンツページの共通レイアウト。
 * sections を段落＋見出しで描画する。withToc=true なら heading から
 * アンカー目次を生成する。DB 非依存・全クライアント入力なし（XSS リスクなし）。
 */
export default function StaticPageLayout({
    title,
    lead,
    sections,
    withToc = false,
    className,
}: StaticPageLayoutProps) {
    return (
        <main className={cn("mx-auto max-w-4xl px-4 py-10", className)}>
            <h1 className="mb-4 text-3xl font-bold">{title}</h1>
            {lead ? <p className="mb-8 text-muted-foreground">{lead}</p> : null}
            {withToc ? (
                <nav className="mb-8 rounded-lg border p-4">
                    <ul className="space-y-1 text-sm">
                        {sections.map((s) => (
                            <li key={s.heading}>
                                <a
                                    href={`#${slugify(s.heading)}`}
                                    className="hover:underline"
                                >
                                    {s.heading}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
            ) : null}
            <div className="space-y-10">
                {sections.map((s) => (
                    <section key={s.heading} id={slugify(s.heading)}>
                        <h2 className="mb-3 text-xl font-semibold">
                            {s.heading}
                        </h2>
                        {s.body.split("\n\n").map((para, i) => (
                            <p
                                key={i}
                                className="mb-3 leading-relaxed text-main-secondary"
                            >
                                {para}
                            </p>
                        ))}
                    </section>
                ))}
            </div>
        </main>
    );
}

/** 見出しを安定したアンカー id に変換（英数小文字 + ハイフン） */
function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
}
```

> **重要（XSS）**: `body` は plain text として `<p>` に描画する（`dangerouslySetInnerHTML` は使わない）。リンクや強調が必要になったら、`body` を構造化（`{ type: "link"; ... }`）して安全に描画する拡張を別途検討（本 MVP では plain text）。

### 2.1 コンテンツ定数（例: `content/about.ts`）

```ts
// src/components/store/static/content/about.ts
import type { StaticSection } from "../static-page-layout";

/** About ページ本文。文章はプレースホルダ。運営が後日差替する。 */
export const ABOUT_SECTIONS: StaticSection[] = [
    {
        heading: "Who we are",
        body: "（プレースホルダ）当マーケットプレイスは、複数の独立した販売者が……",
    },
    {
        heading: "Our mission",
        body: "（プレースホルダ）顧客と販売者の双方に……",
    },
];
```

各ページの定数（`legal.ts` / `faqs.ts` / `product-support.ts`）も同型で用意する。`faqs.ts` は Q&A を `{ heading: question, body: answer }` にマップすれば共有レイアウトでそのまま描画できる。

### 2.2 各ページ `page.tsx`（例: about）

```tsx
// src/app/(store)/about/page.tsx
import type { Metadata } from "next";
import StaticPageLayout from "@/components/store/static/static-page-layout";
import { ABOUT_SECTIONS } from "@/components/store/static/content/about";

export const metadata: Metadata = {
    title: "About | Marketplace",
    description: "運営会社情報とプラットフォームの紹介。",
};

/** 運営会社情報・プラットフォーム紹介の静的ページ。DB 非依存のため force-dynamic 不要。 */
export default function AboutPage() {
    return <StaticPageLayout title="About" sections={ABOUT_SECTIONS} />;
}
```

> `legal/page.tsx` は `withToc` を有効化（複数規約の目次）。`faqs/page.tsx` は `FAQ_SECTIONS` を渡す。`product-support/page.tsx` も同型。

### 2.3 `/faq` → `/faqs` リダイレクト

```tsx
// src/app/(store)/faq/page.tsx
import { redirect } from "next/navigation";

/** 旧 "/faq" リンク（footer:66-68）を正規の "/faqs" に集約する。 */
export default function FaqRedirectPage() {
    redirect("/faqs");
}
```

### 2.4 Customer Service ポータル `customer-service/page.tsx`

**方針**: サポート入口のハブ。導線カード配列を定数化し、`Card` でグリッド表示する。

```ts
// src/components/store/static/content/customer-service.ts
export interface SupportLink {
    title: string;
    description: string;
    href: string;
}

export const SUPPORT_LINKS: SupportLink[] = [
    {
        title: "Contact us",
        description: "お問い合わせフォーム",
        href: "/contact",
    },
    {
        title: "Returns & Exchange",
        description: "返品・交換のご案内",
        href: "/returns-exchange",
    },
    { title: "FAQs", description: "よくある質問", href: "/faqs" },
    {
        title: "Track your order",
        description: "配送状況の確認",
        href: "/track-order",
    },
    {
        title: "Product support",
        description: "購入後の技術サポート",
        href: "/product-support",
    },
];
```

```tsx
// src/app/(store)/customer-service/page.tsx（抜粋）
import Link from "next/link";
import { SUPPORT_LINKS } from "@/components/store/static/content/customer-service";

export default function CustomerServicePage() {
    return (
        <main className="mx-auto max-w-5xl px-4 py-10">
            <h1 className="mb-6 text-3xl font-bold">Customer service</h1>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {SUPPORT_LINKS.map((l) => (
                    <Link
                        key={l.href}
                        href={l.href}
                        className="rounded-xl border p-5 transition hover:shadow-md"
                    >
                        <h2 className="mb-1 font-semibold">{l.title}</h2>
                        <p className="text-sm text-muted-foreground">
                            {l.description}
                        </p>
                    </Link>
                ))}
            </div>
        </main>
    );
}
```

### 2.5 変更: `user-menu.tsx`（Help Center / Legal & Privacy 配線）

[`user-menu.tsx:185-196`](../../../src/components/store/layout/header/user-menu/user-menu.tsx#L185-L196) の `extraLinks`:

```diff
  const extraLinks = [
    { title: "Profile", link: "/profile" },
    { title: "Settings", link: "/profile/settings" },
    { title: "Become a Seller", link: "/seller/apply" },
-   { title: "Help Center", link: "" },
+   { title: "Help Center", link: "/customer-service" },
    { title: "Return & Refund Policy", link: "/" },          // ← returns-exchange 設計書で扱う
-   { title: "Legal & Privacy", link: "" },
+   { title: "Legal & Privacy", link: "/legal" },
    { title: "Discounts & Offers", link: "" },                // ← offers 設計書で扱う
    { title: "Order Dispute Resolution", link: "" },          // ← support-forms 設計書で扱う
    { title: "Report a Problem", link: "" },                  // ← support-forms 設計書で扱う
  ];
```

> 残る空文字リンク（Return & Refund Policy / Discounts & Offers / Order Dispute / Report a Problem）は**本設計書の対象外**。それぞれ [support-forms](../support-forms/) / [offers](../offers/) 設計書で配線する（同じ `extraLinks` 配列を触るため、実装時はマージ衝突に注意 = 各 PR で当該行のみ変更）。

---

## 3. テスト設計

> RTL（jsdom）。配置はソースと同階層 or `tests/component/`（[tech.md テスト要件](../../../.claude/steering/tech.md)）。

| テスト | 対象                                           | アサート（AAA）                                                           | 対応 AC |
| ------ | ---------------------------------------------- | ------------------------------------------------------------------------- | ------- |
| T-SP1  | `static-page-layout.tsx`                       | `sections` を渡すと各 `heading`（`<h2>`）と本文段落が描画される           | AC-SP1  |
| T-SP2  | `about/page.tsx`（他ページも同型で代表1〜2件） | `<h1>About` が描画される                                                  | AC-SP1  |
| T-SP3  | `customer-service/page.tsx`                    | 5 つの導線 `href`（/contact 等）が DOM に存在                             | AC-SP3  |
| T-SP4  | `user-menu.tsx`                                | extraLinks「Help Center」→`/customer-service`（**回帰**: 旧 `""` を弾く） | AC-SP4  |
| T-SP5  | `user-menu.tsx`                                | extraLinks「Legal & Privacy」→`/legal`（**回帰**）                        | AC-SP5  |

> `/faq` redirect（AC-SP2）は RTL では検証しづらいため E2E or 手動（`tasks.md` の Verification）。`redirect()` を呼ぶだけのページに単体テストは付けない（過剰）。

---

## 判断1. なぜ TSX 定数 + 共有レイアウトか（MDX 却下）

- **選択肢A（採用）**: TSX 定数配列 + `StaticPageLayout`。
    - メリット: 追加ツール不要、型安全（`StaticSection`）、Sonnet 実装容易、5 ページで体裁を共有（DRY）。
    - デメリット: 文章が TS ファイル内（運営の非エンジニアが編集しづらい → 後続で CMS 化余地）。
- **選択肢B（却下）**: MDX + `@next/mdx`。
    - デメリット: 依存追加・ビルド設定・型付けが増え MVP に過剰。プロジェクトに既存実績なし。
- **結論**: A。文面はプレースホルダで提供し、運営差替を前提とする。

## 判断2. なぜ `/faqs` を正規にするか

- footer に `/faq`（"FAQ"）と `/faqs`（"FAQs"）が両方存在（事実 0-2）。2 実体を作ると二重メンテになる。
- `/faqs`（複数形）を本体に、`/faq` は `redirect` の薄いページに。footer のリンク文字列自体は変更せず（リンク先は両方有効）、実体は 1 つに集約。

## 判断3. なぜ `force-dynamic` を付与しないか

- 本ページ群は `src/queries/*` 経由の Prisma を**呼ばない**（事実: コンテンツは定数）。[tech.md「DB 依存ページの動的レンダリング規約」](../../../.claude/steering/tech.md)の対象外。
- 静的化（SSG）でき、配信が速くなる。不要な宣言を足さない（global CLAUDE.md「不要なファイル編集を回避」）。

---

## 影響箇所マトリクス

| パス                                                                               | 変更種別    | 理由                               | リスク                                           |
| ---------------------------------------------------------------------------------- | ----------- | ---------------------------------- | ------------------------------------------------ |
| `src/app/(store)/{about,legal,faqs,faq,customer-service,product-support}/page.tsx` | 新規        | 各静的ページ本体                   | 低（独立追加）                                   |
| `src/components/store/static/static-page-layout.tsx`                               | 新規        | 共有レイアウト                     | 低                                               |
| `src/components/store/static/content/*.ts`                                         | 新規        | コンテンツ定数                     | 低                                               |
| `src/components/store/layout/header/user-menu/user-menu.tsx`                       | 変更（2行） | Help Center / Legal & Privacy 配線 | 低（回帰テストで保護・他空文字リンクは触らない） |
| 統計 docs（QA_HANDOFF 他）                                                         | 変更        | テスト数変動の spec-sync           | 低（生成・同期）                                 |

---

## リスク分析

| リスク                                           | 区分         | 緩和策                                                                                  |
| ------------------------------------------------ | ------------ | --------------------------------------------------------------------------------------- |
| `body` に HTML を入れたくなり XSS 化             | セキュリティ | plain text + `<p>` 固定。リッチ化は構造化データで対応（`dangerouslySetInnerHTML` 禁止） |
| user-menu の `extraLinks` を複数設計書が触り衝突 | 実装統合     | 各 PR で当該行のみ変更。本設計は Help Center / Legal の 2 行のみ                        |
| 文面が未確定のまま公開                           | コンテンツ   | プレースホルダと明記し、運営差替を tasks.md の Verification に記載                      |

---

## Verification（実装後の検証手順）

1. `bun run lint` / `bunx tsc --noEmit` / `bun run test`（T-SP1〜T-SP5）/ `bun run build`。
2. `bun run dev` → 未認証（サインアウト）で `/about` `/legal` `/faqs` `/customer-service` `/product-support` を開き 200 表示を確認（Playwright `browser_take_screenshot` をターゲット ref で・content-heavy のスナップショットは避ける）。
3. `/faq` → `/faqs` にリダイレクトされること。
4. user-menu から「Help Center」「Legal & Privacy」で各ページに到達できること。
5. 文面はプレースホルダのため、運営に正式文面の差替を依頼（フォローアップ）。
