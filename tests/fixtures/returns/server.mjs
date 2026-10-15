// 返品 RMA（plan 088 Step 5）の browser fixture。顧客の返品欄と seller の返品キューを描く。
// 共通処理（bundle・配信・終了処理）は ../shared/fixture-server.mjs に集約している。
import { startFixtureServer } from "../shared/fixture-server.mjs";

await startFixtureServer({
    name: "returns",
    entry: "tests/fixtures/returns/preview.tsx",
    port: 3135,
    title: "Returns RMA design fixture",
    mocks: {
        "next/navigation": `export function useRouter(){return {push(h){location.assign(h)},replace(h){location.replace(h)},refresh(){window.refreshed=(window.refreshed??0)+1}}} export function usePathname(){return location.pathname} export function useSearchParams(){return new URLSearchParams(location.search)}`,
    },
    loader: { ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
});
