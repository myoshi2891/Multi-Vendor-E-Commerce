"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { DiscoveryPagination } from "../shared/discovery";
import styles from "../shared/discovery.module.css";

export interface FollowedStore {
    id: string; url: string; name: string; logo: string; followersCount: number; isUserFollowingStore: boolean;
}
export type FollowAction = (storeId: string) => Promise<boolean>;

function FollowingCard({ store, followAction }: { store: FollowedStore; followAction?: FollowAction }) {
    const [following, setFollowing] = useState(store.isUserFollowingStore);
    const [count, setCount] = useState(store.followersCount);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(false);
    const [notice, setNotice] = useState("");
    const lock = useRef(false);
    const update = async () => {
        if (lock.current || !followAction) return;
        lock.current = true; setPending(true); setError(false); setNotice("");
        try {
            const next = await followAction(store.id);
            setCount(value => Math.max(0, value + (next === following ? 0 : next ? 1 : -1)));
            setFollowing(next);
            setNotice(next ? `You are now following ${store.name}.` : `You unfollowed ${store.name}.`);
        } catch { setError(true); }
        finally { lock.current = false; setPending(false); }
    };
    return <article className={styles.card} aria-label={store.name}>
        <div className={styles.identity}>
            <Image src={!store.logo || store.logo.includes("/no_image") ? "/assets/brand/star.svg" : store.logo} alt="" width={56} height={56} />
            <div><h2><Link href={`/store/${store.url}`}>{store.name}</Link></h2><p>{count} followers</p></div>
        </div>
        <div className={styles.actions}>
            <button type="button" aria-pressed={following} aria-busy={pending} disabled={pending || !followAction} onClick={update}>{following ? "Following" : "Follow"}</button>
            <Link href={`/store/${store.url}`}>Visit boutique ↗</Link>
        </div>
        {error && <p role="alert" className={styles.feedback}>Could not update this store. Please try again.</p>}
        <p role="status" className={styles.feedback}>{pending ? "Updating store…" : notice}</p>
    </article>;
}

export default function FollowingContainer({ stores, page, totalPages, followAction }: {
    stores: FollowedStore[]; page: number; totalPages: number; followAction?: FollowAction;
}) {
    return <div className={styles.page}>
        {stores.length ? <div className={styles.stores}>{stores.map(store => <FollowingCard key={store.id} store={store} followAction={followAction} />)}</div> :
            <section className={styles.empty} aria-labelledby="following-empty-title"><h2 id="following-empty-title">No followed stores yet.</h2><p>Discover a boutique you would like to return to.</p><Link href="/browse">Explore the collection</Link></section>}
        <DiscoveryPagination page={page} totalPages={totalPages} base="/profile/following" label="Followed stores pagination" />
    </div>;
}
