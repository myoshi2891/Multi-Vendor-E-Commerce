# Support Forms — 設計（design.md）

> 中核設計。実装者（Sonnet）が**該当行を特定して差分実装できる**粒度で記述する。
> 要件 ID は [requirements.md](./requirements.md)、手順は [tasks.md](./tasks.md)。

---

## 0. 設計の前提（実コードで確認済みの事実）

| #   | 事実                                                                                                                                 | 出典（行番号）                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0-1 | server action は `src/queries/*.ts` に `"use server"` で集約。Prisma は `src/lib/db.ts` シングルトン経由                             | [`src/queries/message.ts:1-5`](../../../src/queries/message.ts#L1-L5)                                                                                                                                  |
| 0-2 | Zod スキーマは `src/lib/schemas.ts`。`z.string().trim().min().max()` で本文長を検証する流儀                                          | [`schemas.ts:653-666`](../../../src/lib/schemas.ts#L653-L666)（`SendMessageSchema`/`StartConversationSchema`）                                                                                         |
| 0-3 | `User` は `id`/`email @unique`/`name` を持つ。`currentUser()` から Clerk ユーザーを取得                                              | [`schema.prisma:18-39`](../../../prisma/schema.prisma#L18-L39)                                                                                                                                         |
| 0-4 | `Order.id` は uuid。`Order.userId` は非 null（ゲスト注文なし）                                                                       | [`schema.prisma:498-525`](../../../prisma/schema.prisma#L498-L525)                                                                                                                                     |
| 0-5 | footer に `/contact`・`/returns-exchange` 配線済。user-menu の Return & Refund Policy=`/`、Order Dispute=`""`、Report a Problem=`""` | [`footer/links.tsx:54-57,86-89`](../../../src/components/store/layout/footer/links.tsx#L54) / [`user-menu.tsx:189-208`](../../../src/components/store/layout/header/user-menu/user-menu.tsx#L189-L208) |
| 0-6 | リエントランシーガードは `useRef` フラグ（finally で解放）                                                                           | [`newsletter.tsx`](../../../src/components/store/layout/footer/newsletter.tsx)（tech.md 記載）                                                                                                         |
| 0-7 | 既存 additive migration（Conversation/Message）の前例があり、`safe-migration`+ERD 再生成のワークフローが確立                         | [`docs/design/profile-messages/design.md`](../profile-messages/design.md)                                                                                                                              |

---

## 1. 共通設計

### 1.1 ディレクトリ構成（新規/変更）

```
prisma/schema.prisma                          ← 変更（SupportTicket モデル + enum 追加）
prisma/migrations/<timestamp>_add_support_ticket/   ← 新規（safe-migration が生成）
docs/architecture/data-model.drawio           ← 再生成（bun run erd:generate）

src/lib/schemas.ts                            ← 変更（SupportTicketSchema 追加）
src/queries/support.ts                        ← 新規（createSupportTicket）
src/queries/support.test.ts                   ← 新規（ユニット）

src/app/(store)/contact/page.tsx              ← 新規
src/app/(store)/returns-exchange/page.tsx     ← 新規（ポリシー要約 + フォーム）
src/app/(store)/dispute/page.tsx              ← 新規
src/app/(store)/report-problem/page.tsx       ← 新規

src/components/store/support/
  ├─ support-form.tsx                         ← 新規（共有フォーム client component）
  └─ support-form.test.tsx                    ← 新規（コンポーネント）

src/components/store/layout/header/user-menu/
  └─ user-menu.tsx                            ← 変更（3 リンク配線）
```

### 1.2 再利用元マトリクス

| 流用するもの                                                  | 出典                                                 | 用途                              |
| ------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------- |
| server action の構造（`"use server"`・try/catch・構造化ログ） | `src/queries/message.ts:1-45`                        | `support.ts` の雛形               |
| Zod の文字列検証スタイル                                      | `schemas.ts:653-666`                                 | `SupportTicketSchema`             |
| RHF + Zod resolver フォーム                                   | 既存ダッシュボードフォーム（`*FormSchema` 利用箇所） | `support-form.tsx`                |
| リエントランシーガード                                        | `newsletter.tsx`                                     | `support-form.tsx` の二重送信防止 |
| additive migration ワークフロー                               | `profile-messages` 設計                              | schema 追加 + ERD 再生成          |
| `currentUser()` 取得                                          | `user-menu.tsx:20-37`（try/catch 縮退）              | ログイン時 `userId` 付与          |

### 1.3 認可方針

- フォーム送信は**公開**。`requireUser` 等のガードは**付けない**（ゲスト問い合わせを許容・[判断3](#判断3-なぜ送信を公開にするか認可ガードを付けない)）。
- ログイン中のみ `currentUser()` で `userId` を付与（取得失敗・未ログインは `userId=undefined` で続行・縮退）。
- 注文番号（`orderId`）は**所有権を検証しない**（ゲストが自分の注文番号を申告する用途。漏洩リスクは「番号を知る人だけが申請」で許容）。本人性の厳密検証は運営側の後続対応に委ねる（スコープ外）。

---

## 2. 機能詳細

### 2.1 schema 追加（`prisma/schema.prisma`）

```prisma
/// サポート系フォーム（問い合わせ/返品/紛争/問題報告）の受付チケット。
/// 4 種のフォームを category で識別し単一テーブルに集約する。
/// 設計の正本: docs/design/support-forms/design.md §2.1
model SupportTicket {
  id       String                @id @default(uuid())
  category SupportTicketCategory

  name    String
  email   String
  subject String
  message String @db.Text

  /// RETURN_REQUEST / DISPUTE のみ必須（Zod で強制）。対象注文への任意参照。
  orderId String?
  order   Order?  @relation("SupportTicketToOrder", fields: [orderId], references: [id], onDelete: SetNull)

  /// ログイン送信時のみ設定。ゲスト送信は null。
  userId String?
  user   User?   @relation("SupportTicketToUser", fields: [userId], references: [id], onDelete: SetNull)

  /// 運営対応ステータス。閲覧 UI は後続（本 MVP は保存のみ）。
  status String @default("OPEN")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([category, status])
  @@index([userId])
  @@index([orderId])
}

enum SupportTicketCategory {
  CONTACT
  RETURN_REQUEST
  DISPUTE
  PROBLEM_REPORT
}
```

**逆リレーション追加**（既存モデルに 1 行ずつ）:

```diff
  // model User { ... }
+ supportTickets SupportTicket[] @relation("SupportTicketToUser")

  // model Order { ... }
+ supportTickets SupportTicket[] @relation("SupportTicketToOrder")
```

> **migration**: `safe-migration` skill で `bunx prisma migrate dev --name add_support_ticket`（**`db push` 禁止**）。additive（既存列の変更なし）で**非破壊**。完了後 `bunx prisma generate` + `bun run erd:generate`（rule 03）を**同一コミット**に含める。

### 2.2 Zod スキーマ（`src/lib/schemas.ts` 末尾に追加）

```ts
// サポートチケット（4 フォーム共通）。category により orderId 必須を切替える。
export const SupportTicketCategoryEnum = z.enum([
    "CONTACT",
    "RETURN_REQUEST",
    "DISPUTE",
    "PROBLEM_REPORT",
]);

export const SupportTicketSchema = z
    .object({
        category: SupportTicketCategoryEnum,
        name: z.string().trim().min(1, "お名前を入力してください。").max(120),
        email: z
            .string()
            .trim()
            .email("有効なメールアドレスを入力してください。"),
        subject: z.string().trim().min(1, "件名を入力してください。").max(200),
        message: z
            .string()
            .trim()
            .min(1, "内容を入力してください。")
            .max(5000, "内容は5000文字以内です。"),
        // RETURN_REQUEST / DISPUTE では必須。他カテゴリでは任意。
        orderId: z.string().trim().min(1).optional(),
    })
    .superRefine((val, ctx) => {
        const needsOrder =
            val.category === "RETURN_REQUEST" || val.category === "DISPUTE";
        if (needsOrder && !val.orderId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["orderId"],
                message: "対象の注文番号を入力してください。",
            });
        }
    });

export type SupportTicketInput = z.infer<typeof SupportTicketSchema>;
```

### 2.3 server action（`src/queries/support.ts`・新規）

```ts
"use server";

import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { SupportTicketSchema, type SupportTicketInput } from "@/lib/schemas";

/**
 * サポートチケット（問い合わせ/返品/紛争/問題報告）を作成する。
 * 公開アクション（ゲスト送信可）。ログイン時のみ userId を付与する。
 *
 * @param input - フォーム入力（category を含む）。Zod で検証する。
 * @returns 作成された SupportTicket の id
 * @throws "入力内容を確認してください。" Zod 検証失敗
 * @throws "送信に失敗しました。時間をおいて再度お試しください。" DB エラー
 */
export async function createSupportTicket(
    input: SupportTicketInput
): Promise<{ id: string }> {
    // 入力検証は try/catch の外（検証エラーを汎用 DB エラーで上書きしない）。
    const parsed = SupportTicketSchema.safeParse(input);
    if (!parsed.success) {
        throw new Error("入力内容を確認してください。");
    }
    const data = parsed.data;

    // ログイン時のみ userId を付与。未ログイン/取得失敗はゲスト送信として続行。
    let userId: string | undefined;
    try {
        const user = await currentUser();
        userId = user?.id;
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("[Support:createSupportTicket] currentUser failed", {
                error: error.message,
                stack: error.stack,
            });
        } else {
            console.error(
                "[Support:createSupportTicket] currentUser failed (unknown)",
                {
                    error,
                }
            );
        }
        // userId 未設定のまま続行（ゲスト扱い）。
    }

    try {
        const ticket = await db.supportTicket.create({
            data: {
                category: data.category,
                name: data.name,
                email: data.email,
                subject: data.subject,
                message: data.message,
                orderId: data.orderId,
                userId,
            },
            select: { id: true },
        });
        return ticket;
    } catch (error: unknown) {
        if (error instanceof Error) {
            // PII（message 本文）はログしない。最小限のメタのみ。
            console.error("[Support:createSupportTicket] create failed", {
                error: error.message,
                stack: error.stack,
            });
        } else {
            console.error(
                "[Support:createSupportTicket] create failed (unknown)",
                {
                    error,
                }
            );
        }
        throw new Error("送信に失敗しました。時間をおいて再度お試しください。");
    }
}
```

> **`server-action-scaffold` skill** を起動し本雛形を生成すると、構造化ログ・try/catch 配置が規約に揃う。

### 2.4 共有フォーム部品（`support-form.tsx`・client component）

**方針**: category を prop で受け、RHF + Zod resolver で検証。`orderId` 欄は category により表示。リエントランシーガードで二重送信防止。

```tsx
"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SupportTicketSchema, type SupportTicketInput } from "@/lib/schemas";
import { createSupportTicket } from "@/queries/support";

interface SupportFormProps {
    category: SupportTicketInput["category"];
    /** orderId 欄を表示するか（RETURN_REQUEST / DISPUTE で true） */
    requireOrderId?: boolean;
    submitLabel?: string;
}

export default function SupportForm({
    category,
    requireOrderId,
    submitLabel,
}: SupportFormProps) {
    const isSubmittingRef = useRef(false);
    const [done, setDone] = useState(false);
    const form = useForm<SupportTicketInput>({
        resolver: zodResolver(SupportTicketSchema),
        defaultValues: {
            category,
            name: "",
            email: "",
            subject: "",
            message: "",
            orderId: "",
        },
    });

    const onSubmit = async (values: SupportTicketInput) => {
        if (isSubmittingRef.current) return; // 早期リターン（二重送信防止）
        isSubmittingRef.current = true;
        try {
            await createSupportTicket(values);
            setDone(true);
            form.reset({
                ...form.getValues(),
                name: "",
                email: "",
                subject: "",
                message: "",
                orderId: "",
            });
        } catch (error: unknown) {
            // ユーザー向けエラーは form のルートエラーに反映（console は使わない）。
            const message =
                error instanceof Error ? error.message : "送信に失敗しました。";
            form.setError("root", { message });
        } finally {
            isSubmittingRef.current = false;
        }
    };

    if (done)
        return (
            <p role="status">受け付けました。担当より追ってご連絡します。</p>
        );

    // ↓ shadcn/ui Form + Input/Textarea で name/email/subject/message を描画。
    //   requireOrderId が true のとき orderId 欄を表示する。
    //   form.formState.errors.root?.message を上部に表示。
    return /* RHF フィールド群（既存ダッシュボードフォームのスタイルに準拠） */ null;
}
```

> `category` は hidden 値として常に送る（フォーム上では編集不可）。`requireOrderId` は UI 表示の切替で、最終的な必須検証は Zod の `superRefine`（§2.2）が担う（クライアント/サーバー二重防御）。

### 2.5 各ページ `page.tsx`

```tsx
// src/app/(store)/contact/page.tsx
import type { Metadata } from "next";
import SupportForm from "@/components/store/support/support-form";

export const metadata: Metadata = { title: "Contact | Marketplace" };

/** お問い合わせフォーム。公開（ゲスト可）。DB 書込は server action 側のため force-dynamic 不要。 */
export default function ContactPage() {
    return (
        <main className="mx-auto max-w-2xl px-4 py-10">
            <h1 className="mb-6 text-2xl font-bold">Contact us</h1>
            <SupportForm category="CONTACT" submitLabel="Send" />
        </main>
    );
}
```

- `returns-exchange/page.tsx`: 上部に返品ポリシー要約（[storefront-static-pages](../storefront-static-pages/) の定数を再利用可）+ `<SupportForm category="RETURN_REQUEST" requireOrderId />`。
- `dispute/page.tsx`: `<SupportForm category="DISPUTE" requireOrderId />`。
- `report-problem/page.tsx`: `<SupportForm category="PROBLEM_REPORT" />`。

> **`force-dynamic`**: 各ページは client フォームを描画するだけで、レンダリング時に `src/queries/*` の Prisma を**読まない**（書込は submit 時の server action 内）。よって `force-dynamic` は不要（[tech.md 規約](../../../.claude/steering/tech.md)の対象外）。

### 2.6 変更: `user-menu.tsx`（3 リンク配線）

[`user-menu.tsx:189-208`](../../../src/components/store/layout/header/user-menu/user-menu.tsx#L189-L208) の `extraLinks`:

```diff
-   { title: "Return & Refund Policy", link: "/" },
+   { title: "Return & Refund Policy", link: "/returns-exchange" },
-   { title: "Discounts & Offers", link: "" },          // ← offers 設計書で配線
-   { title: "Order Dispute Resolution", link: "" },
+   { title: "Order Dispute Resolution", link: "/dispute" },
-   { title: "Report a Problem", link: "" },
+   { title: "Report a Problem", link: "/report-problem" },
```

> Discounts & Offers は [offers 設計書](../offers/) が配線する（本 PR では触らない）。Help Center / Legal は [storefront-static-pages](../storefront-static-pages/) が配線済。

---

## 3. テスト設計

> ユニット: `src/queries/support.test.ts`（Prisma/Clerk モック）。コンポーネント: `support-form.test.tsx`（RTL）。

| テスト | 対象                  | アサート（AAA）                                                                             | 対応 AC |
| ------ | --------------------- | ------------------------------------------------------------------------------------------- | ------- |
| T-SF1  | `createSupportTicket` | 有効 CONTACT 入力 → `db.supportTicket.create` が `category:"CONTACT"` で呼ばれ id を返す    | AC-SF1  |
| T-SF2  | `createSupportTicket` | RETURN_REQUEST で `orderId` 無 → throw「入力内容を確認してください。」、`create` 未呼び出し | AC-SF2  |
| T-SF3  | `createSupportTicket` | ログイン時（`currentUser` モック）→ `data.userId` が当該 id                                 | AC-SF3  |
| T-SF4  | `createSupportTicket` | 未ログイン（`currentUser` が null）→ `userId` 未設定で `create`                             | AC-SF4  |
| T-SF5  | `support-form.tsx`    | 必須未入力で submit → エラー表示・`createSupportTicket` 未呼び出し（mock）                  | AC-SF5  |
| T-SF6  | `support-form.tsx`    | 連続 submit → mock が1回だけ呼ばれる（リエントランシー）                                    | AC-SF6  |
| T-SF7  | `user-menu.tsx`       | Return&Refund→`/returns-exchange`・Dispute→`/dispute`・Report→`/report-problem`（回帰）     | AC-SF7  |

> テスト数が大きく動くため [spec-sync-after-test](../../../.claude/skills/spec-sync-after-test/) を**必ず**起動（QA_HANDOFF SSOT → 伝播 + dashboard 再生成を**同一コミット**）。

---

## 判断1. なぜ単一 `SupportTicket` モデルか

- 4 フォームのフィールドは name/email/subject/message + 任意 orderId でほぼ同一。category で識別すれば 1 テーブルで足りる。
- **メリット**: migration 1 回・server action 1 本・テスト集約。将来の管理者閲覧 UI も 1 テーブルを `category` で絞るだけ。
- 個別モデル案（ContactSubmission / ReturnRequest / …）はテーブル4つ + CRUD 重複でコスト過大（ユーザー選択で却下）。

## 判断2. なぜ `orderId` を Zod の `superRefine` で条件必須にするか

- スキーマ列としては `orderId String?`（nullable）に保ちつつ、RETURN_REQUEST / DISPUTE のときのみアプリ層で必須化する。
- DB 制約で `NOT NULL` にすると CONTACT/REPORT が表現できない。Zod 側で category 依存の必須を表すのが最小コスト。

## 判断3. なぜ送信を公開にするか（認可ガードを付けない）

- 問い合わせ・問題報告はゲスト（未購入者・未登録者）も行う典型ユースケース。`requireUser` を付けると正当な利用を阻害する。
- ログイン中のみ `userId` を付け、後の名寄せに使う。`currentUser()` の失敗は握りつぶさず**ログした上でゲスト続行**（縮退）。

---

## 影響箇所マトリクス

| パス                                                                         | 変更種別    | 理由                                           | リスク                                    |
| ---------------------------------------------------------------------------- | ----------- | ---------------------------------------------- | ----------------------------------------- |
| `prisma/schema.prisma`                                                       | 変更        | `SupportTicket` モデル + enum + 逆リレーション | 中（migration を伴う・additive で非破壊） |
| `prisma/migrations/*_add_support_ticket/`                                    | 新規        | safe-migration 生成                            | 中（本番は `migrate deploy`）             |
| `docs/architecture/data-model.drawio`                                        | 再生成      | rule 03（ERD 同期）                            | 低（生成物）                              |
| `src/lib/schemas.ts`                                                         | 変更        | `SupportTicketSchema` 追加                     | 低                                        |
| `src/queries/support.ts`                                                     | 新規        | `createSupportTicket`                          | 低                                        |
| `src/app/(store)/{contact,returns-exchange,dispute,report-problem}/page.tsx` | 新規        | 各フォームページ                               | 低                                        |
| `src/components/store/support/support-form.tsx`                              | 新規        | 共有フォーム                                   | 低                                        |
| `src/components/store/layout/header/user-menu/user-menu.tsx`                 | 変更（3行） | リンク配線                                     | 低（回帰テスト保護・offers 行は触らない） |

---

## リスク分析

| リスク                             | 区分         | 緩和策                                                                                 |
| ---------------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| スパム送信（公開フォーム）         | セキュリティ | follow-up で reCAPTCHA / レート制限。MVP は Zod 長さ制限 + `status` で運営側トリアージ |
| `orderId` の他人注文を申告         | セキュリティ | 所有権検証はしない（番号申告ベース）。運営対応で本人確認（スコープ外と明記）           |
| user-menu を複数設計書が編集し衝突 | 実装統合     | 本 PR は Return&Refund/Dispute/Report の 3 行のみ。Discounts は offers 設計書          |
| PII（本文）のログ漏洩              | プライバシー | エラーログに `message` 本文を含めない（メタのみ・NFR-SF1）                             |

---

## Verification（実装後の検証手順）

1. `safe-migration` 実行 → `bunx prisma generate` → `bun run erd:generate`（ERD 差分を同一コミット）。
2. `bun run lint` / `bunx tsc --noEmit` / `bun run test`（T-SF1〜T-SF7）/ `bun run build`。
3. `bun run dev` → ゲスト状態で `/contact` 送信 → `bunx prisma studio` で `SupportTicket`（category=CONTACT・userId=null）を確認。
4. ログイン状態で `/returns-exchange`（orderId 必須）送信 → `userId` が入ること・orderId 未入力でエラーになることを確認。
5. user-menu の Return&Refund / Dispute / Report から各ページに到達できること。
