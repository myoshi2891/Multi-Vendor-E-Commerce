# P2サポート 保留2件の解消（通知の実既読化／Clerk独立Portal）

- 日付: 2026-10-11。ユーザー承認済み。元計画: [P2サポート・通知等8画面](priority-eight-p2-support-design-system-plan.md)。
- 元計画の「データ追加なし」は、**専用DB `multivendor_e2e` の design 顧客への検証用通知3件の冪等投入に限り**例外とする。

## 対象・受け入れ条件

| ID | 受け入れ条件 |
|---|---|
| DS-P2-SUPPORT-NOTIFICATIONS | 実Clerk・実Action・専用DBで、未読3件を3幅で表示し、単件既読（リンク無し・キーボード）、リンク遷移による既読、一括既読のそれぞれが再読み込み後も保持される |
| DS-P2-SUPPORT-CLERK-PORTAL | 実SDKの `/profile/settings` で、保存しない操作ごとに `.cl-modalContent` / `[role=dialog]` の生成を調べる。生成された場合はその経路で配色・44px・focus・390px を検証する。生成されない場合は、根拠を記録したうえで受け入れ条件を「埋め込みでは modal 経路なし」に改める |

## 方法

- 通知: `scripts/design/prepare-purchase-route.ts` で `Notification` を固定 `dedupeKey`（`design-p2:shipped` / `design-p2:nolink` / `design-p2:nolink-2`）を使って upsert する。毎回 `isRead:false` に戻す。配信行（`NotificationDelivery`）は作らない。
- テスト: `tests/browser/purchase-route-design.spec.ts` の P2 通知テストから空状態の分岐を外し、上記の経路を必須にする。先に、準備前のデータでテストが失敗すること（Red）を確認する。
- Portal: 調査は scratchpad の一時 spec で行い、コミットしない。UserButton の「Manage account」は別の appearance を使うため対象外とする。
- アプリコード、API、DB schema、Clerk の公式 UI は変更しない。設定の実保存・削除、外部への送信、push、PR は行わない。

## 検証

DB 変数3つを専用DBに揃える → `prepare-route-audit.ts` → `prepare-purchase-route.ts`（2回実行し、通知が3件のまま増えないことを確認）→ `DESIGN_BROWSER_CHANNEL=chrome DESIGN_SUITE=purchase-route bun run test:design`。tsc・lint・`check:playwright` も通す。結果は [PROGRESS](../../docs/design/design-system/PROGRESS.md) と [QA_HANDOFF](../../docs/testing/QA_HANDOFF.md) に同期する。
