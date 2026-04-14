/** Step 16 — Capture hero viewport screenshot and full-page tiles of the page
 * after injection. Then close the Puppeteer page. */
import type { PipelineState } from "../types";
import { getPage } from "../browserContext";
import { getOutputDir } from "../fsPaths";
import { VIEWPORT } from "../constants";
import { captureFullPageTiles } from "./takeBeforeScreenshots";
import { log, elapsed } from "../logger";

const NODE = "takeAfterScreenshots";

export async function takeAfterScreenshots(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const { injectionSuccess, beforeTiles } = state;
  const t = Date.now();

  if (!injectionSuccess) {
    log.warn(
      NODE,
      "Injection failed — reusing before tiles for after state, no screenshot captured"
    );
    return {
      afterPath: "",
      afterTiles: beforeTiles,
    };
  }

  log.step(NODE, "Capturing after hero screenshot…");

  const page = getPage();
  const outputDir = getOutputDir();
  const afterPath = `${outputDir}/after.png`;

  await page.screenshot({
    path: afterPath,
    fullPage: false,
    type: "png",
    clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
  });

  log.info(NODE, `Hero after screenshot saved → ${afterPath}`);

  const { tiles: afterTiles } = await captureFullPageTiles("after");
  log.info(NODE, `Full-page tiles captured: ${afterTiles.length} tile(s)`);

  // Page is done — explicit close keeps memory tidy. The browser is closed
  // by graph.ts in its finally block.
  try {
    await page.close();
    log.info(NODE, "Puppeteer page closed");
  } catch {
    log.warn(NODE, "Page close threw an error (ignored)");
  }

  log.step(NODE, `After screenshots complete (${elapsed(t)})`);
  return { afterPath, afterTiles };
}
