/** Steps 2–3 — Launch headless browser, navigate to pageUrl, and prepare the
 * page by forcing lazy elements to load and disabling all animations. */
import type { PipelineState } from "../types";
import { openBrowserContext, getPage } from "../browserContext";
import { log, elapsed } from "../logger";

const NODE = "openBrowser";

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function openBrowser(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const t = Date.now();
  log.step(NODE, `Launching headless browser → ${state.pageUrl}`);

  // Step 2 — Open browser and navigate.
  await openBrowserContext(state.pageUrl);
  log.info(NODE, `Browser opened and page loaded (${elapsed(t)})`);

  const page = getPage();

  // Step 3 — Prepare page: scroll to trigger lazily-loaded elements, then
  // scroll back to top and inject a style tag that kills all animations.
  log.info(NODE, "Scrolling to 50% to trigger lazy-loaded elements…");
  await page.evaluate(() => {
    window.scrollTo(0, Math.floor(document.body.scrollHeight * 0.5));
  });
  await delay(400);

  log.info(NODE, "Scrolling back to top…");
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });

  log.info(NODE, "Injecting animation-kill style tag…");
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
        animation-duration: 0s !important;
      }
    `,
  });

  await delay(600);
  log.step(NODE, `Page ready for extraction (total ${elapsed(t)})`);

  return {};
}
