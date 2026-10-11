// Checkout / 注文詳細の browser fixture。Stripe / PayPal SDK は adapter に差し替える。
// 共通処理（bundle・配信・終了処理）は ../shared/fixture-server.mjs に集約している。
import { startFixtureServer } from "../shared/fixture-server.mjs";

await startFixtureServer({
    name: "commerce",
    entry: "tests/fixtures/commerce/preview.tsx",
    port: 3107,
    title: "Commerce browser fixture",
    mocks: {
        // Exercise invoice failure/retry without generating downloads or opening print windows.
        "./pdf-invoice": `export async function generateOrderPDFBlob(){await new Promise(resolve=>setTimeout(resolve,500));throw new Error("fixture invoice failure")}`,
        "@clerk/nextjs": `import React from "react"; export function SignOutButton({children}){return children} export function UserButton(){return React.createElement("button",null,"Manage account")}`,
        "next/navigation": `export function useSearchParams(){return new URLSearchParams(location.search)} export function usePathname(){return location.pathname} export function useRouter(){return {push(){},replace(){},refresh(){}}}`,
        "@stripe/stripe-js": `export function loadStripe(){return Promise.resolve(null)}`,
        "@stripe/react-stripe-js": `import React from 'react'; export function Elements({children}){return children} export function useStripe(){return {}} export function useElements(){return {}} export function PaymentElement(){return React.createElement('div',null,'Card provider fixture')}`,
        "@paypal/react-paypal-js": `import React from 'react'; export const DISPATCH_ACTION={RESET_OPTIONS:'resetOptions'}; export function PayPalScriptProvider({children}){return children} export function usePayPalScriptReducer(){return [{isPending:false,isRejected:false,options:{}},()=>{}]} export function PayPalButtons({disabled,onError}){return React.createElement('button',{disabled,onClick:()=>onError(new Error('fixture provider failure'))},'PayPal fixture')}`,
    },
    define: {
        "process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY": '"pk_test_fixture"',
    },
});
