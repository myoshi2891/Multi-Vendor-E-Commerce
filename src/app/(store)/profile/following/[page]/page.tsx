import FollowingContainer from "@/components/store/profile/following/container";
import { getUserFollowedStores } from "@/queries/profile";

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
    const raw = Number(pageParam);
    const page = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
    const res = await getUserFollowedStores(page)
    return <div className="bg-white px-6 py-4">
        <h1 className="mb-3 text-lg font-bold">Stores you follow</h1>
        <FollowingContainer stores={res.stores} page={page} totalPages={res.totalPages} />
    </div>;
}
