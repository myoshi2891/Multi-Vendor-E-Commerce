# View history — 設計

Server routeがparamsを正規化し、getProductsByIdsをfetchHistoryAction PropsでHistoryContainerへ渡す。Clientはmount/page/retry時にstorageを読み、必要時だけactionを呼ぶ。範囲外結果では最終有効ページを取得してrouter.replaceする。effect cleanupで古い応答とunmount更新を破棄する。各loadで古い表示を隠し、エラーと空を区別する。既存ProductList editorialとDiscoveryPaginationを再利用する。queries/productのpublic contractと商品計算を変更しない。旧共有ProductCardのwishlist action importは既存の別対象のまま。

[保存計画](../../../plans/layout-design/priority-five-design-system-plan.md) / [証跡](../design-system/PROGRESS.md#p2優先5画面移行記録)
