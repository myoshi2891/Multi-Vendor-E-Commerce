# Profile Settings — 要件（requirements.md）

> 記法: EARS 風（`When/While/The system shall`）。受け入れ基準は `AC-S<n>`。
> 設計は [design.md](./design.md)、実装手順は [tasks.md](./tasks.md)。

---

## 1. 機能要件

| ID | 要件（EARS 風） |
|----|-----------------|
| **S-1** | 認証済み顧客が `/profile/settings` にアクセスしたとき、システムは Clerk の `<UserProfile />` を含む設定画面を表示しなければならない。 |
| **S-2** | 顧客が氏名またはメールアドレスを変更したとき、システムは（Clerk 経由で）変更を保存し、Clerk webhook により Prisma `User`（`name`/`email`/`picture`）へ同期しなければならない。 |
| **S-3** | 顧客はパスワードを `<UserProfile />` の Security 区画から変更できなければならない。 |
| **S-4** | 顧客は多要素認証（MFA）を `<UserProfile />` の Security 区画から設定・解除できなければならない。 |
| **S-5** | 顧客はアカウントを `<UserProfile />` から削除でき、削除時に Clerk webhook（`user.deleted`）が Prisma `User` を削除しなければならない。 |
| **S-6** | ユーザーメニューの「Settings」リンクは `/profile/settings` を指さなければならない（現状 `/` への誤リンクを修正）。 |
| **S-7** | プロフィールサイドバーに「Settings」エントリが存在し、`/profile/settings` へ遷移できなければならない。 |

---

## 2. 受け入れ基準（AC）

| ID | 受け入れ基準 | 検証方法 |
|----|-------------|----------|
| **AC-S1** | 未認証ユーザーが `/profile/settings` にアクセスすると Clerk middleware によりサインインへリダイレクトされる（`/profile/*` は保護ルート）。 | E2E / 手動 |
| **AC-S2** | `/profile/settings` の DOM に `<UserProfile>`（Clerk）由来の要素が描画される。 | RTL（Clerk を `jest.mock`） |
| **AC-S3** | `user-menu.tsx` の `extraLinks` 中「Settings」の `link` が `/profile/settings` である（旧 `/` でない）。 | RTL（回帰テスト） |
| **AC-S4** | `sidebar.tsx` の `menu` に `{ title: "Settings", link: "/profile/settings" }` が含まれる。 | RTL |
| **AC-S5** | 氏名変更後、webhook `user.updated` 経由で Prisma `User.name` が更新される。 | 手動（webhook ログ確認）/ E2E |
| **AC-S6** | アカウント削除後、webhook `user.deleted` 経由で Prisma `User` が削除される。 | 手動 / E2E |

> AC-S5 / AC-S6 は **既存 webhook の振る舞い**であり、本機能では webhook を変更しない。実装時に**回帰**していないことの確認に留める（[design.md §判断2](./design.md) 参照）。

---

## 3. 非機能要件（NFR）

| ID | 内容 |
|----|------|
| **NFR-S1**（セキュリティ） | パスワード・MFA・アカウント削除は Clerk 公式 UI に委譲し、自前で認証情報を扱わない。秘密情報のハードコード・ログ出力をしない（global CLAUDE.md 準拠）。 |
| **NFR-S2**（コード規約） | `any` 禁止（`unknown` + 型ガード）。`console.log` 禁止。新規ページは server component とし、client 部分は Clerk コンポーネントに限定。 |
| **NFR-S3**（視覚整合） | `<UserProfile appearance>` で profile共通枠（アイボリー／PCサイドバー220px、狭い画面は折り返しナビゲーション）に収まり、モバイルで横スクロールを生じないよう調整。 |
| **NFR-S4**（TDD） | [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md) を遵守（Red→Green→Refactor・1論理単位=1commit・spec-sync 同梱）。 |

---

## 4. スコープ外

- 通知設定・言語/通貨設定・テーマ切替（[`product.md` スコープ外](../../../.claude/steering/product.md): 多通貨対応は現フェーズ対象外）。
- 販売者/管理者向けの設定画面。
- Clerk の `<UserProfile>` をカスタムフォームで置き換えること（[design.md §判断1](./design.md) で却下）。

## 共通枠の移行（2026-09-30）

profile概要と共通ナビゲーションの新デザインは[profile-overview仕様](../profile-overview/requirements.md)を参照。Settingsへのリンク、選択状態、Clerk UserProfileの表示は回帰確認済み。UserProfile自体のブランド変更は本移行に含めない。

## 設定本体のデザイン移行（2026-10-05）

Clerk UserProfileのhash routingとセキュリティ機能を保持し、専用appearanceとCSS Moduleを導入。アイボリー、濃いゴールドの操作色、セリフ見出し、意味を保つ危険色、focus、狭い幅のカード枠を整備。RTLはラベル付きsection・appearance・hashを検証、補助ブラウザは3幅とaxe AAを検証。実Clerk/認証後実ルートは保留。[証跡](../design-system/PROGRESS.md#優先7画面移行記録)。既存機能の完了記録をデザイン検証完了とは扱わない。

## P2残存表示統一（2026-10-09）

settings rootはstore限定purchase themeを合成し、Clerk appearanceのprimary/background/foreground/input/danger/success/ringを共通tokensへ接続。hash routing・氏名/メール/security機能は維持する。SDKのPortalは埋め込みpageの変数を継承しないため、型が提供するmodalContentへthemeを合成した専用classを渡す。入力と操作は44px以上、可視focusと意味色を維持する。

インストール済み@clerk/nextjs 7.5.19が参照する@clerk/reactの型（CssColor=string、modalContent key）を確認。[Clerk公式variables仕様](https://clerk.com/docs/guides/customizing-clerk/appearance-prop/variables)のCSS custom properties対応に従う。補助adapterはappearance/hashの受け渡しと計算済み配色を検証するもので、実SDK lifecycle/認証/セキュリティ操作の証明にはしない。

[計画](../../../plans/layout-design/priority-six-p2-residual-design-system-plan.md)／[証跡](../design-system/PROGRESS.md#p2残存6画面移行記録)。
