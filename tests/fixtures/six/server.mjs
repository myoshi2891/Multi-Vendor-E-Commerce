import { startFixtureServer } from "../shared/fixture-server.mjs";

await startFixtureServer({
    name: "six",
    entry: "tests/fixtures/six/preview.tsx",
    port: 3123,
    title: "Seller six-screen design fixture",
    mocks: {
        "@/lib/db": `import {countries,store} from './tests/fixtures/six/data'; export const db={country:{findMany:async()=>countries},store:{findUnique:async()=>store}}`,
        "@/lib/category-tree": `export {flattenCategoryTree} from './src/lib/category-path'`,
        "@/queries/category": `import {categories} from './tests/fixtures/six/data'; export async function getAllCategories(){return categories}`,
        "@/queries/offer-tag": `export async function getAllOfferTags(){return []}`,
        "@/queries/attribute": `export async function getEffectiveAttributeDefinitions(){return []}`,
        "@/queries/product": `import {product,save} from './tests/fixtures/six/data'; export const upsertProduct=save; export async function getProductMainInfo(){return {...product,variantId:undefined}} export async function getProductVariantForEdit(){return product}`,
        "@/queries/store": `import {shipping,rates,save} from './tests/fixtures/six/data'; export const upsertStore=save,updateStoreDefaultShippingDetails=save,upsertShippingRate=save; export async function getStoreDefaultShippingDetails(){return shipping} export async function getStoreShippingRates(){return location.search.includes('empty')?[]:rates}`,
        "next/navigation": `const router={push(url){window.destination=url},refresh(){window.refreshed=true}}; export function useRouter(){return router} export function useParams(){return {storeUrl:'example'}} export function redirect(url){throw Error(url)} export function notFound(){throw Error('not found')}`,
        "next-themes": `export function useTheme(){return {theme:document.documentElement.classList.contains('dark')?'dark':'light',setTheme(value){document.documentElement.classList.toggle('dark',value==='dark')}}}`,
        "jodit-react": `import React from 'react'; export default function Editor({value,onChange,onBlur}){return React.createElement('textarea',{'aria-label':'Rich text description',defaultValue:value,onChange(e){onChange?.(e.target.value)},onBlur(e){onBlur?.(e.target.value)}})}`,
        "next-cloudinary": `export function CldUploadWidget({children,onSuccess}){return children({open(){onSuccess({info:{secure_url:'http://127.0.0.1:3123/assets/images/default-user.jpg'}})}})}`,
    },
    loader: { ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
});
