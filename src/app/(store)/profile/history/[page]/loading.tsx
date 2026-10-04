import { DiscoveryHeading } from "@/components/store/profile/shared/discovery";
import styles from "@/components/store/profile/shared/discovery.module.css";
export default function HistoryLoading() {
    return <div className={styles.page}><DiscoveryHeading title="Your product view history" description="Rediscover the pieces that caught your eye." /><p role="status" className={styles.loading}>Loading recently viewed pieces…</p></div>;
}
