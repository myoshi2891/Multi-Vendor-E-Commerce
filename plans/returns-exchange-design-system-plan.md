# Returns & Exchange デザイン移行（2026-10-01）

対象: DS-PAGE-036 `/returns-exchange`、DS-COMP-093 SupportFormの返品用ブランド表示。
承認: ユーザーの今回依頼。design-system-workflowを適用。
変更: 深緑ヒーロー、クリーム背景、ゴールド、セリフ見出し、パンくず、既存ポリシー＋申請フォームの2カラム。ブランドフォーム、送信中・受付完了・失敗の表示。
基本ルール対応: Clientでactionを直接importせず、submitActionをServer Componentから渡す。他の3呼び出し元（contact/dispute/report-problem）と既存テストもPropsを同期し、表示は維持。
対象外: 返品ポリシー文面・条件、返金・在庫・DB・認証・Zodの変更、他画面のデザイン移行。
依存: RETURNS_POLICY_SUMMARY、SupportTicketSchema、createSupportTicket、SupportForm。
受け入れ条件: 既存ポリシー全文維持、名前/email/件名/内容/注文番号のラベル・必須検証。RETURN_REQUESTとUUID注文番号を送信。未入力・不正email/注文番号・送信中・失敗から再試行・受付完了。送信中のブランドフォームは入力とボタンをロックし二重送信防止。完了後は申請フォームを外し受付を通知。1440/390/768px、折り返し・横溢れなし、focusとキーボード操作、axe AA。
先行テスト: RTLでブランド送信中表示・入力ロック・RETURN_REQUEST引数・失敗後再試行。Playwrightで配色、既存ポリシー、各状態・focus・幅・axe。Red確認後実装。
検証: 関連Jest、Chromium（actionモックでDB書込/外部送信なし）、他SupportForm呼び出し元回帰、lint、tsc、PC/モバイル画像。
文書: support-forms requirements/design/tasks/PROGRESS、SDD requirements/interfaces/workflows/testing、移行計画・進捗、QA_HANDOFF、TEST_IMPLEMENTATION_PLAN、全体進捗。本計画に最終結果。dashboard再生成、ファイル数のみ実測同期。

完了（2026-10-01、未コミット）: RTL新要件1件・Chromium3件Redを実測。最終関連Jest16/16、Chromium4/4、lint 0 errors／既存12 warnings、tsc成功。3幅・各状態axe AA・PC/モバイル画像確認、他3呼び出し元モック送信回帰、仕様と台帳同期済み。実送信・全体coverage再測定なし。
