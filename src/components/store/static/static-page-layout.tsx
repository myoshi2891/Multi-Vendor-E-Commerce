import { cn } from "@/lib/utils";

export interface StaticSection {
    /** セクション見出し（目次にも使用）。一意であること */
    heading: string;
    /** 本文。改行は段落として描画する（plain text 前提・HTML 注入しない） */
    body: string;
    /** 任意のアンカー id。見出し文言を変えても既存のフラグメント URL を維持したい場合に指定 */
    id?: string;
}

interface StaticPageLayoutProps {
    title: string;
    /** タイトル直下のリード文（任意） */
    lead?: string;
    sections: StaticSection[];
    /** true で左に目次（アンカー）を表示。長文の legal 等で使用 */
    withToc?: boolean;
    className?: string;
}

/**
 * 静的コンテンツページの共通レイアウト。
 * sections を段落＋見出しで描画する。withToc=true なら heading から
 * アンカー目次を生成する。DB 非依存・全クライアント入力なし（XSS リスクなし）。
 */
export default function StaticPageLayout({
    title,
    lead,
    sections,
    withToc = false,
    className,
}: Readonly<StaticPageLayoutProps>) {
    return (
        <main className={cn("mx-auto max-w-4xl px-4 py-10", className)}>
            <h1 className="mb-4 text-3xl font-bold">{title}</h1>
            {lead ? <p className="mb-8 text-muted-foreground">{lead}</p> : null}
            {withToc ? (
                <nav className="mb-8 rounded-lg border p-4">
                    <ul className="space-y-1 text-sm">
                        {sections.map((s) => (
                            <li key={s.heading}>
                                <a
                                    href={`#${sectionAnchorId(s)}`}
                                    className="hover:underline"
                                >
                                    {s.heading}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
            ) : null}
            <div className="space-y-10">
                {sections.map((s) => (
                    <section key={s.heading} id={sectionAnchorId(s)}>
                        <h2 className="mb-3 text-xl font-semibold">
                            {s.heading}
                        </h2>
                        {s.body.split("\n\n").map((para, index) => (
                            <p
                                key={`${s.heading}-${index}`}
                                className="mb-3 leading-relaxed text-main-secondary"
                            >
                                {para}
                            </p>
                        ))}
                    </section>
                ))}
            </div>
        </main>
    );
}

/** セクションのアンカー id。明示 id を優先し、無ければ見出しから導出する */
export function sectionAnchorId(section: StaticSection): string {
    return section.id ?? slugify(section.heading);
}

/** 見出しを安定したアンカー id に変換（英数小文字 + ハイフン） */
function slugify(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
}
