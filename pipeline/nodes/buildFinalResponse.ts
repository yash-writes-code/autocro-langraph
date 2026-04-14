/** Step 17 — Assemble all collected state into the final API response payload. */
import type { PipelineState, FinalResponse, Change } from "../types";
import { VIEWPORT } from "../constants";
import { log, elapsed } from "../logger";

const NODE = "buildFinalResponse";

export async function buildFinalResponse(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const t = Date.now();
  const {
    validatedZones,
    adJson,
    pageUrl,
    overflowCheck,
    injectionSuccess,
    boundingRects,
    beforeTiles,
    afterTiles,
    banner,
  } = state;

  log.step(NODE, "Assembling final response payload…");

  const changes: Change[] = validatedZones.map((zone) => ({
    zone: zone.zone,
    selector: zone.selector,
    original: zone.current_text,
    new: zone.new_text ?? null,
    changed: zone.new_text !== zone.current_text,
    overflow: overflowCheck?.find((item) => item.zone === zone.zone)?.overflow ?? false,
    rect: boundingRects?.find((item) => item.zone === zone.zone)?.rect ?? null,
  }));

  const zonesChanged = changes.filter((c) => c.changed).length;

  const finalResponse: FinalResponse = {
    success: injectionSuccess,
    images: {
      before: state.beforePath,
      after: injectionSuccess ? state.afterPath : state.beforePath,
    },
    ad_intent: {
      offer_type: adJson?.offer_type ?? "none",
      urgency_level: adJson?.urgency_level ?? "none",
      cta_style: adJson?.cta_style ?? "soft",
      key_messages: adJson?.key_messages ?? [],
    },
    changes,
    full_page: {
      before: beforeTiles ?? [],
      after: injectionSuccess ? (afterTiles ?? []) : (beforeTiles ?? []),
    },
    banner: banner ?? null,
    meta: {
      page_url: pageUrl,
      zones_found: validatedZones.length,
      zones_changed: zonesChanged,
      viewport_width: VIEWPORT.width,
    },
  };

  log.info(NODE, "Final response summary", {
    success: finalResponse.success,
    zones_found: finalResponse.meta.zones_found,
    zones_changed: zonesChanged,
    banner: banner ? banner.text.slice(0, 60) : null,
    before_tiles: beforeTiles?.length ?? 0,
    after_tiles: afterTiles?.length ?? 0,
  });

  log.step(NODE, `Done (${elapsed(t)})`);
  return { finalResponse };
}
