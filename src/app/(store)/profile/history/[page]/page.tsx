import { normalizePageParam } from "@/lib/utils";
import { getProductsByIds } from "@/queries/product";
import HistoryContainer from "@/components/store/profile/history/container";
import { DiscoveryHeading } from "@/components/store/profile/shared/discovery";
import styles from "@/components/store/profile/shared/discovery.module.css";

export default async function ProfileHistoryPage({ params }: { params: Promise<{ page: string }> }) {
    const { page } = await params;
    return <div className={styles.page}>
        <DiscoveryHeading title="Your product view history" description="Rediscover the pieces that caught your eye." />
        <HistoryContainer page={normalizePageParam(page)} fetchHistoryAction={getProductsByIds} />
    </div>;
}
