# Profile Addresses — 設計

[要件](requirements.md)、[保存計画](../../../plans/layout-design/profile-addresses-design-system-plan.md)。

- force-dynamic Server Componentで初期loadをtry/catchし、汎用失敗状態とload/save/defaultの3actionをPropsで渡す。Clientに直接action importはない。
- `src/queries/user.ts`のgetProfileShippingAddressesは既存所有者queryへ委譲し、住所表示項目とcountry id/name/codeのみ投影。supported countriesはDBから同じ3項目をname順で取得。user/createdAt/updatedAtは送らない。
- `src/lib/schemas.ts`のProfileShippingAddressSchemaは既存ShippingAddressSchemaに任意UUID idを加える。saveはrequireUser、Zod検証、編集時の所有者findFirstを経て既存upsertへ委譲。新規id/userはサーバーで決定。default変更はUUID検証と所有者findFirstを経て既存upsertへ委譲する。
- 既存upsertの所有者制約/既定解除transactionを保持。datesを任意入力型にし、新フォームはdatesを渡さずPrismaのcreatedAt/updatedAt管理に任せる。既存共有フォームの呼び出しは維持。
- 住所ごとのol/li/h2カード、既定は文字付きbadge、Edit/Make defaultは常時表示のnative button。成功した初期dataをmount時に再取得しない。再取得/既定操作は同期refとdisabledで直列化。
- profile専用AddressFormはRHF+Zod、native input/select/checkbox。編集初期値を復元し、save後に返された住所と国を結合して一覧を更新。default=trueでは他の既定表示を解除。失敗時は入力を保持する。
- Radix dialogを直接使用し、共有UIは変更しない。label/error-describedby/aria-invalid、汎用alertとstatus、focus trapと閉じた後の起点復帰。submitの同期refは非同期validationの前から二重要求を防ぐ。保存中は閉じる/Escape/外側も禁止。overflowのdialogはtabIndex=0で全入力disabled中もスクロール操作可能。
- 専用module CSSのクリーム/深緑/ゴールド、serif h1。1000px以下でカード/フォームを1列、mobile dialogと長い住所を折り返す。44px以上の操作、focus-visible、静的loading。

実Clerkテスト顧客の認証/後処理と初期空の実queryを確認。通常住所/遅延/失敗/save/defaultはaction応答mockで確認し、住所DBを書き換えず購入/外部送信しない。既存profile E2Eのフォームselectorはnative入力へ同期するが、実住所を書き込む旧E2Eは今回実行しない。


## 購入後6画面の共通表示（2026-10-10）

[保存計画](../../../plans/layout-design/priority-six-p2-postpurchase-design-system-plan.md)。既存CSS Moduleを役割別purchaseトークンへ接続。購入者scopeに限定し、API/DB/認可とデータ取得境界は変更しない。postpurchase suiteは既存priority serverから本番部品を描画し、トークン注入でcomputed style追従を検証する。
