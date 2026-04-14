/** Step 13 — Execute the injection script in the live Puppeteer page context.
 * Wrapped in try/catch — a CSP violation or syntax error sets success: false
 * without crashing the pipeline. */
import type { PipelineState } from "../types";
import { getPage } from "../browserContext";
import { log, elapsed } from "../logger";

const NODE = "injectAndStabilise";

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function injectAndStabilise(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const t = Date.now();
  log.step(NODE, `Injecting script into page (${state.injectionScript.length} chars)…`);

  const page = getPage();
  let injectionSuccess = false;

  try {
    // page.evaluate() runs the script string directly in the browser context.
    await page.evaluate(state.injectionScript);
    injectionSuccess = true;
    log.info(NODE, `Script executed successfully`);
  } catch (error) {
    log.warn(
      NODE,
      `page.evaluate failed (CSP or syntax error): ${(error as Error).message}`
    );
    injectionSuccess = false;
  }

  if (injectionSuccess) {
    log.info(NODE, "Waiting 600ms for layout reflows to settle…");
    await delay(2000);
    log.step(NODE, `Injection complete (${elapsed(t)})`);
  } else {
    log.warn(NODE, `Injection failed — pipeline will continue in fallback mode (${elapsed(t)})`);
  }

  return { injectionSuccess };
}
