# MySQL → PostgreSQL（Neon + Prisma Accelerate）移行手順書

**対象構成:** Next.js + Prisma + Vercel
**移行先:** Neon + Prisma Accelerate

---

## 🎯 目的

既存の **MySQL + Prisma** 環境を、
**PostgreSQL（Neon）+ Prisma Accelerate** 構成へ安全に移行する。

---

## 🏗 最終構成

```
Next.js (Vercel)
        ↓
Prisma Client
        ↓
Prisma Accelerate
        ↓
Neon PostgreSQL
```

---

# 0. 事前確認チェックリスト

* [ ] テーブル数確認
* [ ] データ量確認（数MB〜数百MBならdump方式OK）
* [ ] ENUM利用有無確認
* [ ] JSON型利用確認
* [ ] 外部キー制約確認
* [ ] バックアップ取得

---

# 1. Neonプロジェクト作成

1. Neon にログイン
2. 「New Project」作成
3. Productionブランチ作成
4. 接続URLを保存

例：

```
postgresql://user:password@ep-xxxx.neon.tech/db?sslmode=require
```

---

# 2. MySQLデータをバックアップ

```bash
mysqldump -u root -p --single-transaction --routines --triggers your_db > dump.sql
```

※必ずバックアップ保管

---

# 3. データ移行方法の選択

## ✅ 方式 B（推奨）：pgloader使用

> `01-data-migration-guide.md` では「方式 B」として記載されています。

### インストール

```bash
brew install pgloader
```

### 実行

```bash
pgloader mysql://user:password@localhost/your_db \
         postgresql://user:password@ep-xxxx.neon.tech/db
```

✅ 型変換を自動で処理
✅ 外部キー対応
✅ ENUM対応

> **重要**: pgloader はテーブル名を小文字に変換します。実行後に `docs/migration/rename-tables.sql` で PascalCase にリネームしてください：
>
> ```bash
> psql "$DIRECT_URL" -f docs/migration/rename-tables.sql
> ```

---

## 方式 C：SQL手動変換（小規模のみ）

主な変換ルール：

| MySQL          | PostgreSQL |
| -------------- | ---------- |
| AUTO_INCREMENT | SERIAL     |
| DATETIME       | TIMESTAMP  |
| TINYINT(1)     | BOOLEAN    |
| ENGINE=InnoDB  | 削除         |
| backtick `     | ダブルクォート "  |

---

# 4. Prisma schema変更

`schema.prisma` を修正：

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

> `directUrl` は `DATABASE_URL` が `prisma://` スキーム（Prisma Accelerate）の場合に必須。`prisma migrate` 等の直接接続に使用されます。

### 型確認

* Boolean → OK
* JSON → OK（Postgresの方が強い）
* Decimal → 互換性確認
* Enum → Prisma定義を確認

---

# 5. Migrationリセット（重要）

MySQL用migrationは使用不可。

> [!CAUTION]
> `rm -rf prisma/migrations` はマイグレーション履歴を**完全に削除**します。
> 実行前にバックアップを取得してください（`cp -r prisma/migrations prisma/migrations_backup`）。

```bash
rm -rf prisma/migrations
```

新規作成（pgloader でテーブルが作成済みの場合、`--create-only` でファイル生成のみ）：

```bash
# マイグレーションファイルのみ生成（適用はしない）
bunx prisma migrate dev --name init_postgres --create-only

# pgloader でテーブル作成済みのため、ベースラインとして記録
bunx prisma migrate resolve --applied init_postgres
```

---

# 6. データ整合性確認

```bash
bunx prisma studio
```

* レコード件数一致確認
* NULL値確認
* 外部キー確認

---

# 7. Prisma Accelerate有効化

Prismaダッシュボードで Accelerate 有効化。

> **注意**: `--accelerate` フラグは Prisma 5.2.0 で非推奨、7.0.0 で削除されました。
> `DATABASE_URL` に `prisma://` スキームを使用すると自動検出されるため、通常の `bunx prisma generate` で十分です。
> 別途 `@prisma/extension-accelerate` をインストールし、`withAccelerate()` 拡張を適用してください。

```bash
bunx prisma generate
```

`.env` 更新：

```
# Prisma Accelerate URL（Prismaダッシュボードで取得）
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=your_api_key"

# Neon Direct connection URL（Neonダッシュボードで取得）
# schema.prisma の directUrl = env("DIRECT_URL") と対応
DIRECT_URL="postgresql://<YOUR_USER>:<YOUR_PASSWORD>@ep-xxxx.neon.tech/multivendor_ecommerce?sslmode=require"
```

---

# 8. Prisma Client最適化（Next.js用）

`lib/prisma.ts`

```ts
import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const extendedPrisma = () =>
  new PrismaClient().$extends(withAccelerate())

type ExtendedPrisma = ReturnType<typeof extendedPrisma>

const globalForPrisma = globalThis as unknown as {
  prisma?: ExtendedPrisma
}

export const prisma =
  globalForPrisma.prisma ?? extendedPrisma()

if (process.env.NODE_ENV !== 'production')
  globalForPrisma.prisma = prisma
```

---

# 9. Vercel環境変数更新

Vercel管理画面：

```
Project → Settings → Environment Variables
```

更新：

```
DATABASE_URL=accelerateのURL
```

再デプロイ。

---

# 10. Runtime確認（重要）

App Router使用時：

```ts
export const runtime = 'nodejs'
```

⚠ Edge runtimeは使用しない（TCP接続のため）

---

# 11. 本番切替フロー（安全手順）

1. Neonでbranch作成
2. staging環境で接続確認
3. データ最終同期
4. Vercel環境変数切替
5. 再デプロイ
6. 動作確認

---

# 12. よくあるトラブルと対処

## ❌ コネクションエラー

→ Accelerate未設定の可能性

---

## ❌ テーブル名の大文字問題

PostgreSQLは小文字化される。

→ `docs/migration/rename-tables.sql` を実行して PascalCase にリネーム：

```bash
psql "$DIRECT_URL" -f docs/migration/rename-tables.sql
```

詳細は「3. データ移行方法の選択」の方式 B を参照。

---

## ❌ ENUMエラー

Prismaのenum定義とDB型を一致させる

---

## ❌ トランザクション長時間実行

Neonは分散設計
→ 長時間ロックを避ける

---

# 13. ロールバック戦略

万が一失敗時：

1. MySQLバックアップ保持
2. VercelのDATABASE_URLを元に戻す
3. 再デプロイ

---

# 14. コスト目安（個人開発）

Neon：

* 無料枠あり
* スリープ機能あり
* 使用量ベース課金

0→1開発ではほぼ無料圏内。

---

# 🎯 結論

個人開発でも：

> 最初から PostgreSQL（Neon）+ Prisma Accelerate がベストプラクティス。

理由：

* Serverlessとの相性
* 将来の拡張性
* 移行コスト削減
* 接続爆発防止

---

# 📌 最終チェック

* [ ] Neon作成済
* [ ] データ移行完了
* [ ] Prisma schema修正
* [ ] Migration再生成
* [ ] Accelerate有効化
* [ ] Vercel環境変数更新
* [ ] Node runtime指定
* [ ] 本番動作確認

以下は **Next.js + Prisma + Neon + Vercel 構成（1人開発前提）** のための実務ドキュメントです。
そのまま `.md` として保存できます。

---

# Prisma運用安全ガイド

対象構成：

* Vercel
* Neon
* Prisma
* Next.js（App Router想定）

前提条件：

* 本番ユーザーはすぐには発生しない
* migration頻度は低い
* 将来的に共同開発予定なし

---

# 1. Prisma Migration事故例

Prismaは便利ですが、運用を誤ると本番事故に直結します。

---

## 🚨 事故例1：`migrate dev` を本番で実行

### ❌ やってしまう例

```bash
npx prisma migrate dev
```

本番環境で実行してしまう。

### なぜ危険？

* スキーマ再生成
* shadow database作成
* 意図しない変更
* データ消失の可能性

### ✅ 正解

本番では必ず：

```bash
npx prisma migrate deploy
```

のみを使用。

---

## 🚨 事故例2：カラム削除でデータ消失

```prisma
model User {
  name String
}
```

↓

```prisma
model User {
  // name削除
}
```

→ migration実行
→ nameカラム消滅
→ データ完全消失

### ✅ 安全手順

1. まず nullableにする
2. データ退避
3. 削除は最終段階

---

## 🚨 事故例3：型変更による破壊

```prisma
price Int
```

↓

```prisma
price String
```

PostgreSQLでは変換失敗する場合あり。

### ✅ 安全手順

1. 新カラム作成
2. データ移行
3. 旧カラム削除

---

## 🚨 事故例4：Enum変更でアプリ停止

PostgreSQLはEnum変更が厳格。

Enum値削除は破壊的。

### ✅ 対策

* Enumは極力増やすだけ
* 削除はデータ確認後

---

## 🚨 事故例5：本番DBへ直接push

```text
mainブランチに直接push
→ Vercel自動デプロイ
→ migrate実行
→ 本番破壊
```

1人開発でも発生します。

---

# 2. 本番で絶対やってはいけないこと一覧

## ❌ 1. 本番で `migrate dev`

絶対禁止。

---

## ❌ 2. 本番DBへ直接接続して手動SQL実行

```sql
DROP TABLE users;
```

誤爆の原因。

---

## ❌ 3. Preview環境を本番DBへ接続

環境変数ミスで発生。

必ず確認：

```env
DATABASE_URL
```

---

## ❌ 4. バックアップ無しでmigration

最低限：

* Neon branch作成
* dump取得

---

## ❌ 5. 長時間トランザクション

Neon は分散設計。

長時間ロックは非推奨。

---

## ❌ 6. Prisma Clientの多重生成

必ずSingleton化：

```ts
const globalForPrisma = global as any
```

しないと接続爆発。

---

# 3. SaaS化前提の拡張設計

現時点では不要ですが、将来を見据えた設計。

---

# 🧩 フェーズ1：個人アプリ（現在）

構成：

```text
main（production）
staging
```

PR branch自動化は不要。

---

# 🧩 フェーズ2：小規模SaaS化

必要になるもの：

* 認証強化（Auth.js等）
* ログ設計
* Soft delete導入
* 監査カラム追加

例：

```prisma
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
deletedAt DateTime?
```

---

# 🧩 フェーズ3：マルチテナント対応

設計変更が必要。

### 方法A：tenant_id方式（推奨）

```prisma
model Post {
  id        String @id
  tenantId  String
}
```

全テーブルに tenantId を持たせる。

---

### 方法B：スキーマ分離

PostgreSQL schemaごとに分離。

管理が複雑になるため初期は非推奨。

---

# 🧩 フェーズ4：高トラフィック対応

必要になるもの：

* Prisma Accelerate有料化
* Neon Pro
* Read replica
* キャッシュ（Redis）

---

# 🛡 将来事故らないための設計原則

1. 破壊的変更は段階的に行う
2. Enumは慎重に扱う
3. データ削除は論理削除優先
4. 本番migrationは deployのみ
5. mainブランチは神聖領域

---

# 🎯 あなたの現状での最適解

* staging + main のみで十分
* PRごとDB branchは今は不要
* migrationは年数回なら慎重運用でOK

---

# 📌 最小安全運用ルール（1人開発版）

1. main直pushしない
2. 本番では `migrate deploy` のみ
3. migration前にNeon branch作成
4. Prisma ClientはSingleton
5. DATABASE_URLを毎回確認

---

# 🔥 結論

現段階では：

> 過剰な自動化は不要
> シンプルかつ安全な構成が最適

将来SaaS化する場合でも、
今の設計を丁寧にやっていれば拡張可能。
