import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Experience from "@/components/store/home/luxury/experience";
import { getBrandCategories } from "@/components/store/home/luxury/data";
import Selection from "@/components/store/home/luxury/selection";
import styles from "@/components/store/home/luxury/luxury.module.css";

export const dynamic = "force-dynamic";

async function BrandExperience() {
    return <Experience categories={await getBrandCategories()} />;
}

export default function HomePage() {
    return (
        <main data-testid="app-main" className={styles.home}>
            <Suspense fallback={<Experience categories={[]} />}>
                <BrandExperience />
            </Suspense>
            <section
                id="collections"
                className={styles.collections}
                aria-labelledby="selection-title"
            >
                <div className={styles.collectionHeading}>
                    <div>
                        <p className={styles.eyebrow}>
                            THE EXTRAORDINARY, EVERY DAY
                        </p>
                        <h2 id="selection-title">
                            Objects of <em>desire.</em>
                        </h2>
                        <p lang="ja">あなたの日常に、心ときめくひとつを。</p>
                    </div>
                    <Link href="/browse">
                        Discover all pieces <ArrowUpRight size={16} />
                    </Link>
                </div>
                <Suspense
                    fallback={
                        <output className={styles.empty}>
                            Discovering the collection… /
                            コレクションを読み込んでいます
                        </output>
                    }
                >
                    <Selection />
                </Suspense>
            </section>
            <div className={styles.closing}>
                <span aria-hidden="true">✦</span>
                <p>
                    A little luxury. A lot of happiness.{" "}
                    <small lang="ja">贅沢は、幸せのきっかけ。</small>
                </p>
                <span aria-hidden="true">✦</span>
            </div>
        </main>
    );
}
