import { startFixtureServer } from "../shared/fixture-server.mjs";
await startFixtureServer({
    name: "p3",
    entry: "tests/fixtures/p3/preview.tsx",
    port: 3124,
    title: "P3 design fixture",
    mocks: {
        "@clerk/nextjs/server": `export async function currentUser(){return {id:'admin-test',privateMetadata:{role:'ADMIN'},firstName:'Test',lastName:'Administrator',imageUrl:'',emailAddresses:[{emailAddress:'long.administrator.email@example.test'}]}}`,
        "@clerk/nextjs": `import React from 'react'; export function UserButton(){return React.createElement('button',{'aria-label':'User account'},'Account')}`,

        "@/lib/auth-guards": `export async function requireStoreOwner(storeUrl){return {store:{id:'store-1',url:storeUrl}}}`,
        "@/queries/category": `import {categories,save,loadCategory} from './tests/fixtures/p3/data';export async function getAllCategories(){if(location.search.includes('fetcherror'))throw Error('fixture');return location.search.includes('empty')?[]:categories}export const getCategory=loadCategory,upsertCategory=save,deleteCategory=save;`,
        "next-cloudinary": `import React from 'react';export function CldUploadWidget({children,onSuccess}){return children({open(){onSuccess({info:{secure_url:'https://example.test/image.png'}})}})}`,
        "@/queries/coupon": `import {coupons,save,loadCoupon} from './tests/fixtures/p3/data'; export async function getStoreCoupons(){if(location.search.includes('fetcherror'))throw Error('fixture');return location.search.includes('empty')?[]:coupons} export async function getAllCoupons(){if(location.search.includes('fetcherror'))throw Error('fixture');return location.search.includes('empty')?[]:coupons.map(c=>({...c,store:{name:'A very long store name for responsive table'}}))}export const getCouponAsAdmin=loadCoupon,upsertCouponAsAdmin=save,deleteCouponAsAdmin=save,toggleCouponActive=save;export const getCoupon=loadCoupon,upsertCoupon=save,deleteCoupon=save;`,
        "@/queries/store": `import {stores,save} from './tests/fixtures/p3/data';export async function getAllStores(){if(location.search.includes('fetcherror'))throw Error('fixture');return location.search.includes('empty')?[]:stores} export const updateStoreStatus=save,deleteStore=save;`,
        "@/queries/order": `import {orders,save} from './tests/fixtures/p3/data';export async function getAllOrders(){if(location.search.includes('fetcherror'))throw Error('fixture');return {orders:location.search.includes('empty')?[]:orders,total:1,page:1,limit:50}}export const updateOrderGroupStatusAsAdmin=save,updateOrderItemStatusAsAdmin=save;`,
        "@/queries/dashboard": `export async function getAdminDashboardStats(){if(location.search.includes('fetcherror'))throw Error('fixture');return {totalRevenue:12.5,totalOrders:3,activeStores:1,pendingStores:2,totalUsers:5,totalProducts:10,totalCategories:2,totalSubCategories:0}} export async function getSalesOverTime(){return location.search.includes('empty')?[]:[{label:'Sep',revenue:12.5},{label:'Oct',revenue:24}]} export async function getRecentOrders(){return []} export async function getRecentStores(){return location.search.includes('empty')?[]:[{id:'s1',name:'A very long store name '.repeat(8),status:'PENDING',createdAt:new Date('2026-10-01')}]}`,
        "next/navigation": `export function useRouter(){return {refresh(){window.refreshed=true},push(url){window.destination=url}}} export function usePathname(){return '/dashboard/admin'} export function useParams(){return {storeUrl:'example'}}`,
        "next-themes": `export function useTheme(){return {setTheme(value){document.documentElement.classList.toggle('dark',value==='dark')}}}`,
    },
    loader: { ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
});
