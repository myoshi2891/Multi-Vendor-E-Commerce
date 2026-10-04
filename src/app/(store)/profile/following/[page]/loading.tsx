import { DiscoveryHeading } from "@/components/store/profile/shared/discovery";
import styles from "@/components/store/profile/shared/discovery.module.css";
export default function FollowingLoading() {
    return <div className={styles.page}><DiscoveryHeading title="Stores you follow" description="Return to your favourite boutiques." /><p role="status" className={styles.loading}>Loading followed stores…</p></div>;
}
