// 販売者ダッシュボード 7 画面の browser fixture。Clerk / Jodit / Cloudinary は adapter に差し替える。
// 共通処理（bundle・配信・終了処理）は ../shared/fixture-server.mjs に集約している。
import { startFixtureServer } from "../shared/fixture-server.mjs";

await startFixtureServer({
    name: "seven",
    entry: "tests/fixtures/seven/preview.tsx",
    port: 3121,
    title: "Seven-screen design fixture",
    mocks: {
        "jodit-react": `import React from 'react'; export default function Editor({value,onBlur}){return React.createElement('textarea',{'aria-label':'Rich text description',defaultValue:value,onBlur(e){onBlur?.(e.target.value)}})}`,
        "next-cloudinary": `export function CldUploadWidget({children,onSuccess}){return children({open(){onSuccess({info:{secure_url:'/assets/images/default-user.jpg'}})}})}`,
        "@clerk/nextjs": `import React from 'react'; export function UserButton(){return React.createElement('button',{'aria-label':'User account'},'Account')} export function UserProfile(){return React.createElement('section',{'aria-label':'Clerk fixture'},'Clerk UserProfile adapter (real SDK verification pending)')} export function useUser(){return {user:{firstName:'Test',lastName:'Seller',fullName:'Test Seller',primaryEmailAddress:{emailAddress:'test@example.com'},imageUrl:'/assets/logo.png'},isLoaded:true,isSignedIn:!location.search.includes("guest")}}`,
        "next-themes": `export function useTheme(){return {setTheme(value){document.documentElement.classList.toggle('dark',value==='dark')}}}`,
        "@/queries/user": `export async function addToWishlist(){return true}`,
        "next/navigation": `const router={replace(url){history.replaceState(null,"",url)},push(url){location.assign(url)},refresh(){}}; export function useRouter(){return router}`,
    },
    loader: { ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
});
