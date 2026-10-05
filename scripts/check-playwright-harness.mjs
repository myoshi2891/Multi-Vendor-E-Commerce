// Playwright ハーネスの構成ガード（bun run check:playwright / CI Lint ジョブ）。
// 2026-10 に、画面群ごとに config と fixture サーバーをコピーして増やした結果、
// config が 6 本になり、spec が二重実行される問題が起きた（plans/080）。
// 同じ増え方を機械的に検出するため、以下の 4 点を検査する。ルール: .claude/rules/05-playwright-harness.md
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const ALLOWED_CONFIGS = ["playwright.config.ts", "playwright.design.config.ts"];
const violations = [];

const listFiles = (dir, predicate) =>
    existsSync(join(root, dir))
        ? readdirSync(join(root, dir), { recursive: true })
              .map(String)
              .filter(predicate)
        : [];

// 1. ルートの Playwright config は本体と design の 2 本だけ
for (const file of readdirSync(root)) {
    if (
        /^playwright.*\.config\.(ts|js|mjs|cjs)$/.test(file) &&
        !ALLOWED_CONFIGS.includes(file)
    ) {
        violations.push(
            `${file}: config を新設せず playwright.design.config.ts の DESIGN_SUITES に suite を追加してください`
        );
    }
}

// 2. tests/browser/ の spec はすべて DESIGN_SUITES に登録されている
const designConfig = readFileSync(
    join(root, "playwright.design.config.ts"),
    "utf8"
);
const registered = new Set(
    [...designConfig.matchAll(/testMatch:\s*"([^"]+)"/g)].map(
        (match) => match[1]
    )
);
for (const spec of listFiles("tests/browser", (file) =>
    file.endsWith(".spec.ts")
)) {
    if (!registered.has(spec)) {
        violations.push(
            `tests/browser/${spec}: DESIGN_SUITES に未登録です（DESIGN_SUITE で実行できません）`
        );
    }
}

// 3. design config の testDir は tests/browser/ に固定する。tests/e2e/ は本体 config が
//    丸ごと拾うため、そこを指すと同じ spec が本体（3 ブラウザ）でも実行される。
//    tests/e2e/ には本体用の *-design.spec.ts も正当に存在するので、ファイル名では判定しない。
const testDirs = [...designConfig.matchAll(/testDir:\s*"([^"]+)"/g)].map(
    (match) => match[1]
);
if (testDirs.length !== 1 || testDirs[0] !== "./tests/browser") {
    violations.push(
        `playwright.design.config.ts: testDir は "./tests/browser" 1 つだけにしてください（検出: ${testDirs.join(", ") || "なし"}）`
    );
}

// 4. fixture サーバーは共通の startFixtureServer を使う（コピーで新設しない）
for (const server of listFiles(
    "tests/fixtures",
    (file) => file.endsWith("server.mjs") && !file.startsWith("shared")
)) {
    const source = readFileSync(join(root, "tests/fixtures", server), "utf8");
    if (!source.includes("startFixtureServer")) {
        violations.push(
            `tests/fixtures/${server}: tests/fixtures/shared/fixture-server.mjs の startFixtureServer を使ってください`
        );
    }
}

if (violations.length > 0) {
    console.error(
        `Playwright ハーネスの構成違反が ${violations.length} 件あります:\n` +
            violations.map((violation) => `  - ${violation}`).join("\n") +
            "\n手順: .agent/skills/playwright-browser-verification/SKILL.md"
    );
    process.exit(1);
}
console.info("Playwright harness check passed.");
