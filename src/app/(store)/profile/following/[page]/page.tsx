import FollowingContainer from "@/components/store/profile/following/container";
import { normalizePageParam } from "@/lib/utils";
import { getUserFollowedStores } from "@/queries/profile";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

/**
 * Renders the "Stores you follow" profile page for a given page number.
 *
 * @param params - A promise that resolves to route params; expects a `page` string representing the requested page number.
 * @returns A React element displaying the followed stores for the requested page, including pagination state.
 */
export default async function ProfileFollowingPage({
    params,
}: {
    params: Promise<{ page: string }>;
    }) {
    const { page: pageParam } = await params;
    const page = normalizePageParam(pageParam);
    const res = await getUserFollowedStores(page)

    // 範囲外ページは最終ページ（該当 0 件なら 1 ページ目）へ寄せる。
    // 遷移後は canonicalPage === page になるためループしない。
    // redirect() は NEXT_REDIRECT を throw するため try/catch の外に置くこと。
    const canonicalPage = res.totalPages >= 1 ? Math.min(page, res.totalPages) : 1;
    if (canonicalPage !== page) {
        redirect(`/profile/following/${canonicalPage}`);
    }

    return <div className="bg-white px-6 py-4">
        <h1 className="mb-3 text-lg font-bold">Stores you follow</h1>
        <FollowingContainer stores={res.stores} page={page} totalPages={res.totalPages} />
    </div>;
}
