// アカウント系（following / history）の browser fixture。
// 共通処理（bundle・配信・終了処理）は ../shared/fixture-server.mjs に集約している。
import { startFixtureServer } from "../shared/fixture-server.mjs";

// port は playwright.design.config.ts が DESIGN_FIXTURE_PORT で渡す（purchase / priority で別 port）。
// 単体起動時は従来の priority 用 port にフォールバックする
const portEnv = process.env.DESIGN_FIXTURE_PORT?.trim();
const port = portEnv ? Number(portEnv) : 3110;
if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
        `Invalid DESIGN_FIXTURE_PORT: ${process.env.DESIGN_FIXTURE_PORT}`
    );
}

await startFixtureServer({
    name: "priority",
    entry:
        process.env.DESIGN_SUITE === "purchase"
            ? "tests/fixtures/priority/purchase-preview.tsx"
            : "tests/fixtures/priority/preview.tsx",
    port,
    title: "Priority design browser fixture",
    mocks: {
        "@/queries/product": `import {products} from "./tests/fixtures/priority/purchase-data"; let compareCalls=0;
        export async function getProductsByIds(ids){
            const scenario=new URLSearchParams(location.search).get("scenario") ?? "";
            await new Promise(resolve=>setTimeout(resolve, scenario.includes("pending")?10000:350));
            if(scenario.includes("error") && ++compareCalls===1) throw new Error("fixture failure");
            return {products:scenario.includes("unavailable")?[]:ids.map(id=>({...products[0],id,slug:"piece-"+id,variants:[{...products[0].variants[0],variantId:id,variantSlug:id}]})),totalPages:1};
        }
        export async function getProducts(){return {products:new URLSearchParams(location.search).has("pieces") ? products : []}}`,
        "@/queries/notification": `export async function getMyNotifications(){throw new Error("fixture lookup failure")} export async function markNotificationRead(){return {count:1}} export async function markAllNotificationsRead(){return {count:1}}`,
        "@/queries/profile": `import {products} from "./tests/fixtures/priority/purchase-data"; export async function getUserWishlist(){const scenario=new URLSearchParams(location.search).get("scenario") ?? ""; if(scenario.includes("error")) throw new Error("fixture failure"); return {wishlist:scenario.includes("empty")?[]:products,totalPages:scenario.includes("empty")?0:20}}`,
        "@/queries/review": `export async function upsertReview(){throw new Error("fixture only")}`,
        "next-cloudinary": `export function CldUploadWidget({children}){return children({open(){}})}`,
        "@/queries/user": `export async function addToWishlist(){return true} export async function followStore(){return true}`,
        "next/dynamic": `export default function dynamic(){return function DynamicFixture(){return null}}`,
        "@clerk/nextjs": `import React from "react"; export function useUser(){return {isLoaded:true,isSignedIn:true}} export function SignOutButton({children}){return children} export function UserButton(){return React.createElement("button",null,"Manage account")}`,
        "next/navigation": `export function redirect(url){location.assign(url); throw new Error("fixture redirect")} export function useSearchParams(){return new URLSearchParams(location.search)} export function usePathname(){return location.pathname} const router={replace(url){history.replaceState(null,"",url)},push(url){location.assign(url)},refresh(){}}; export function useRouter(){return router}`,
    },
});
