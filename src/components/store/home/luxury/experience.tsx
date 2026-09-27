"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
    Component,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type ReactNode,
} from "react";
import { motion, useScroll } from "framer-motion";
import { ArrowDown, ArrowUpRight, Pause, Play } from "lucide-react";
import type { CollectionLink } from "./types";
import styles from "./luxury.module.css";

function subscribeMotion(callback: () => void) {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    query.addEventListener("change", callback);
    return () => query.removeEventListener("change", callback);
}
const Scene = dynamic(() => import("./scene"), { ssr: false });
class SceneBoundary extends Component<
    { children: ReactNode },
    { failed: boolean }
> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    render() {
        return this.state.failed ? null : this.props.children;
    }
}

/** One decorative canvas follows three HTML chapters; commerce never waits for WebGL. */
export default function Experience({
    categories,
}: {
    categories: CollectionLink[];
}) {
    const root = useRef<HTMLDivElement>(null);
    const reduced = useSyncExternalStore(
        subscribeMotion,
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
        () => true
    );
    const [paused, setPaused] = useState(false);
    const [visible, setVisible] = useState(false);
    const [webgl, setWebgl] = useState(false);
    const [compact, setCompact] = useState(false);
    const { scrollYProgress } = useScroll({
        target: root,
        offset: ["start start", "end end"],
    });
    useEffect(() => {
        const media = matchMedia("(max-width: 767px)");
        const resize = () => setCompact(media.matches);
        media.addEventListener("change", resize);
        const frame = requestAnimationFrame(() => {
            resize();
            try {
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("webgl2");
                setWebgl(Boolean(context));
                context?.getExtension("WEBGL_lose_context")?.loseContext();
            } catch {
                setWebgl(false);
            }
        });
        let intersecting = false;
        const update = () => setVisible(intersecting && !document.hidden);
        const observer = new IntersectionObserver(([entry]) => {
            intersecting = entry.isIntersecting;
            update();
        });
        if (root.current) observer.observe(root.current);
        document.addEventListener("visibilitychange", update);
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            document.removeEventListener("visibilitychange", update);
            media.removeEventListener("change", resize);
        };
    }, []);
    const animate = reduced === false && !paused;
    return (
        <div
            ref={root}
            className={styles.experience}
            data-testid="luxury-experience"
        >
            <div className={styles.stage}>
                <div className={styles.artwork} aria-hidden="true">
                    <div className={styles.halo} />
                    <Image
                        src="/assets/brand/gem.svg"
                        alt=""
                        fill
                        priority
                        sizes="(max-width: 767px) 100vw, 65vw"
                        className={styles.gemFallback}
                    />
                    {webgl && animate && (
                        <SceneBoundary>
                            <Scene
                                progress={scrollYProgress}
                                active={visible}
                                compact={compact}
                            />
                        </SceneBoundary>
                    )}
                    <span className={styles.orbitLabel}>
                        THE ART OF FEELING EXTRAORDINARY
                    </span>
                </div>
                <div className={styles.motionControl}>
                    <button
                        type="button"
                        onClick={() => setPaused(!paused)}
                        aria-pressed={paused}
                        disabled={Boolean(reduced)}
                        aria-label={
                            paused
                                ? "Resume animation / 演出を再開"
                                : "Pause animation / 演出を停止"
                        }
                    >
                        {paused || reduced ? (
                            <Play size={12} />
                        ) : (
                            <Pause size={12} />
                        )}{" "}
                        {reduced
                            ? "STILL EXPERIENCE"
                            : paused
                              ? "RESUME MOTION"
                              : "PAUSE MOTION"}
                    </button>
                </div>
            </div>
            <div className={styles.chapters}>
                <section
                    className={`${styles.chapter} ${styles.hero}`}
                    aria-labelledby="luxury-title"
                >
                    <div className={styles.topline}>
                        <span>AN INVITATION TO THE EXTRAORDINARY</span>
                        <span>EST. FOR YOUR HAPPINESS</span>
                    </div>
                    <motion.div
                        className={styles.heroCopy}
                        initial={false}
                        animate={{ y: animate ? [8, 0] : 0 }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                    >
                        <p className={styles.eyebrow}>
                            <span className={styles.smallStar}>✦</span> LUXURY.
                            FORTUNE. HAPPINESS.
                        </p>
                        <h1 id="luxury-title">
                            Luxuries <span className={styles.italic}>for</span>
                            <br />
                            <span className={styles.gold}>Happiness.</span>
                        </h1>
                        <p className={styles.japanese} lang="ja">
                            幸せを纏う、という贅沢。
                        </p>
                        <p className={styles.description}>
                            Exceptional things. Serendipitous encounters.
                            <br />A world made a little more extraordinary.
                        </p>
                        <Link href="#collections" className={styles.cta}>
                            Explore the collection <ArrowUpRight size={18} />
                        </Link>
                    </motion.div>
                    <div className={styles.heroBottom}>
                        <a href="#fortune">
                            <ArrowDown size={15} /> SCROLL TO DISCOVER
                        </a>
                        <span>01 — THE LUXURY OF POSSIBILITY</span>
                    </div>
                </section>
                <section
                    id="fortune"
                    className={`${styles.chapter} ${styles.fortune}`}
                    aria-labelledby="fortune-title"
                >
                    <div className={styles.chapterCopy}>
                        <p className={styles.eyebrow}>02 / FORTUNE</p>
                        <h2 id="fortune-title">
                            A little fortune.
                            <br />
                            <em>An extraordinary</em>
                            <br />
                            feeling.
                        </h2>
                        <p className={styles.japanese} lang="ja">
                            幸運を、日常のそばに。
                        </p>
                        <p className={styles.description}>
                            Some things are found.
                            <br />
                            Others feel like they were meant for you.
                        </p>
                        <div className={styles.categoryLinks}>
                            {categories.map((category, index) => (
                                <Link
                                    key={category.id}
                                    href={`/browse?category=${encodeURIComponent(category.url)}`}
                                >
                                    <span>0{index + 1}</span>
                                    {category.name}
                                    <ArrowUpRight size={18} />
                                </Link>
                            ))}
                            {!categories.length && (
                                <Link href="/browse">
                                    Discover the collections{" "}
                                    <ArrowUpRight size={18} />
                                </Link>
                            )}
                        </div>
                    </div>
                </section>
                <section
                    className={`${styles.chapter} ${styles.happiness}`}
                    aria-labelledby="happiness-title"
                >
                    <div className={styles.chapterCopy}>
                        <p className={styles.eyebrow}>03 / HAPPINESS</p>
                        <h2 id="happiness-title">
                            Make room
                            <br />
                            for <em>happiness.</em>
                        </h2>
                        <p className={styles.japanese} lang="ja">
                            心が満ちる、そのひとつを。
                        </p>
                        <p className={styles.description}>
                            For the moments you keep.
                            <br />
                            For the person you are becoming.
                        </p>
                        <Link className={styles.textLink} href="#collections">
                            Find your extraordinary <ArrowDown size={17} />
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    );
}
