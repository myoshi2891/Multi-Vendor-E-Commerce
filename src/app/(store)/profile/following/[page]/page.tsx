import FollowingContainer from "@/components/store/profile/following/container";
import { getUserFollowedStores } from "@/queries/profile";

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
