import { CATEGORIES, DOMAINS, type CategoryId, type DomainId } from "./categorize";
import type { CellStatus, Matrix } from "./build-matrix";

export interface RenderOptions {
    generatedAt: Date;
    projectName?: string;
    testRunners?: string[];
}

const STATUS_SYMBOL: Record<CellStatus, string> = {
    full: "✦",
    partial: "◐",
    missing: "◯",
};

const STATUS_LABEL: Record<CellStatus, string> = {
    full: "Implemented",
    partial: "Partial",
    missing: "Not implemented",
};

/**
 * Escape special characters in a value to their corresponding HTML entities.
 *
 * Converts the input to a string and replaces &, <, >, ", and ' with their
 * HTML-safe equivalents so the result can be embedded into HTML.
 *
 * @param value - The value to escape; it will be converted to a string
 * @returns The escaped string with HTML entities for `&`, `<`, `>`, `"`, and `'`
 */
function escapeHtml(value: unknown): string {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Serialize a value to JSON and escape `<` characters to avoid injection of `</script>`-style sequences.
 *
 * @param value - The value to serialize
 * @returns A JSON string representation of `value` with every `<` replaced by `\u003c`
 */
function escapeJson(value: unknown): string {
    // JSON 内に </script> が混入することを避ける
    return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * Format a Date as a UTC timestamp string for display.
 *
 * @returns A string like `YYYY.MM.DD · HH:MM UTC` using the date's UTC components (zero-padded).
 */
function formatDate(d: Date): string {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const min = String(d.getUTCMinutes()).padStart(2, "0");
    return `${yyyy}.${mm}.${dd} · ${hh}:${min} UTC`;
}

/**
 * Produce a report tagline in the form "FIELD REPORT / YYYY.MM" based on the provided date.
 *
 * @param d - The date used to extract the year and month in UTC
 * @returns The tagline string `FIELD REPORT / YYYY.MM` where `YYYY` and `MM` are the UTC year and zero-padded month from `d`
 */
function tagline(d: Date): string {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `FIELD REPORT / ${yyyy}.${mm}`;
}

interface NextAction {
    priority: "high" | "medium" | "low";
    title: string;
    target: string;
    tool: string;
    cost: "S" | "M" | "L";
    impact: string;
}

const NEXT_ACTIONS: readonly NextAction[] = [
    // A1 / A2 / A3 / B1 (MVP) は 2026-05-21〜23 に完了済み。履歴は
    // docs/testing/COVERAGE_REPORT.md §7 と QA_HANDOFF.md を参照。
    // A4 取りこぼし (getStoreOrders → requireStoreOwner) は 2026-05-26 に
    // クローズ済み (commit 70f5b94)。
    // NA-NS-01 (B1+ shadcn/ui プリミティブ Snapshot 拡張) は 2026-05-28 に完了
    // (Sprint 1〜4、49 プリミティブ全カバー)。詳細は COVERAGE_REPORT.md §7 を参照。
    {
        priority: "medium",
        title: "Stripe / PayPal Webhook の Contract テスト",
        target: "src/app/api/webhooks/route.test.ts (拡充)",
        tool: "Jest + MSW (already configured)",
        cost: "M",
        impact: "外部決済プロバイダのスキーマ変動に耐性を持たせる",
    },
    {
        priority: "medium",
        title: "Cart → Checkout の Integration テスト",
        target: "tests/integration/cart-checkout.test.ts",
        tool: "Jest + jsdom + Zustand store hydration",
        cost: "M",
        impact: "決済前の状態遷移を E2E より高速に保証",
    },
    {
        priority: "low",
        title: "Lighthouse CI でパフォーマンス予算化",
        target: ".github/workflows/lhci.yml",
        tool: "@lhci/cli + GitHub Actions",
        cost: "M",
        impact: "LCP / CLS / TBT の退行を PR で検知",
    },
    {
        priority: "low",
        title: "Bundle Size の継続監視",
        target: ".github/workflows/bundle.yml",
        tool: "@next/bundle-analyzer + size-limit",
        cost: "S",
        impact: "依存追加による初期ロードの膨張を抑制",
    },
];

/**
 * Renders the prioritized "next actions" UI as an HTML fragment.
 *
 * Produces three priority sections (Immediate, Next Sprint, Mid–Long Term), each containing
 * an ordered list of actions with title, cost, and a details list for target, tool, and impact.
 * All dynamic values are HTML-escaped for safe insertion.
 *
 * @returns An HTML string representing the grouped next-action sections and their action items
 */
function renderActions(): string {
    const groups: Record<NextAction["priority"], { label: string; mark: string; tone: string }> = {
        high: { label: "Immediate", mark: "01", tone: "high" },
        medium: { label: "Next Sprint", mark: "02", tone: "medium" },
        low: { label: "Mid–Long Term", mark: "03", tone: "low" },
    };

    return (Object.keys(groups) as NextAction["priority"][])
        .map((p) => {
            const meta = groups[p];
            const items = NEXT_ACTIONS.filter((a) => a.priority === p)
                .map(
                    (a) => `
        <li class="action action--${escapeHtml(p)}">
          <header>
            <span class="action__title">${escapeHtml(a.title)}</span>
            <span class="action__cost" title="導入コスト">${escapeHtml(a.cost)}</span>
          </header>
          <dl class="action__body">
            <div><dt>Target</dt><dd><code>${escapeHtml(a.target)}</code></dd></div>
            <div><dt>Tool</dt><dd>${escapeHtml(a.tool)}</dd></div>
            <div><dt>Impact</dt><dd>${escapeHtml(a.impact)}</dd></div>
          </dl>
        </li>`
                )
                .join("");

            return `
      <section class="prio prio--${escapeHtml(meta.tone)}" aria-labelledby="prio-${escapeHtml(p)}">
        <header class="prio__head">
          <span class="prio__mark">${escapeHtml(meta.mark)}</span>
          <h3 id="prio-${escapeHtml(p)}" class="prio__title">${escapeHtml(meta.label)}</h3>
        </header>
        <ol class="actions">${items}</ol>
      </section>`;
        })
        .join("");
}

/**
 * Render HTML filter chip groups for categories and domains based on the coverage matrix.
 *
 * @param matrix - Coverage matrix used to populate chip labels and counts
 * @returns An HTML string containing two filter groups ("Categories" and "Domains"), each with chips showing the item label and count and carrying `data-filter="category|domain"` and `data-value` attributes for client-side filtering
 */
function renderFilters(matrix: Matrix): string {
    const cats = CATEGORIES.map(
        (c) => `
      <button type="button" class="chip" data-filter="category" data-value="${escapeHtml(c.id)}" aria-pressed="true">
        <span class="chip__label">${escapeHtml(c.label)}</span>
        <span class="chip__count">${matrix.summary.byCategory[c.id]}</span>
      </button>`
    ).join("");

    const doms = DOMAINS.map(
        (d) => `
      <button type="button" class="chip" data-filter="domain" data-value="${escapeHtml(d.id)}" aria-pressed="true">
        <span class="chip__label">${escapeHtml(d.label)}</span>
        <span class="chip__count">${matrix.summary.byDomain[d.id]}</span>
      </button>`
    ).join("");

    return `
    <section class="filters" aria-label="絞り込みフィルター">
      <div class="filters__group">
        <h3 class="filters__title">Categories</h3>
        <div class="filters__chips" role="group">${cats}</div>
      </div>
      <div class="filters__group">
        <h3 class="filters__title">Domains</h3>
        <div class="filters__chips" role="group">${doms}</div>
      </div>
    </section>`;
}

/**
 * Render the coverage matrix into an HTML table.
 *
 * Produces a table with domain columns and category rows; each cell is annotated with status, file count, and a tooltip listing files and metadata.
 *
 * @param matrix - The coverage matrix containing summary counts and per-category/per-domain cell data to render
 * @returns An HTML string containing a <table> element that represents the coverage matrix, with domain headers, category rows, and status-annotated cells (including file counts and tooltips)
 */
function renderMatrix(matrix: Matrix): string {
    const head = `
    <thead>
      <tr>
        <th scope="col" class="cell cell--corner"><span>cat ╱ dom</span></th>
        ${DOMAINS.map(
            (d) => `
        <th scope="col" class="cell cell--colhead" data-domain="${escapeHtml(d.id)}">
          <span class="colhead__num">${matrix.summary.byDomain[d.id]}</span>
          <span class="colhead__label">${escapeHtml(d.shortLabel)}</span>
          <span class="colhead__full">${escapeHtml(d.label)}</span>
        </th>`
        ).join("")}
      </tr>
    </thead>`;

    const body = `
    <tbody>
      ${CATEGORIES.map(
          (cat) => `
        <tr data-category="${escapeHtml(cat.id)}">
          <th scope="row" class="cell cell--rowhead">
            <span class="rowhead__label">${escapeHtml(cat.label)}</span>
            <span class="rowhead__num">${matrix.summary.byCategory[cat.id]}</span>
          </th>
          ${DOMAINS.map((dom) => {
              const cell = matrix.cell(cat.id, dom.id);
              const files = cell.files
                  .map(
                      (f) =>
                          `<li><code>${escapeHtml(f.path)}</code> <span class="file__count">${f.testCount} cases${f.hasSkip ? " · <em>skip</em>" : ""}${f.linePct !== null ? ` · ${f.linePct}%` : ""}</span></li>`
                  )
                  .join("");
              const tooltipContent = `
                <strong>${escapeHtml(cat.label)} × ${escapeHtml(dom.label)}</strong>
                <span class="tooltip__status tooltip__status--${escapeHtml(cell.status)}">${escapeHtml(STATUS_LABEL[cell.status])} · ${cell.files.length} file(s)</span>
                ${cell.files.length > 0 ? `<ul class="tooltip__files">${files}</ul>` : '<span class="tooltip__empty">no tests yet</span>'}
              `;
              return `
          <td
            class="cell cell--data cell--${escapeHtml(cell.status)}"
            data-category="${escapeHtml(cat.id)}"
            data-domain="${escapeHtml(dom.id)}"
            data-status="${escapeHtml(cell.status)}"
            tabindex="0"
            aria-label="${escapeHtml(cat.label)} × ${escapeHtml(dom.label)}: ${escapeHtml(STATUS_LABEL[cell.status])}, ${cell.files.length} file(s)"
          >
            <span class="cell__symbol" aria-hidden="true">${STATUS_SYMBOL[cell.status]}</span>
            <span class="cell__count">${cell.files.length || ""}</span>
            <div class="cell__tooltip" role="tooltip" data-tooltip>${tooltipContent}</div>
          </td>`;
          }).join("")}
        </tr>`
      ).join("")}
    </tbody>`;

    return `<table class="matrix" aria-label="テストカバレッジマトリクス">${head}${body}</table>`;
}

/**
 * Render the HTML legend section that lists each status's symbol and label.
 *
 * @returns An HTML string containing the status legend fragment
 */
function renderLegend(): string {
    const items = (Object.keys(STATUS_SYMBOL) as CellStatus[])
        .map(
            (s) => `
      <li class="legend__item legend__item--${escapeHtml(s)}">
        <span class="legend__symbol" aria-hidden="true">${STATUS_SYMBOL[s]}</span>
        <span class="legend__label">${escapeHtml(STATUS_LABEL[s])}</span>
      </li>`
        )
        .join("");
    return `
    <aside class="legend" aria-label="Legend">
      <h3 class="legend__title">Status</h3>
      <ul class="legend__list">${items}</ul>
      <p class="legend__note">
        <strong>partial</strong> = <code>.skip</code> を含む / lcov line% &lt; 60%
      </p>
    </aside>`;
}

/**
 * Produce a standalone HTML document that visualizes the provided coverage matrix as a dashboard.
 *
 * @param matrix - The coverage matrix containing summary statistics and per-cell details to render.
 * @param options - Rendering options (must include `generatedAt`; may include `projectName` and `testRunners`).
 * @returns A full HTML document string with inlined CSS/JS and an embedded JSON payload of the matrix data.
 */
export function renderHtml(matrix: Matrix, options: RenderOptions): string {
    const generatedAt = formatDate(options.generatedAt);
    const tag = tagline(options.generatedAt);
    const project = escapeHtml(options.projectName ?? "Multi-Vendor E-Commerce");
    const runners = (options.testRunners ?? ["Jest 30", "Playwright 1.57"])
        .map((r) => `<span class="runner__chip">${escapeHtml(r)}</span>`)
        .join("");

    const totalNow = matrix.summary.totalTestFiles;
    const missingCells = matrix.summary.totalCells - matrix.summary.coveredCells;

    const matrixJson = escapeJson({
        generatedAt: options.generatedAt.toISOString(),
        summary: matrix.summary,
        cells: matrix.cells,
    });

    return `<!DOCTYPE html>
<html lang="ja" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Coverage Field Report — ${project}</title>
  <meta name="description" content="Test coverage matrix for ${project}, rendered ${generatedAt}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500;9..144,700&family=IBM+Plex+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />
  <style>${INLINE_CSS}</style>
</head>
<body>
  <div class="grain" aria-hidden="true"></div>

  <aside class="rail" aria-hidden="true">
    <span class="rail__text">${escapeHtml(tag)}</span>
  </aside>

  <button type="button" class="theme-toggle" data-theme-toggle aria-label="テーマ切替">
    <span data-theme-icon-dark>◐</span>
    <span data-theme-icon-light>◑</span>
  </button>

  <main class="page">
    <header class="masthead">
      <div class="masthead__top">
        <span class="masthead__eyebrow">Volume I · Issue 01</span>
        <span class="masthead__date">${escapeHtml(generatedAt)}</span>
      </div>
      <h1 class="masthead__title">
        <span class="masthead__title-line">Coverage</span>
        <span class="masthead__title-line masthead__title-line--alt">Field <em>Report</em></span>
      </h1>
      <p class="masthead__deck">
        A laboratory survey of ${project}&apos;s test surface — what is observed,
        what remains <span class="accent">unmeasured</span>, and where the next
        instruments should be placed.
      </p>
    </header>

    <section class="hero" aria-label="Top-line metrics">
      <article class="kpi kpi--primary">
        <span class="kpi__eyebrow">Cells covered</span>
        <div class="kpi__readout">
          <span class="kpi__number">${matrix.summary.coveragePct}</span>
          <span class="kpi__unit">%</span>
        </div>
        <div class="kpi__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${matrix.summary.coveragePct}">
          <span class="kpi__bar-fill" style="width:${matrix.summary.coveragePct}%"></span>
        </div>
        <span class="kpi__sub">${matrix.summary.coveredCells} of ${matrix.summary.totalCells} (category × domain) intersections</span>
      </article>

      <article class="kpi">
        <span class="kpi__eyebrow">Test files</span>
        <div class="kpi__readout">
          <span class="kpi__number kpi__number--small">${totalNow}</span>
        </div>
        <span class="kpi__sub">across Jest + Playwright</span>
      </article>

      <article class="kpi">
        <span class="kpi__eyebrow">Gaps</span>
        <div class="kpi__readout">
          <span class="kpi__number kpi__number--small kpi__number--accent">${missingCells}</span>
        </div>
        <span class="kpi__sub">empty intersections to populate</span>
      </article>

      <article class="kpi kpi--meta">
        <span class="kpi__eyebrow">Runners</span>
        <div class="kpi__runners">${runners}</div>
        <span class="kpi__sub">
          <a href="../coverage/lcov-report/index.html">lcov report ↗</a>
        </span>
      </article>
    </section>

    ${renderFilters(matrix)}

    <section class="matrix-section" aria-label="カバレッジマトリクス">
      <div class="matrix-section__head">
        <h2 class="section-title"><span class="section-title__num">§ 02</span> The Matrix</h2>
        ${renderLegend()}
      </div>
      <div class="matrix-wrap">${renderMatrix(matrix)}</div>
    </section>

    <section class="actions-section" aria-label="Next actions">
      <h2 class="section-title"><span class="section-title__num">§ 03</span> Next Actions</h2>
      <div class="actions-grid">${renderActions()}</div>
    </section>

    <footer class="colophon">
      <div class="colophon__col">
        <span class="colophon__eyebrow">Generated</span>
        <span>${escapeHtml(generatedAt)} · <code>bun run coverage:dashboard</code></span>
      </div>
      <div class="colophon__col">
        <span class="colophon__eyebrow">Set in</span>
        <span>Fraunces · IBM Plex Sans · JetBrains Mono</span>
      </div>
      <div class="colophon__col">
        <span class="colophon__eyebrow">Method</span>
        <span>filesystem scan + lcov · zero runtime data fetching</span>
      </div>
    </footer>
  </main>

  <script id="matrix-data" type="application/json">${matrixJson}</script>
  <script>${INLINE_JS}</script>
</body>
</html>
`;
}

const INLINE_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0E1014;
  --bg-elev: #15181F;
  --bg-grid: rgba(244, 239, 229, 0.04);
  --ink: #F4EFE5;
  --ink-dim: #8E8978;
  --rule: #2A2F3A;
  --accent: #FD384F;
  --full: #7A9E7E;
  --full-glow: rgba(122, 158, 126, 0.18);
  --partial: #D4A24C;
  --partial-glow: rgba(212, 162, 76, 0.18);
  --missing: #4A2D32;
  --missing-glow: rgba(253, 56, 79, 0.10);
  --max: 1480px;
  --gap-xs: 0.5rem;
  --gap-sm: 1rem;
  --gap-md: 1.75rem;
  --gap-lg: 3rem;
  --gap-xl: 5rem;
}
html[data-theme="light"], html:not([data-theme]) {}
@media (prefers-color-scheme: light) {
  html:not([data-theme="dark"]) {
    --bg: #F4EFE5;
    --bg-elev: #FBF7EE;
    --bg-grid: rgba(26, 24, 22, 0.05);
    --ink: #1A1816;
    --ink-dim: #6B6759;
    --rule: #D9D1BD;
    --accent: #C13140;
    --full: #5D7D62;
    --full-glow: rgba(93, 125, 98, 0.14);
    --partial: #A87929;
    --partial-glow: rgba(168, 121, 41, 0.14);
    --missing: #E3D6C7;
    --missing-glow: rgba(193, 49, 64, 0.10);
  }
}
html[data-theme="light"] {
  --bg: #F4EFE5;
  --bg-elev: #FBF7EE;
  --bg-grid: rgba(26, 24, 22, 0.05);
  --ink: #1A1816;
  --ink-dim: #6B6759;
  --rule: #D9D1BD;
  --accent: #C13140;
  --full: #5D7D62;
  --full-glow: rgba(93, 125, 98, 0.14);
  --partial: #A87929;
  --partial-glow: rgba(168, 121, 41, 0.14);
  --missing: #E3D6C7;
  --missing-glow: rgba(193, 49, 64, 0.10);
}

html { background: var(--bg); }
body {
  font-family: 'IBM Plex Sans', system-ui, -apple-system, sans-serif;
  color: var(--ink);
  background:
    linear-gradient(var(--bg-grid) 1px, transparent 1px) 0 0 / 100% 32px,
    linear-gradient(90deg, var(--bg-grid) 1px, transparent 1px) 0 0 / 32px 100%,
    var(--bg);
  min-height: 100vh;
  line-height: 1.5;
  font-size: 15px;
  position: relative;
  overflow-x: hidden;
}

/* Grain overlay */
.grain {
  position: fixed; inset: 0; pointer-events: none; z-index: 1000;
  opacity: 0.06; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}

/* Vertical rail */
.rail {
  position: fixed;
  left: 24px;
  top: 50%;
  transform: translateY(-50%) rotate(-90deg);
  transform-origin: left center;
  color: var(--accent);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  pointer-events: none;
  z-index: 50;
  white-space: nowrap;
}
.rail__text { display: inline-block; padding-left: 200px; }

/* Theme toggle */
.theme-toggle {
  position: fixed;
  top: 24px;
  right: 28px;
  width: 40px; height: 40px;
  border-radius: 50%;
  background: var(--bg-elev);
  border: 1px solid var(--rule);
  color: var(--ink);
  cursor: pointer;
  font-size: 20px;
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
  transition: transform 200ms ease, border-color 200ms ease;
}
.theme-toggle:hover { transform: rotate(180deg); border-color: var(--accent); }
.theme-toggle [data-theme-icon-light] { display: none; }
html[data-theme="light"] .theme-toggle [data-theme-icon-dark] { display: none; }
html[data-theme="light"] .theme-toggle [data-theme-icon-light] { display: inline; }
@media (prefers-color-scheme: light) {
  html:not([data-theme="dark"]) .theme-toggle [data-theme-icon-dark] { display: none; }
  html:not([data-theme="dark"]) .theme-toggle [data-theme-icon-light] { display: inline; }
}

/* Page */
.page {
  max-width: var(--max);
  margin: 0 auto;
  padding: 80px 80px 120px;
  position: relative;
}
@media (max-width: 1024px) {
  .page { padding: 56px 36px 96px; }
  .rail { display: none; }
}

/* Masthead */
.masthead {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--gap-md);
  padding-bottom: var(--gap-lg);
  border-bottom: 1px solid var(--rule);
  margin-bottom: var(--gap-xl);
  animation: fadeUp 800ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.masthead__top {
  display: flex; justify-content: space-between; align-items: baseline;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink-dim);
}
.masthead__title {
  font-family: 'Fraunces', serif;
  font-variation-settings: "opsz" 144, "wght" 500;
  font-size: clamp(72px, 12vw, 188px);
  line-height: 0.88;
  letter-spacing: -0.04em;
  font-weight: 500;
}
.masthead__title-line { display: block; }
.masthead__title-line--alt {
  font-variation-settings: "opsz" 144, "wght" 300;
  font-style: italic;
  padding-left: 1.2em;
  color: var(--ink);
}
.masthead__title-line--alt em {
  color: var(--accent);
  font-style: italic;
}
.masthead__deck {
  font-family: 'Fraunces', serif;
  font-variation-settings: "opsz" 24, "wght" 400;
  font-size: clamp(18px, 1.8vw, 24px);
  max-width: 56ch;
  color: var(--ink-dim);
  line-height: 1.42;
  margin-top: var(--gap-sm);
}
.masthead__deck .accent { color: var(--accent); font-style: italic; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Hero KPI */
.hero {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1.2fr;
  gap: 1px;
  background: var(--rule);
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  margin-bottom: var(--gap-xl);
}
@media (max-width: 900px) {
  .hero { grid-template-columns: 1fr 1fr; }
}
.kpi {
  background: var(--bg);
  padding: var(--gap-md) var(--gap-md) var(--gap-md);
  display: flex; flex-direction: column; gap: var(--gap-xs);
  animation: fadeUp 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: 80ms;
}
.kpi--primary { animation-delay: 120ms; }
.kpi:nth-child(2) { animation-delay: 200ms; }
.kpi:nth-child(3) { animation-delay: 280ms; }
.kpi:nth-child(4) { animation-delay: 360ms; }
.kpi__eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--ink-dim);
}
.kpi__readout {
  font-family: 'Fraunces', serif;
  font-variation-settings: "opsz" 144, "wght" 400;
  display: flex; align-items: baseline; gap: 0.2em;
  line-height: 0.85;
  margin: 4px 0;
}
.kpi__number {
  font-size: clamp(80px, 8vw, 132px);
  letter-spacing: -0.05em;
}
.kpi__number--small { font-size: clamp(56px, 5vw, 84px); }
.kpi__number--accent { color: var(--accent); }
.kpi__unit {
  font-family: 'Fraunces', serif;
  font-variation-settings: "opsz" 48, "wght" 300;
  font-size: clamp(28px, 3vw, 44px);
  font-style: italic;
  color: var(--ink-dim);
}
.kpi__bar {
  height: 4px;
  background: var(--rule);
  position: relative;
  margin: 8px 0 4px;
  overflow: hidden;
}
.kpi__bar-fill {
  display: block;
  height: 100%;
  background: var(--accent);
  width: 0;
  transform-origin: left;
  animation: barIn 1200ms cubic-bezier(0.22, 1, 0.36, 1) 400ms both;
}
@keyframes barIn {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
.kpi__sub {
  font-size: 12px;
  color: var(--ink-dim);
  font-family: 'JetBrains Mono', monospace;
}
.kpi__sub a { color: var(--ink); text-decoration: underline solid var(--rule); text-underline-offset: 3px; }
.kpi__sub a:hover { color: var(--accent); }
.kpi--meta .kpi__runners {
  display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;
}
.runner__chip {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 4px 8px;
  border: 1px solid var(--rule);
  letter-spacing: 0.1em;
  color: var(--ink);
}

/* Filters */
.filters {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--gap-lg);
  margin-bottom: var(--gap-lg);
  padding: var(--gap-md) 0;
  border-bottom: 1px solid var(--rule);
}
@media (max-width: 900px) { .filters { grid-template-columns: 1fr; gap: var(--gap-md); } }
.filters__title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--ink-dim);
  margin-bottom: var(--gap-sm);
}
.filters__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  padding: 6px 10px 6px 12px;
  background: transparent;
  border: 1px solid var(--rule);
  color: var(--ink);
  cursor: pointer;
  display: inline-flex; align-items: center; gap: 8px;
  transition: all 180ms ease;
  letter-spacing: 0.04em;
}
.chip:hover { border-color: var(--accent); color: var(--accent); }
.chip[aria-pressed="false"] {
  color: var(--ink-dim); opacity: 0.4;
  text-decoration: line-through;
}
.chip__count {
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  padding: 1px 6px;
  background: var(--bg-elev);
  border-left: 1px solid var(--rule);
  margin-right: -10px;
  padding-right: 10px;
}

/* Section titles */
.section-title {
  font-family: 'Fraunces', serif;
  font-variation-settings: "opsz" 72, "wght" 400;
  font-size: clamp(32px, 4vw, 56px);
  letter-spacing: -0.02em;
  font-weight: 400;
  display: flex; align-items: baseline; gap: 0.4em;
  margin-bottom: var(--gap-md);
}
.section-title__num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--accent);
  text-transform: uppercase;
}

/* Matrix section */
.matrix-section { margin-bottom: var(--gap-xl); }
.matrix-section__head {
  display: flex; justify-content: space-between; align-items: flex-end;
  gap: var(--gap-lg); margin-bottom: var(--gap-md); flex-wrap: wrap;
}

.legend { display: flex; gap: var(--gap-md); align-items: center; flex-wrap: wrap; }
.legend__title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--ink-dim);
}
.legend__list { display: flex; gap: var(--gap-sm); list-style: none; }
.legend__item {
  display: flex; align-items: center; gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
.legend__symbol { font-size: 16px; line-height: 1; }
.legend__item--full .legend__symbol { color: var(--full); }
.legend__item--partial .legend__symbol { color: var(--partial); }
.legend__item--missing .legend__symbol { color: var(--accent); }
.legend__note {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--ink-dim);
  letter-spacing: 0.05em;
}
.legend__note code {
  color: var(--ink); background: var(--bg-elev); padding: 1px 5px;
}

/* Matrix table */
.matrix-wrap { overflow-x: auto; padding-bottom: var(--gap-sm); }
.matrix {
  width: 100%;
  border-collapse: separate;
  border-spacing: 1px;
  background: var(--rule);
  font-family: 'JetBrains Mono', monospace;
  min-width: 920px;
}
.matrix .cell { background: var(--bg-elev); padding: 0; position: relative; vertical-align: middle; }
.matrix .cell--corner {
  width: 200px;
  padding: 16px;
  font-size: 10px;
  color: var(--ink-dim);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  text-align: left;
  background: var(--bg);
}
.matrix .cell--colhead {
  padding: 12px 8px;
  text-align: center;
  background: var(--bg);
  min-width: 88px;
}
.colhead__num {
  display: block;
  font-family: 'Fraunces', serif;
  font-variation-settings: "opsz" 72, "wght" 400;
  font-size: 28px;
  line-height: 1;
  color: var(--ink);
  letter-spacing: -0.02em;
}
.colhead__label {
  display: block;
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--ink-dim);
  margin-top: 4px;
}
.colhead__full {
  display: block;
  font-size: 9px;
  color: var(--ink-dim);
  opacity: 0.7;
  margin-top: 2px;
  font-family: 'IBM Plex Sans', sans-serif;
  letter-spacing: 0.03em;
}
.matrix .cell--rowhead {
  text-align: left;
  padding: 14px 18px 14px 12px;
  background: var(--bg);
  border-left: 2px solid transparent;
}
.matrix tr:hover .cell--rowhead { border-left-color: var(--accent); }
.rowhead__label {
  display: block;
  font-family: 'Fraunces', serif;
  font-variation-settings: "opsz" 48, "wght" 400;
  font-size: 18px;
  letter-spacing: -0.01em;
  color: var(--ink);
}
.rowhead__num {
  display: block;
  font-size: 10px;
  color: var(--ink-dim);
  letter-spacing: 0.1em;
  margin-top: 2px;
}
.matrix .cell--data {
  text-align: center;
  height: 64px;
  width: 88px;
  cursor: pointer;
  transition: background-color 180ms ease;
  outline: none;
}
.matrix .cell--data:focus-visible { box-shadow: inset 0 0 0 2px var(--accent); }
.matrix .cell--data:hover { background: var(--bg); }
.cell--full { background: var(--full-glow); }
.cell--partial { background: var(--partial-glow); }
.cell--missing { background: var(--missing-glow); }
.cell__symbol {
  display: block;
  font-size: 22px;
  line-height: 1;
  margin-bottom: 2px;
}
.cell--full .cell__symbol { color: var(--full); }
.cell--partial .cell__symbol { color: var(--partial); }
.cell--missing .cell__symbol { color: var(--accent); opacity: 0.5; }
.cell__count {
  font-size: 11px;
  color: var(--ink-dim);
  font-variant-numeric: tabular-nums;
}
.cell--full .cell__count { color: var(--full); }
.cell--partial .cell__count { color: var(--partial); }

/* Tooltip */
.cell__tooltip {
  position: absolute;
  z-index: 50;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(-4px);
  min-width: 280px;
  max-width: 380px;
  background: var(--bg);
  border: 1px solid var(--rule);
  border-top: 2px solid var(--accent);
  padding: 14px 16px;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
  color: var(--ink);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
  opacity: 0; visibility: hidden;
  transition: opacity 180ms ease, transform 180ms ease, visibility 180ms;
  pointer-events: none;
}
.matrix .cell--data:hover .cell__tooltip,
.matrix .cell--data:focus-visible .cell__tooltip {
  opacity: 1; visibility: visible;
  transform: translateX(-50%) translateY(0);
}
.cell__tooltip strong {
  display: block;
  font-family: 'Fraunces', serif;
  font-variation-settings: "opsz" 24, "wght" 500;
  font-size: 14px;
  margin-bottom: 4px;
  letter-spacing: -0.01em;
}
.tooltip__status {
  display: block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--rule);
}
.tooltip__status--full { color: var(--full); }
.tooltip__status--partial { color: var(--partial); }
.tooltip__status--missing { color: var(--accent); }
.tooltip__files {
  list-style: none;
  display: flex; flex-direction: column; gap: 4px;
  max-height: 200px; overflow-y: auto;
}
.tooltip__files li {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  line-height: 1.4;
}
.tooltip__files code {
  color: var(--ink);
  word-break: break-all;
}
.file__count { color: var(--ink-dim); }
.file__count em { color: var(--partial); font-style: normal; }
.tooltip__empty {
  color: var(--ink-dim);
  font-style: italic;
  font-family: 'Fraunces', serif;
}

/* Filtered state */
tr[data-hidden="true"], td[data-hidden="true"], th[data-hidden="true"] {
  opacity: 0.12;
  filter: grayscale(1);
}

/* Actions */
.actions-section { margin-bottom: var(--gap-lg); }
.actions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--rule);
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
}
@media (max-width: 1024px) { .actions-grid { grid-template-columns: 1fr; } }

.prio {
  background: var(--bg);
  padding: var(--gap-md);
  display: flex; flex-direction: column; gap: var(--gap-md);
}
.prio__head {
  display: flex; align-items: baseline; gap: 12px;
  padding-bottom: var(--gap-sm);
  border-bottom: 1px solid var(--rule);
}
.prio__mark {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--accent);
}
.prio--medium .prio__mark { color: var(--partial); }
.prio--low .prio__mark { color: var(--full); }
.prio__title {
  font-family: 'Fraunces', serif;
  font-variation-settings: "opsz" 48, "wght" 400;
  font-size: 28px;
  letter-spacing: -0.02em;
  font-weight: 400;
}
.actions { list-style: none; display: flex; flex-direction: column; gap: var(--gap-sm); counter-reset: actions; }
.action {
  border-left: 2px solid var(--rule);
  padding-left: 14px;
  counter-increment: actions;
  position: relative;
}
.action::before {
  content: counter(actions, decimal-leading-zero);
  position: absolute; left: -28px; top: 1px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  color: var(--ink-dim);
  letter-spacing: 0.1em;
}
.action--high { border-left-color: var(--accent); }
.action--medium { border-left-color: var(--partial); }
.action--low { border-left-color: var(--full); }
.action header {
  display: flex; justify-content: space-between; align-items: baseline; gap: 8px;
}
.action__title {
  font-family: 'Fraunces', serif;
  font-variation-settings: "opsz" 24, "wght" 500;
  font-size: 15px;
  line-height: 1.3;
  letter-spacing: -0.01em;
}
.action__cost {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 2px 7px;
  border: 1px solid var(--rule);
  color: var(--ink-dim);
  letter-spacing: 0.15em;
}
.action__body {
  display: flex; flex-direction: column; gap: 4px;
  font-size: 11px;
  margin-top: 6px;
}
.action__body div { display: flex; gap: 8px; }
.action__body dt {
  font-family: 'JetBrains Mono', monospace;
  color: var(--ink-dim);
  flex-shrink: 0;
  min-width: 48px;
  font-size: 9px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding-top: 2px;
}
.action__body dd {
  color: var(--ink);
  font-size: 11px;
}
.action__body code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--ink);
}

/* Colophon */
.colophon {
  margin-top: var(--gap-xl);
  padding-top: var(--gap-md);
  border-top: 1px solid var(--rule);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--gap-md);
}
@media (max-width: 900px) { .colophon { grid-template-columns: 1fr; } }
.colophon__col { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--ink-dim); }
.colophon__col code { font-family: 'JetBrains Mono', monospace; color: var(--ink); }
.colophon__eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--ink);
}

/* Print */
@media print {
  @page { size: A3 landscape; margin: 14mm; }
  html, body { background: white !important; color: black !important; font-size: 9pt; }
  .grain, .rail, .theme-toggle, .cell__tooltip { display: none !important; }
  .page { padding: 0; max-width: none; }
  .masthead__title { font-size: 56pt; line-height: 0.9; }
  .masthead__title-line--alt em { color: black; }
  .hero {
    grid-template-columns: repeat(4, 1fr) !important;
    border-color: black; background: transparent;
  }
  .kpi { padding: 12pt; break-inside: avoid; background: white; }
  .kpi__bar-fill { background: black !important; }
  .kpi__number, .kpi__number--accent { color: black !important; }
  .kpi__bar { background: #ccc; }
  .matrix { background: black; min-width: 0; }
  .matrix .cell { background: white !important; }
  .cell--full { background: #e8f0e8 !important; }
  .cell--partial { background: #f6efe0 !important; }
  .cell--missing { background: #f7e2e4 !important; }
  .cell--full .cell__symbol { color: #2d5a32 !important; }
  .cell--partial .cell__symbol { color: #8a6313 !important; }
  .cell--missing .cell__symbol { color: #8a1a26 !important; }
  .colhead__num, .rowhead__label { color: black !important; }
  .filters, .legend__note { display: none !important; }
  .actions-grid { grid-template-columns: repeat(3, 1fr); background: black; }
  .prio { background: white; break-inside: avoid; }
  .action__title { color: black; }
  .colophon { color: black; border-color: black; }
  a { color: black; text-decoration: underline; }
  a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 7pt; color: #666; }
}
`;

const INLINE_JS = `
(function () {
  // Theme toggle
  var html = document.documentElement;
  var btn = document.querySelector('[data-theme-toggle]');
  function currentTheme() { return html.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); }
  if (btn) {
    btn.addEventListener('click', function () {
      html.setAttribute('data-theme', currentTheme() === 'dark' ? 'light' : 'dark');
    });
  }

  // Filter chips
  var chips = document.querySelectorAll('[data-filter]');
  var disabledCats = new Set();
  var disabledDoms = new Set();
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      var filter = c.getAttribute('data-filter');
      var value = c.getAttribute('data-value');
      var pressed = c.getAttribute('aria-pressed') === 'true';
      c.setAttribute('aria-pressed', String(!pressed));
      var set = filter === 'category' ? disabledCats : disabledDoms;
      if (pressed) set.add(value); else set.delete(value);
      apply();
    });
  });
  function apply() {
    document.querySelectorAll('tr[data-category]').forEach(function (tr) {
      tr.dataset.hidden = String(disabledCats.has(tr.getAttribute('data-category')));
    });
    document.querySelectorAll('th[data-domain], td[data-domain]').forEach(function (el) {
      el.dataset.hidden = String(disabledDoms.has(el.getAttribute('data-domain')));
    });
  }

  // Expose data globally for debugging
  try {
    var raw = document.getElementById('matrix-data');
    if (raw) window.__COVERAGE_MATRIX__ = JSON.parse(raw.textContent || 'null');
  } catch (e) { /* noop */ }
})();
`;
