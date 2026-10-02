# Profile messages デザインシステム移行

- 日付: 2026-10-03。ユーザーの購入者messages画面への移行依頼を承認範囲とする。
- 対象: DS-PAGE-026、DS-COMP-090 MessagesContainer。新しいprofile専用threadをDS-COMP-202に登録。販売者側で使用する旧shared layout/hook/thread（DS-COMP-089/091/092）は変更せず未移行を維持。
- 保持: 店舗名/logo/最新本文による会話一覧、時系列スレッド/購入者・店舗の発言区別、1〜2000文字trim検証、送信成功後再取得、5秒poll/背面停止/多重要求防止/切替とunmount時の旧応答破棄、選択時相手発の既読化。
- 表示: account共通配色/GeorgiaのMy messages h1/日本語リード/サポート、PC2ペインとmobile縦配置、長い店舗名/本文のwrap、label付きtextarea/native send、選択pressed、読み取り可能な日時/送信者。
- 状態: 空/未選択/メッセージなし、初回一覧/スレッド取得失敗とretry、既読失敗とretry、取得中static skeleton/status、送信中入力/会話切替のロックと二重送信防止、失敗時draft保持、成功後クリアと再取得。
- 境界: Server Componentからload list/load thread/send/mark readをaction Propsで渡す。新profile Clientとhookはqueryを直接importしない。表示facadeは既存認証/所有者/参加者queryに委譲し表示項目/ISO日時だけ投影。既存DB/schema/認可/送信transactionを維持。
- 対象外: 販売者画面デザイン変更、新規会話起票UI、添付/リアルタイム/通知・未読件数追加。

## TDDと受け入れ検証

1. RTLでブランドheading/empty/native選択、thread loading/失敗/retry、入力検証/送信中lock/失敗draft保持/成功/重複要求、race/poll/hidden/unmountを先行Red。表示queryの投影/ISO/auth/参加者制約を先行テスト。Chromium390px h1 Red。
2. 実装後関連Jest（既存message query/旧thread/販売者/sidebar回帰）、lint/tsc。
3. Chromium1440/390/768px、空/通常/長い値/会話選択/双方向表示/入力エラー/送信中/送信失敗/成功/取得失敗/retry/既読失敗、focus/Tab/Enter、axe AA（contrast除外なし）、横溢れなし、画像目視。
4. 実Clerk test sessionと初期空実query、会話/スレッド/送信/既読はaction応答mock。実店舗への送信/会話DB作成/購入/seedは行わない。実往復E2Eは今回実行せず既存実績を維持。

## 文書同期

既存docs/design/profile-messagesのrequirements/design/tasks/PROGRESS/READMEを現行設計へ同期。SDD01/02/04/05/07更新、00/03/06確認と変更不要理由、移行台帳/計画チェック、QA/テスト実装計画/全体進捗/dashboard。全体統計は実測値のみ。コミット依頼なし。
