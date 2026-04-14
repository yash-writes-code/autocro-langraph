/** Step 14 — Detect overflow on each injected zone. For any that overflow,
 * trim the text to a word boundary, re-inject, and re-check. */
import type { PipelineState, OverflowItem, Zone } from "../types";
import { getPage } from "../browserContext";
import { log, elapsed } from "../logger";

const NODE = "checkAndFixOverflow";

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function trimToWordBoundary(text: string | null | undefined, maxChars: number): string {
  if (!text || text.length <= maxChars) return text ?? "";
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace <= 0) return slice.trim();
  return slice.slice(0, lastSpace).trim();
}

async function checkOverflow(zones: Zone[]): Promise<OverflowItem[]> {
  const page = getPage();
  return page.evaluate(
    (zoneArgs: Array<{ zone: string; sel: string }>) =>
      zoneArgs.map((z) => {
        const el = document.querySelector(z.sel);
        if (!el) return { zone: z.zone, overflow: false };
        return {
          zone: z.zone,
          overflow: el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight,
        };
      }),
    zones.map((z) => ({ zone: z.zone, sel: z.selector }))
  );
}

export async function checkAndFixOverflow(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  const { validatedZones, injectionSuccess } = state;
  const t = Date.now();

  log.step(NODE, `Checking overflow for ${validatedZones.length} zone(s)…`);

  if (!injectionSuccess) {
    log.warn(NODE, "Injection failed — skipping overflow check, marking all as non-overflow");
    const overflowCheck: OverflowItem[] = validatedZones.map((z) => ({
      zone: z.zone,
      overflow: false,
    }));
    return { overflowCheck, validatedZones };
  }

  // First pass — detect overflows.
  let overflowCheck = await checkOverflow(validatedZones);
  const overflowing = overflowCheck.filter((item) => item.overflow);

  if (overflowing.length > 0) {
    log.warn(NODE, `${overflowing.length} zone(s) overflowing`, {
      zones: overflowing.map((i) => i.zone),
    });
  } else {
    log.info(NODE, "No overflow detected on first pass");
  }

  // Trim overflowing zones and re-inject them.
  const trimmedZones = validatedZones.map((zone) => {
    const overflow = overflowCheck.find((item) => item.zone === zone.zone)?.overflow;
    if (!overflow) return zone;
    const trimmed = trimToWordBoundary(zone.new_text, zone.max_chars);
    log.info(NODE, `Trimming ${zone.zone}: "${zone.new_text}" → "${trimmed}"`);
    return { ...zone, new_text: trimmed };
  });

  const changedZones = trimmedZones.filter(
    (zone, idx) => zone.new_text !== validatedZones[idx].new_text
  );

  if (changedZones.length > 0) {
    log.info(NODE, `Re-injecting ${changedZones.length} trimmed zone(s)…`);
    const page = getPage();
    await page.evaluate(
      (zones: Array<{ sel: string; text: string }>) => {
        zones.forEach((z) => {
          try {
            const el = document.querySelector(z.sel);
            if (!el) return;
            (el as HTMLElement).innerText = z.text;
          } catch (e) {
            console.warn("[troopod] overflow reinjection failed:", z.sel, (e as Error).message);
          }
        });
      },
      changedZones.map((z) => ({ sel: z.selector, text: z.new_text ?? "" }))
    );

    await delay(600);

    // Second pass — verify fix.
    log.info(NODE, "Second pass — verifying overflow is resolved…");
    overflowCheck = await checkOverflow(trimmedZones);
    const stillOverflowing = overflowCheck.filter((i) => i.overflow);
    if (stillOverflowing.length > 0) {
      log.warn(NODE, `${stillOverflowing.length} zone(s) still overflowing after trim`, {
        zones: stillOverflowing.map((i) => i.zone),
      });
    } else {
      log.info(NODE, "All overflows resolved after trim");
    }
  }

  log.step(NODE, `Overflow check done (${elapsed(t)})`);
  return { overflowCheck, validatedZones: trimmedZones };
}
