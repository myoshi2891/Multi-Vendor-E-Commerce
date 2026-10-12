# Track Order — 進捗トラッカ

> このファイルは [tasks.md](./tasks.md) の **Phase 進捗の SSOT**（どこまで完了し、次にどこから着手するか）。
> 全体の履歴・テスト統計は [docs/PROGRESS.md](../../PROGRESS.md)、統計の SSOT は [docs/testing/QA_HANDOFF.md](../../testing/QA_HANDOFF.md)。
> 要件は [requirements.md](./requirements.md)、設計は [design.md](./design.md)。

---

## 🧭 現在地（2026-06-26）

- ✅ **設計完了** — README / requirements / design / tasks / PROGRESS を作成。
- ✅ **実装完了** — Phase 1〜3 完了（`b2a30e5`〜`b57bd40` + docs sync）。lint/tsc/test/build 全緑。
- 👉 **次の着手**: なし（follow-up: レート制限 / reCAPTCHA は requirements §4 スコープ外）。

---

## Phase 進捗 ✅ 完了

| Phase | 内容                                                                   | 状態 | SKILL                                |
| ----- | ---------------------------------------------------------------------- | ---- | ------------------------------------ |
| 1     | Zod（TrackOrderSchema） + server action（trackOrder・IDOR 3 階層 TDD） | ✅ `b2a30e5`〜`494811d` | test-gen                |
| 2     | UI（page + form + result・共有ステータスタグを流用）                   | ✅ `d636079`〜`b57bd40` | test-gen                |
| 3     | 品質チェック + ドキュメント同期                                        | ✅   | test-complete / spec-sync-after-test |

> **既存表示部品の流用調査の結論**: design §1.2 が参照した `src/app/(store)/order/[orderId]/` は実在せず、注文詳細は `src/app/(fullscreen)/order/[orderId]/page.tsx`。流用したのは重い `order-page/*`（force-dynamic / PDF / 決済列依存）ではなく共有ステータスタグ `OrderStatusTag` / `PaymentStatusTag` / `ProductStatusTag`（`src/components/shared/`）。`track-order-result.tsx` はこれらを組み合わせる軽量実装。
> **コンポーネントテスト配置**: design のコロケート指定どおり `src/components/store/track-order/track-order-form.test.tsx` に配置（直近の `support-form.test.tsx` も `src/components/store/support/` にコロケート済みで、これが現行慣習）。当初 `tests/component/store/` に置いたが、レビュー指摘によりコロケートへ移動。

---

## SKILL 起動チェック（漏れ防止）

- [ ] feature-plan（着手前・必須）
- [ ] test-gen（Phase 1 / 2）
- [ ] test-complete（各コミット前）
- [ ] spec-sync-after-test（テスト数変動時・必須）
- [ ] spec-sync-check（最終・任意）
- [ ] safe-migration は **不要**（schema 変更無し）
- [ ] server-action-scaffold は **任意**（既存 order.ts への追加）

---

## レビュー必須ポイント

- [ ] 不一致と不存在が同一応答（列挙防止）。
- [ ] `where` が `{ id: orderId }`、email 照合は取得後アプリ層。
- [ ] 戻り値から `user`（email）除去・ログに PII を含めない。
- [ ] 公開アクション（認可ガード無し）・既存 `getOrder` を壊していない。


## P2残存表示・Step 1 配送追跡（2026-10-11）

先行RTL1件でstore状態タグ未接続のRed、390px browserでtoken非継承のRed。rootにpurchase theme、入力control-line/input色、dark heroのgold focusと44pxリンク、3状態タグvariant="store"を適用。Green/Refactor: track-order-form Jest6/6、priority browser3/3（1440/768/390px、pending lock/error/retry/missing/success/長文、axe contrast含む）。型0、lint0 errors/既存8 warnings。実照会は既存専用DBの公開routeで別確認、ここはmock Actionによる補助検証。

[保存計画](../../../plans/layout-design/priority-eight-p2-support-design-system-plan.md)／[証跡](../design-system/PROGRESS.md#p2サポート通知等8画面移行記録)。API・DB・認可・入力/URL/業務契約は保持。
