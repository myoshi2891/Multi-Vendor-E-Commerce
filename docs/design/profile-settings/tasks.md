# 顧客プロフィール設定機能 — 実装タスクカード (tasks.md)

本機能の実装は、テスト駆動開発 (TDD) の原則に則り、インクリメンタルに進めます。

---

## タスクリスト

### Phase 1: ルートと共通レイアウトの構築
- [ ] `/profile/settings` のディレクトリおよびプレースホルダー `page.tsx` の作成
- [ ] ログイン状態の確認（認証ガード）のテスト記述 (Unit Test)
- [ ] 認証ガードの実装（未ログイン時は `/sign-in` へリダイレクト）

### Phase 2: Clerk `<UserProfile />` のマウント
- [ ] Clerkのコンポーネントを配置するラッパーの作成
- [ ] CSS変数等によるshadcn/uiのスタイル調和の確認
- [ ] モバイル・デスクトップそれぞれのレスポンシブ表示確認

### Phase 3: アカウント削除 (退会) 機能
- [ ] 退会ダイアログ（二段階認証）のUIコンポーネント実装
- [ ] アカウント削除用の Server Action `deleteAccountAction` のスタブ作成
- [ ] 退会処理のユニットテスト記述（DBクリーンアップ・Clerk API呼び出しのモック）
- [ ] Server Action 内で Clerk SDK 経由でのユーザー削除処理の実装
- [ ] ローカルDBの同期（削除または論理削除処理）の実装

### Phase 4: E2E テストと結合確認
- [ ] Playwrightを用いたログイン後のプロフィール設定画面アクセス・編集・退会フローのテスト作成
- [ ] CIパイプラインでの動作確認

---

## コミット指針
- `feat: add profile settings page shell and authorization guards`
- `feat: integrate clerk UserProfile component with custom styling`
- `feat: implement delete account UI and Server Action with DB cleanup`
- `test: add unit and E2E tests for profile settings & account deletion`
