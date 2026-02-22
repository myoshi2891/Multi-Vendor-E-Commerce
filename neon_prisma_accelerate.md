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

## ✅ 方法A（推奨）：pgloader使用

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

---

## 方法B：SQL手動変換（小規模のみ）

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
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 型確認

* Boolean → OK
* JSON → OK（Postgresの方が強い）
* Decimal → 互換性確認
* Enum → Prisma定義を確認

---

# 5. Migrationリセット（重要）

MySQL用migrationは使用不可。

```bash
rm -rf prisma/migrations
```

新規作成：

```bash
npx prisma migrate dev --name init_postgres
```

---

# 6. データ整合性確認

```bash
npx prisma studio
```

* レコード件数一致確認
* NULL値確認
* 外部キー確認

---

# 7. Prisma Accelerate有効化

Prismaダッシュボードで Accelerate 有効化。

```bash
npx prisma generate --accelerate
```

`.env` 更新：

```
DATABASE_URL="accelerate経由URL"
```

---

# 8. Prisma Client最適化（Next.js用）

`lib/prisma.ts`

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as {
  prisma: PrismaClient
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient()

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

→ Prismaに任せる

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
