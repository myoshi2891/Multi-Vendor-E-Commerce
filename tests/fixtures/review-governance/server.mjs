// レビュー ガバナンス（plan 092 Step 7）の browser fixture。店頭のレビューカード（購入者バッジ・通報）、
// プロフィールの状態表示、admin の審査キューを描く。
// 共通処理（bundle・配信・終了処理）は ../shared/fixture-server.mjs に集約している。
import { startFixtureServer } from "../shared/fixture-server.mjs";

await startFixtureServer({
    name: "review-governance",
    entry: "tests/fixtures/review-governance/preview.tsx",
    port: 3138,
    title: "Review governance design fixture",
    mocks: {
        // 通報はサインイン済みの前提で描く（未サインインの案内は Jest で固定）
        "@clerk/nextjs": `export function useUser(){return {isLoaded:true,isSignedIn:true}}`,
        "next/navigation": `export function useRouter(){return {push(h){location.assign(h)},replace(h){location.replace(h)},refresh(){window.refreshed=(window.refreshed??0)+1}}} export function usePathname(){return location.pathname} export function useSearchParams(){return new URLSearchParams(location.search)}`,
    },
    loader: { ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
});
