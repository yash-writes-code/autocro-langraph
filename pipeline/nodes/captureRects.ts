/** Step 15 — Capture bounding rect for each validated zone's selector.
 * Used by the UI to draw change-floater overlays on the after screenshot. */
import type { PipelineState, BoundingRect } from "../types";
import { getPage } from "../browserContext";
import { log, elapsed } from "../logger";

const NODE = "captureRects";

export async function captureRects(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const t = Date.now();
  log.step(NODE, `Capturing bounding rects for ${state.validatedZones.length} zone(s)…`);

  const page = getPage();

  const boundingRects: BoundingRect[] = await page.evaluate(
    (zones: Array<{ zone: string; sel: string }>) =>
      zones.map((z) => {
        const el = document.querySelector(z.sel);
        if (!el) return { zone: z.zone, rect: null };
        const r = el.getBoundingClientRect();
        return {
          zone: z.zone,
          rect: { x: r.left, y: r.top, width: r.width, height: r.height },
        };
      }),
    state.validatedZones.map((z) => ({ zone: z.zone, sel: z.selector }))
  );

  const found = boundingRects.filter((b) => b.rect !== null);
  const missing = boundingRects.filter((b) => b.rect === null);

  log.info(NODE, `Rects captured: ${found.length} found, ${missing.length} missing`, {
    found: found.map((b) => b.zone),
    missing: missing.map((b) => b.zone),
  });

  log.step(NODE, `Done (${elapsed(t)})`);
  return { boundingRects };
}
