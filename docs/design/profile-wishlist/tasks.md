# Profile Wishlist — タスク

- [x] 保存計画と対象ID・既存仕様を確認。
- [x] RTL新要件5件のRed／ページ正規化・redirect回帰1件を実測。
- [x] Chromium新要件5件のRedを実測。
- [x] ブランド本文・editorialカード・URLページング・空／取得失敗／loadingを実装。
- [x] Refactor後のRTL・Chromium・lint・tsc・文書整合。
- [x] 仕様・進捗・台帳・QAを同期。

[要件](requirements.md)、[設計](design.md)、[進捗](PROGRESS.md)。コミットは明示依頼時のみ。

## P2残存表示統一（2026-10-09）

- [x] 44×44px操作領域のbrowser Red→Green、tokensとURL/empty/loading/errorの回帰、仕様同期。
- [ ] 今回の認証後実ルート受け入れ（既存検証済み履歴は維持）。

[証跡](../design-system/PROGRESS.md#p2残存6画面移行記録)。


## 優先8画面受け入れ（2026-10-11）

- [x] 3幅の最終ページkeyboard/history回帰を追加、既存4幅の通常/empty/error/pendingと併せChrome7/7。Jest18/18、lint 0 errors/8既存warnings、tsc exit0、390px画像目視。
- [ ] 認証後の実データ受け入れは最終QAに条件を記録。
