// アカウント系（following / history）の browser fixture。
// 共通処理（bundle・配信・終了処理）は ../shared/fixture-server.mjs に集約している。
import { startFixtureServer } from "../shared/fixture-server.mjs";

await startFixtureServer({
    name: "priority",
    entry: "tests/fixtures/priority/preview.tsx",
    port: 3110,
    title: "Priority design browser fixture",
    mocks: {
        "@/queries/user": `export async function addToWishlist(){return true}`,
        "next/navigation": `const router={replace(url){history.replaceState(null,"",url)},push(url){location.assign(url)},refresh(){}}; export function useRouter(){return router}`,
    },
});
