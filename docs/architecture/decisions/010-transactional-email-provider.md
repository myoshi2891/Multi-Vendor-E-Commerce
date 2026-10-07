# 010. トランザクショナルメールのプロバイダ — Resend（差し替え可能な seam の背後に置く）

- **Status**: Proposed（2026-10-07・[plan 021](../../../plans/021-spike-notification-foundation.md) の成果物。**SDK の導入は [plan 086](../../../plans/086-implement-notification-foundation.md) の時点でユーザーが承認してから**）
- **Date**: 2026-10-07
- **Deciders**: メンテナー（承認待ち）

---

## Context

アプリには「状態が変わったら知らせる」仕組みが無い。メール送信の依存も無い（`package.json` に resend / nodemailer / sendgrid / postmark / ses は 0 件）。
Clerk のメールは認証にしか使えない。設計（[`notification-foundation/design.md`](../../design/notification-foundation/design.md)）では、
in-app の記録を権威とし、email は best-effort の補助とした。そのうえで、送信はリース方式の sweeper と `after()` で行い、
**再送の重複はプロバイダの冪等キーで抑える**という配信の約束を採った（design §4.4）。

プロバイダを選ぶ条件は次のとおり。

1. **送信 API が冪等キーを受け付け、その保持期間が分かること**（配信の約束の前提）
2. 無料、または低額で始められること（商用公開前の段階。[ADR-009](009-public-endpoint-rate-limiting.md) は Vercel Hobby を前提にしている）
3. Next.js / TypeScript から使いやすいこと（HTTP API と型付きの SDK）
4. バウンスと苦情の webhook があること（将来の配信停止に使う）
5. ベンダーに縛られないこと（`EmailProvider` interface の背後に置き、差し替えられること）

## Decision

- **第一候補は Resend**。`EmailProvider` の実装の 1 つとして `ResendEmailProvider` を置く。`EMAIL_PROVIDER=resend` のときだけ有効にする。
- ローカル・CI・テストの既定は `StubEmailProvider`（実送信しない）。
- 冪等キーは `${dedupeKey}:email` とし、sweeper の再試行は最初の試行から **23 時間以内**に限る（Resend の保持期間 24 時間より短くする）。
- **SDK（`resend`）の追加は外部依存の追加にあたる。** 実装プランの Step で、ユーザーの承認を得てから行う（CLAUDE.md「確認が必要な場面」）。

## Alternatives Considered

（2026-10-07 時点のベンダー文書で確認した内容。導入時に再確認する）

### Option 1: Resend（採用）

**メリット**:
- `POST /emails` と `/emails/batch` が `Idempotency-Key` に対応している。キーは最大 256 文字、**保持は 24 時間**（[docs](https://resend.com/docs/dashboard/emails/idempotency-keys)）。条件 1 を満たす唯一の候補
- 無料枠は **3,000 通/月・100 通/日**。webhook（delivered / bounced / complained）も無料枠に含まれる（[pricing](https://resend.com/pricing)）
- TypeScript の SDK があり、Next.js との組み合わせの事例が多い

**デメリット**:
- 無料枠は 1 日 100 通が実質の上限。上限に達すると送信が止まる。この場合も in-app は届き、delivery は再試行のあと `FAILED` に残る。商用公開の前に有料プランを検討する
- 比較的新しいベンダーで、配信実績は SES / SendGrid より短い

### Option 2: Postmark

**メリット**: トランザクショナルメールの到達率に定評がある。メッセージの種類（ストリーム）を分けられる。

**デメリット**: **冪等キーに対応していない**と公式に案内している（[support](https://postmarkapp.com/support/article/what-is-an-idempotency-key)）。採ると配信の約束を at-least-once（まれに 2 通届く）に書き換えることになる。

**なぜ選ばなかったか**: 条件 1 を満たさない。

### Option 3: Amazon SES

**メリット**: 送信単価が最も安い。AWS で運用するなら IAM と一緒に管理できる。

**デメリット**: `SendEmail` に冪等キーが無い。送信元の検証、サンドボックスの解除申請、SNS によるバウンス通知の配線など、始めるまでの手間が大きい。デプロイ先が AWS と決まっていない。

**なぜ選ばなかったか**: 条件 1 を満たさず、条件 2 の始めやすさでも劣る。

### Option 4: Twilio SendGrid

**メリット**: 歴史が長く、テンプレートやマーケティング機能まで揃っている。

**デメリット**: **無料プランが 2025-05-28 に廃止された**（[changelog](https://www.twilio.com/en-us/changelog/changes-coming-to-sendgrid-s-free-plans)）。v3 Mail Send の冪等キーへの対応は、今回の調査では確認できなかった。

**なぜ選ばなかったか**: 条件 2 を満たさず、条件 1 も確認できない。

### Option 5: SMTP + nodemailer

**メリット**: プロバイダを問わない。

**デメリット**: 冪等性も、配信状態の webhook も得られない。サーバーレスでは SMTP 接続を保持しにくい。

**なぜ選ばなかったか**: 条件 1・3・4 を満たさない。

## Consequences

### Positive（利点）
- 再送しても受信箱に 2 通届かない、という約束を明示できる（design §4.4）
- `EmailProvider` の背後に置くので、プロバイダを替えるときは実装を 1 つ足して env を切り替えるだけで済む
- 無料枠の範囲で始められる

### Negative（欠点・トレードオフ）
- 再試行は 23 時間で打ち切る。それより長く止まった障害では、メールは `FAILED` のまま届かない（in-app には残る）
- 無料枠の上限（100 通/日）を超えると、その日のメールは届かない

### Risks（リスク）
- **冪等キーに対応しないプロバイダへ替えると、配信の約束が崩れる。** `EmailProvider.idempotencyWindowMs` が 0 のときは、sweeper がリース切れの行を再送しない（重複を避け、取りこぼしを受け入れる側に倒す）。そのうえで design §4.4 を at-least-once に書き換える
- Resend が冪等キーの仕様（保持期間）を変える可能性がある。導入時と年 1 回、ベンダー文書を確認する

## Implementation

- [plan 086](../../../plans/086-implement-notification-foundation.md)（SDK の追加はユーザー承認後）

## Related

- 設計: [`docs/design/notification-foundation/design.md`](../../design/notification-foundation/design.md)
- spike: [plan 021](../../../plans/021-spike-notification-foundation.md)
- 関連 ADR: [ADR-009](009-public-endpoint-rate-limiting.md)（デプロイ先の前提）
