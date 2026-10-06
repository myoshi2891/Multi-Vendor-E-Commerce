// アカウント系（following / history）の browser fixture。
// 共通処理（bundle・配信・終了処理）は ../shared/fixture-server.mjs に集約している。
import { startFixtureServer } from "../shared/fixture-server.mjs";

await startFixtureServer({
    name: "priority",
    entry:
        process.env.DESIGN_SUITE === "purchase"
            ? "tests/fixtures/priority/purchase-preview.tsx"
            : "tests/fixtures/priority/preview.tsx",
    port: 3110,
    title: "Priority design browser fixture",
    mocks: {
        "@/queries/user": `export async function addToWishlist(){return true}`,
        "next/dynamic": `export default function dynamic(){return function DynamicFixture(){return null}}`,
        "@clerk/nextjs": `import React from "react"; export function SignOutButton({children}){return children} export function UserButton(){return React.createElement("button",null,"Manage account")}`,
        "next/navigation": `export function useSearchParams(){return new URLSearchParams(location.search)} export function usePathname(){return location.pathname} const router={replace(url){history.replaceState(null,"",url)},push(url){location.assign(url)},refresh(){}}; export function useRouter(){return router}`,
    },
});
