# マーケットプレイス拡張計画 — 汎用骨組みによる土台作り（正式版）

本ディレクトリは、本プロジェクトを「Amazon 級の世界トップクラス EC サイト」へ拡張するための
**対応計画ドキュメント群（正式版）**である。ブランディング（総合モール型か特化型か等）が未定のため、
**構造はブランド非依存・コンテンツとポリシーはデータで差し替え可能**な骨組みの定義を主眼とする。

> **これは検討・計画ドキュメントであり、実装指示書ではない。** 実装の入口は各章が参照する
> spike プラン（設計を確定させてから実装プランを生成する二段構え）である。

---

## 読み順と各章の責務

| 章 | ファイル | 責務 |
|---|---|---|
| 1 | [`01-vision-and-principles.md`](01-vision-and-principles.md) | 「Amazon 級」の定義（6つの構造的性質）と、ブランド未定下での設計原則（構造/ポリシー分離） |
| 2 | [`02-current-state.md`](02-current-state.md) | 現状分析 — 再利用できる強み資産と、拡張を阻むボトルネック **B-1〜B-10** |
| 3 | [`03-category-taxonomy.md`](03-category-taxonomy.md) | 参照カテゴリタクソノミー（**20部門**）・運用ルール・ナビゲーション/URL 構成への対応 |
| 4 | [`04-architecture-pillars.md`](04-architecture-pillars.md) | 汎用骨組みのアーキテクチャ方針 **10本柱**（①〜⑩）と各柱の決定事項/未決事項 |
| 5 | [`05-phased-roadmap.md`](05-phased-roadmap.md) | **フェーズ別ロードマップ（本計画の SSOT）** — Phase 0/A/B/C/D と順序の根拠 |

---

## SSOT（Single Source of Truth）の宣言

- **フェーズロードマップの SSOT は [`05-phased-roadmap.md`](05-phased-roadmap.md) である。**
  従来 SSOT だった [`plans/direction/EXPANSION_BLUEPRINT.md`](../../../plans/direction/EXPANSION_BLUEPRINT.md) §5
  （improve スキル Round 2 成果物）から本ディレクトリへ**移管**した（2026-07-10）。
- 本ドキュメント群は、improve スキル（senior advisor / 読み取り専用監査）の Round 2
  （カタログ基盤・発見性）/ Round 3（運用・信頼・成長）の成果物を**統合・昇格**したもの。
  監査エビデンスの原本と spike プラン本体は `plans/`（advisor 作業領域）にある:
  - 監査 findings: [`plans/audit/findings-09-direction-expansion.md`](../../../plans/audit/findings-09-direction-expansion.md)（E-1〜E-5）/
    [`findings-10-direction-operations-growth.md`](../../../plans/audit/findings-10-direction-operations-growth.md)（O-1〜O-5）
  - spike プラン: `plans/013〜022-spike-*.md`（柱①〜⑩に対応）
  - `plans/` も git 追跡対象だが、**役割が違う**: `plans/` は Round ごとの監査原本・作業領域であり、
    本ドキュメント群が**継続的に更新される正式版**である。ロードマップの差分は必ず本ディレクトリ側へ入れること
  - **凍結されるのは昇格した原本のみ**であり、`plans/` 全体ではない:
    - 凍結（以後更新しない）: `plans/direction/`（`EXPANSION_BLUEPRINT.md` /
      `OPERATIONS_TRUST_GROWTH_BLUEPRINT.md`）と `plans/audit/findings-*.md`
    - 継続更新: `plans/README.md`（status 列）・`plans/ADVISOR_STATE.md`・実行中の
      `plans/001〜057-*.md`（作業領域のため）

---

## 更新規約

1. **spike の設計確定時**: [`04-architecture-pillars.md`](04-architecture-pillars.md) の該当柱の
   「決めるべきこと」を決定事項で置き換える（コミットは `docs(architecture):` スコープ）
2. **ブランド確定時**: [`03-category-taxonomy.md`](03-category-taxonomy.md) の部門表に有効化列を
   追記し、[`05-phased-roadmap.md`](05-phased-roadmap.md) の検算表を実際の決定で上書きする
3. **恒久的なアーキテクチャ決定**（例: カテゴリツリーの表現方式・通知の Outbox 方式）が確定したら
   [`../decisions/`](../decisions/) に ADR を起こし、該当章からリンクする
   （作成基準: [`documentation-guide.md`](../../../.claude/steering/documentation-guide.md) —
   代替案比較を伴う技術選定のため該当）
4. **ボトルネック解消時**: [`02-current-state.md`](02-current-state.md) の該当 B 項目に
   解消済みマークと解消コミット/PR への参照を付す（行の削除はしない — 経緯の記録として残す）
5. 本ドキュメント群と実装が乖離した場合は実装を正とし、`spec-sync-check` スキルの報告に従って
   本ドキュメントを更新する

## 関連ドキュメント

- [`../saas-roadmap.md`](../saas-roadmap.md) — SaaS 化（マルチテナント）ロードマップ。
  本計画とは独立のゲート付き将来項目（Phase 2 以降は現時点で不要とゲート済み）
- [`../../../.claude/steering/product.md`](../../../.claude/steering/product.md) — プロダクトビジョン・
  スコープ外リスト（本計画が尊重する既決事項の原本）
- [`../../../specs/multi-vendor-ecommerce/`](../../../specs/multi-vendor-ecommerce/) — 機能仕様書（SDD）
