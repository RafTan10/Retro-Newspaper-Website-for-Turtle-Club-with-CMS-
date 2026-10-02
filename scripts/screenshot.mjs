// Screenshot tool.  npm run shots [-- --label x] [/page] [--mobile|--desktop] [--sections]
// Needs the dev server running. Each run saves into a NEW numbered folder in screenshots/.
import { chromium } from "playwright";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.SHOTS_URL || "http://localhost:5173"; // Vite dev server
const OUT_DIR = path.resolve("screenshots");

// `open` (optional): selector to click before shooting — used to capture the reader overlay.
const PAGES = [
  { name: "stack", path: "/" },
  { name: "reader", path: "/", open: '[data-shot="top-paper"]', waitFor: '[role="dialog"]' },
  { name: "admin", path: "/admin" },
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

const args = process.argv.slice(2);
let label = "";
let sections = false;
const onlyPaths = [];
const onlyViewports = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--label") label = args[++i] || "";
  else if (a === "--sections") sections = true;
  else if (a === "--mobile") onlyViewports.push("mobile");
  else if (a === "--desktop") onlyViewports.push("desktop");
  else if (a.startsWith("/")) onlyPaths.push(a);
}
const pages = onlyPaths.length
  ? onlyPaths.flatMap((p) => {
      const matches = PAGES.filter((x) => x.path === p);
      return matches.length ? matches : [{ name: p.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "page", path: p }];
    })
  : PAGES;
const viewports = onlyViewports.length ? onlyViewports : Object.keys(VIEWPORTS);

try {
  const res = await fetch(BASE_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
} catch {
  console.error(`\n✖ Can't reach ${BASE_URL}. Start the dev server first (npm run dev).\n`);
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });
const existing = (await readdir(OUT_DIR)).map((n) => parseInt(n, 10)).filter(Number.isFinite);
const next = String((existing.length ? Math.max(...existing) : 0) + 1).padStart(3, "0");
const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const runDir = path.join(OUT_DIR, safeLabel ? `${next}-${safeLabel}` : next);
await mkdir(runDir, { recursive: true });

const browser = await chromium.launch();
const saved = [];
for (const vpName of viewports) {
  // reducedMotion makes Framer Motion jump to end states, so shots aren't caught mid-animation.
  const context = await browser.newContext({ ...VIEWPORTS[vpName], viewport: VIEWPORTS[vpName], reducedMotion: "reduce" });
  const page = await context.newPage();
  for (const p of pages) {
    await page.goto(BASE_URL + p.path, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}" });
    await page.evaluate(() => document.fonts.ready);
    if (p.open) {
      try {
        await page.click(p.open, { timeout: 5000 });
        if (p.waitFor) await page.waitForSelector(p.waitFor, { timeout: 5000 });
      } catch {
        console.warn(`  ! ${p.name}: couldn't open "${p.open}", skipped`);
        continue;
      }
    }
    await page.waitForTimeout(600);
    const base = path.join(runDir, `${p.name}-${vpName}`);
    await page.screenshot({ path: `${base}.png` });
    await page.screenshot({ path: `${base}-full.png`, fullPage: true });
    saved.push(`${base}.png`, `${base}-full.png`);
    if (sections) {
      await page.addStyleTag({ content: "header{position:absolute!important}" }); // unpin fixed header
      let n = 0;
      // Elements marked data-shot get their own image (stack, cover, reader page, CMS panels).
      for (const block of await page.locator("[data-shot], main section, footer").all()) {
        const box = await block.boundingBox();
        if (!box || box.height < 40 || !(await block.isVisible())) continue;
        const file = `${base}-s${String(++n).padStart(2, "0")}.png`;
        await block.screenshot({ path: file });
        saved.push(file);
      }
    }
  }
  await context.close();
}
await browser.close();
console.log(`\n✔ Saved ${saved.length} screenshots to ${path.relative(process.cwd(), runDir)}${path.sep}`);
for (const f of saved) console.log("  " + path.relative(process.cwd(), f));
