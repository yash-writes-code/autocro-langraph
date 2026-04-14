/** Step 6 — Capture a viewport "hero" screenshot and a single full-page
 * screenshot (served as one tile) of the page in its pre-injection state.
 *
 * Previous approach: scroll the viewport N times and clip at y=0 each time.
 * BUG: every tile was identical because clip coordinates are always relative
 * to the top-left of the *viewport*, not the page — so every tile showed the
 * same first viewport.
 * Fix: use Puppeteer's built-in fullPage:true which internally expands the
 * page height, takes one screenshot, and saves the entire canvas as a single PNG. */
import type { PipelineState, Tile } from "../types";
import { getPage } from "../browserContext";
import { getOutputDir } from "../fsPaths";
import { VIEWPORT } from "../constants";
import { log, elapsed } from "../logger";

const NODE = "takeBeforeScreenshots";

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Take a single fullPage screenshot and return it as a one-element Tile array.
 * The `top` offset is 0 and the height is the actual rendered page height so
 * that the compare UI can correctly position change-floater overlays.
 */
export async function captureFullPageTiles(
  prefix: "before" | "after"
): Promise<{ tiles: Tile[]; totalHeight: number }> {
  const page = getPage();
  const outputDir = getOutputDir();

  // Scroll to top before capturing so the full page renders from the beginning.
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(200);

  const totalHeight: number = await page.evaluate(() =>
    Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    )
  );

  // fullPage: true expands the viewport to the full document height internally
  // and captures everything in one shot — no manual scrolling needed.
  const base64Str = await page.screenshot({
    encoding: "base64",
    fullPage: true,
    type: "jpeg",
    quality: 70,
  }) as string;

  log.info(NODE, `Full-page screenshot captured in memory (totalHeight=${totalHeight}px)`);

  const tiles: Tile[] = [
    {
      src: `data:image/jpeg;base64,${base64Str}`,
      top: 0,
      width: VIEWPORT.width,
      height: totalHeight,
    },
  ];

  return { tiles, totalHeight };
}

export async function takeBeforeScreenshots(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  void state;
  const t = Date.now();
  log.step(NODE, "Capturing before screenshots (full-page)…");

  const page = getPage();

  // Hero / above-the-fold screenshot (kept for the slider comparison on the main page).
  await page.evaluate(() => window.scrollTo(0, 0));
  const base64Hero = await page.screenshot({
    encoding: "base64",
    fullPage: false,
    type: "jpeg",
    quality: 80,
    clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
  }) as string;

  const beforePath = `data:image/jpeg;base64,${base64Hero}`;
  log.info(NODE, `Hero screenshot captured in memory`);

  const { tiles } = await captureFullPageTiles("before");

  log.step(NODE, `Before screenshots complete — ${tiles.length} tile(s) (${elapsed(t)})`);
  return { beforePath, beforeTiles: tiles };
}
