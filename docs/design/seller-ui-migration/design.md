# 販売者UI移行設計

[表示要件](requirements.md)／[タスク](tasks.md)／[証跡](../design-system/PROGRESS.md#優先6画面移行記録)。

## 商品登録・バリアントの表示境界

既存のSellerShell、SellerPage、ProductDetails design="seller"とscoped CSSを使用する。ページにh1、フォームにlevel2 headingを置き、動的行は狭幅で折り返す。画像/キーワード列は1100px未満で縦配置。画像ボタンと動的行の強調はブランド色へ統一し、商品色は保持する。FormActionは既存Propsを維持。保存中はfieldsetをlock、同期refで重複を防止、失敗時は入力を保持して汎用alert、成功/処理中はstatusを提示。API・schema・計算・認可に変更なし。商品一覧の作成dialogにも共通フォームの改善が適用される。

## 検証境界

six suiteはproductionのページ・フォーム・CSSをbundleし、DB/Server Action/Cloudinary/Jodit/Nextをadapterにする。認証後実ルート・SDK内部の実描画は専用test DBとClerk環境で別途受け入れ確認する。

バリアント追加は既存商品のmain情報をProductDetailsへ渡し、Add variantのページ見出しを追加する。商品名・商品説明・brandは従来どおり表示せず、カテゴリの既存操作と初期値を維持。商品レベルの属性は送信しない。取得結果null時の挙動は変更しない。

バリアント編集は既存owner-scoped queryの初期値を保持し、Edit variant見出しを追加。seller opt-inの保存フィードバックはフォーム内status/alertに集約し、既存Radix toastのaria-hidden/focus問題を持ち込まない。旧scopeのtoastは維持する。

## 配送設定

Server pageが既定配送と国別料金のDecimalを同じドル単位のnumberへ投影し、SellerShippingへ渡す。updateDefaultsAction/upsertShippingRateActionは既存queryの型を使いPropsで注入。ClientのcreateShippingColumns factoryから国別編集へ渡す。既存のDefault/Free表現、保存ID/countryId、配送範囲validationとreturn policyを維持。ラベル付きnative number入力とscoped gridでレスポンシブ表示。同期submit guardとsave guardで重複を防ぎ、失敗後の値保持/再送とinline statusを提供。CustomModalの任意lockedとDialogContentの任意closeDisabledは既定false。配送編集時だけpending中のEscape/outside/Closeを防ぎ、終了後は起点ボタンへfocusを返す。

## 店舗フォーム

StoreDetailsDataはid/name/description/email/phone/logo/cover/url/featured/statusだけを保持。設定pageは必要な列だけselectし、Decimalなど未使用のDBオブジェクトをClientへ渡さない。upsertStoreActionをServerから注入し、画像と連絡先をscoped gridで配置。既存Zod/featured/画像URLと更新payload・refreshを維持、保存中lock/重複防止/値保持/retry/statusを共通save hookで扱う。店舗作成のAction注入も同じinterfaceへ追従し、本体テーマは別Stepで適用する。

店舗作成は店舗別Shell外のため、scoped standalone枠にheader/ThemeToggle/main/SellerPageを置く。固定sidebar余白を持たず最大1080pxの本文を中央配置。既存APIはidあり=更新、idなし=作成のため、新規保存のみidを省略し、返却urlへ移動する。更新idとrefreshは維持する。画像未選択時はgroupのaria-describedbyとalertでエラーを関連付ける。
