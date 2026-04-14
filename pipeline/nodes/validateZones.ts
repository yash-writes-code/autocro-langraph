/** Step 9 — Three sequential checks per zone. Failures silently revert
 * new_text to current_text. Zones whose CSS selector no longer exists in the
 * live DOM are dropped entirely. */
import type { PipelineState, Zone, AdJson } from "../types";
import { getPage } from "../browserContext";
import { log, elapsed } from "../logger";

const NODE = "validateZones";

// ─── Check 1: length ─────────────────────────────────────────────────────────

function checkLength(zone: Zone): Zone {
  if (!zone.new_text) {
    log.warn(NODE, `[length] ${zone.zone} — null output, reverting to original`);
    return { ...zone, new_text: zone.current_text, fail: "null_output" };
  }
  if (zone.new_text.length > zone.max_chars) {
    log.warn(
      NODE,
      `[length] ${zone.zone} too long (${zone.new_text.length} > ${zone.max_chars} chars) — reverting`
    );
    return { ...zone, new_text: zone.current_text, fail: "length" };
  }
  log.info(NODE, `[length] ${zone.zone} OK (${zone.new_text.length}/${zone.max_chars} chars)`);
  return zone;
}

// ─── Check 2: fact anchor (no invented numbers) ───────────────────────────────

function extractNumbers(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  const matches = text.match(/\d+(\.\d+)?%?/g) ?? [];
  return new Set(matches.map((m) => m.replace("%", "")));
}

function checkFactAnchor(zone: Zone, adJson: AdJson): Zone {
  const adText = [
    ...adJson.key_messages,
    ...adJson.keywords,
    adJson.target_audience,
  ].join(" ");
  const adNums = extractNumbers(adText);
  const outNums = extractNumbers(zone.new_text);
  const invented = [...outNums].filter((n) => !adNums.has(n));

  if (invented.length > 0) {
    log.warn(
      NODE,
      `[fact-anchor] ${zone.zone} invented numbers: [${invented.join(", ")}] — reverting`
    );
    return { ...zone, new_text: zone.current_text, fail: "invented_fact" };
  }

  log.info(NODE, `[fact-anchor] ${zone.zone} OK (no invented numbers)`);
  return zone;
}

// ─── Check 3: selector existence in live DOM ─────────────────────────────────

async function checkSelector(zone: Zone): Promise<Zone | null> {
  const page = getPage();
  const exists = await page.$(zone.selector);
  if (!exists) {
    log.warn(NODE, `[selector] ${zone.zone} — selector not found "${zone.selector}", zone DROPPED`);
    return null;
  }
  log.info(NODE, `[selector] ${zone.zone} OK — "${zone.selector}"`);
  return zone;
}

// ─── Node ────────────────────────────────────────────────────────────────────

export async function validateZones(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const { rewrittenZones, adJson } = state;
  const t = Date.now();

  log.step(NODE, `Validating ${rewrittenZones.length} rewritten zone(s)…`);

  if (!adJson) {
    log.warn(NODE, "adJson missing — skipping validation, returning empty list");
    return { validatedZones: [] };
  }

  const validated: Zone[] = [];

  for (let zone of rewrittenZones) {
    log.info(NODE, `── Checking zone: ${zone.zone}`);
    zone = checkLength(zone);
    if (!zone.fail) zone = checkFactAnchor(zone, adJson);

    const verified = await checkSelector(zone);
    if (verified === null) continue;

    validated.push(verified);
  }

  log.step(NODE, `Validation done (${elapsed(t)}) — ${validated.length}/${rewrittenZones.length} zone(s) passed`, {
    passed: validated.map((z) => z.zone),
    dropped: rewrittenZones
      .filter((z) => !validated.find((v) => v.zone === z.zone))
      .map((z) => z.zone),
  });

  return { validatedZones: validated };
}
