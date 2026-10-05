# 販売者UI移行設計

[表示要件](requirements.md)／[タスク](tasks.md)／[証跡](../design-system/PROGRESS.md#優先6画面移行記録)。

## 商品登録・バリアントの表示境界

既存のSellerShell、SellerPage、ProductDetails design="seller"とscoped CSSを使用する。ページにh1、フォームにlevel2 headingを置き、動的行は狭幅で折り返す。画像/キーワード列は1100px未満で縦配置。画像ボタンと動的行の強調はブランド色へ統一し、商品色は保持する。FormActionは既存Propsを維持。保存中はfieldsetをlock、同期refで重複を防止、失敗時は入力を保持して汎用alert、成功/処理中はstatusを提示。API・schema・計算・認可に変更なし。商品一覧の作成dialogにも共通フォームの改善が適用される。

## 検証境界

six suiteはproductionのページ・フォーム・CSSをbundleし、DB/Server Action/Cloudinary/Jodit/Nextをadapterにする。認証後実ルート・SDK内部の実描画は専用test DBとClerk環境で別途受け入れ確認する。
