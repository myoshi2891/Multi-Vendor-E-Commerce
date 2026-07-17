// Store ドメインの共有定数。
//
// `src/queries/store.ts` は "use server" モジュールであり、Next.js は
// そこからの export を async 関数のみに制限する（非 async の値 export は
// ビルドエラー）。サーバー側クエリと Server Component の双方から参照する
// 定数はこのモジュールに置くこと。

// 無制限の findMany を防ぐ防御的上限。将来はサーバーサイドページネーションへ移行（PERF-04 follow-up）。
export const STORE_ORDERS_MAX = 200;
