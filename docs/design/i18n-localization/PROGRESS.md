# i18n Localization — 進捗（PROGRESS.md）

> 進捗 SSOT。Phase 単位の現在地のみを記録する。詳細手順は [tasks.md](./tasks.md)。

---

## 現在地

| Phase | 内容 | 状態 |
| --- | --- | --- |
| — | 設計（requirements / design / tasks） | ✅ 完了（2026-06-26） |
| Phase 0 | 基盤（next-intl 導入 + cart パイロット + ADR） | ⬜ 未着手 |
| Phase 1 | 顧客向け store（`(store)` + `components/store/**`） | ⬜ 未着手 |
| Phase 2 | フォーム + Zod 国際化 | ⬜ 未着手 |
| Phase 3 | dashboard（seller / admin）+ 定数 | ⬜ 未着手 |
| Phase 4 | 仕上げ（static 長文 / metadata / Error キー化 / ESLint 昇格） | ⬜ 未着手 |

凡例: ⬜ 未着手 / 🟡 進行中 / ✅ 完了

---

## 次アクション

- **Phase 0-1**: next-intl の Next.js 16 対応バージョンを確認しピン留めして導入（`tasks.md` 0-1〜0-12）。
- 着手前の確認: Zod 移行方式（案A/B）は Phase 2 で `src/queries/*.test.ts` の assert 形態を見て確定（現時点では未定）。

---

## 決定ログ

| 日付 | 決定 | 根拠 |
| --- | --- | --- |
| 2026-06-26 | ライブラリ = next-intl | App Router 標準・型拡張・将来切替容易（ユーザー決定） |
| 2026-06-26 | routing 無し（Cookie `NEXT_LOCALE`）方式 | 全ページ force-dynamic で SSG 放棄済 → `[locale]` の旨味なし。既存 middleware/ルート温存（[design.md 判断1](./design.md)） |
| 2026-06-26 | 言語ポリシー = ja デフォルト + 将来 en 切替 | ユーザー決定。`product.md` の国際展開スコープ外性と整合 |
| 2026-06-26 | 既存日本語も辞書へ吸収・直書き禁止 | 一貫性最優先（[requirements FR-6 / NFR-8](./requirements.md)） |

---

## 未確定事項

- next-intl バージョン（実装時にピン留め）。
- Zod 国際化の案A（ファクトリ）/案B（キー）— Phase 2 で確定。
- `static/` 長文の格納粒度（ドメイン別分割を基本線とする）。
