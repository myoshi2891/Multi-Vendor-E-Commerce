import FollowingContainer from "@/components/store/profile/following/container";
import { DiscoveryHeading } from "@/components/store/profile/shared/discovery";
import styles from "@/components/store/profile/shared/discovery.module.css";
import { normalizePageParam } from "@/lib/utils";
import { getUserFollowedStores } from "@/queries/profile";
import { followStore } from "@/queries/user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function ProfileFollowingPage({ params }: { params: Promise<{ page: string }> }) {
    const { page: pageParam } = await params;
    const page = normalizePageParam(pageParam);
    let res;
    try { res = await getUserFollowedStores(page); }
    catch {
        return <div className={styles.page}><DiscoveryHeading title="Stores you follow" description="Return to your favourite boutiques." />
            <section role="alert" className={styles.error}><h2>Followed stores could not be loaded.</h2><p>Please try again.</p><a href={`/profile/following/${page}`}>Try again</a></section>
        </div>;
    }
    const canonicalPage = res.totalPages >= 1 ? Math.min(page, res.totalPages) : 1;
    if (canonicalPage !== page) redirect(`/profile/following/${canonicalPage}`);
    return <div className={styles.page}><DiscoveryHeading title="Stores you follow" description="Return to your favourite boutiques." />
        <FollowingContainer stores={res.stores} page={page} totalPages={res.totalPages} followAction={followStore} />
    </div>;
}
