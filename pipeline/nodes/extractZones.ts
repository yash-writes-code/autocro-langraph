/** Step 4 — Extract personalisation zones from the live DOM using heuristic
 * CSS queries. CTAs are detected by scoring all <a> and <button> elements on
 * visual signals (area, background-color, hero proximity, CTA keywords) rather
 * than just picking the first <a> tag, which was incorrectly matching the logo. */
import type { PipelineState, Zone } from "../types";
import { getPage } from "../browserContext";
import { log, elapsed } from "../logger";

const NODE = "extractZones";

export async function extractZones(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  void state;
  const t = Date.now();
  log.step(NODE, "Querying DOM for personalisation zones…");

  const page = getPage();

  const zones: Zone[] = await page.evaluate(() => {
    // ─── Utilities ───────────────────────────────────────────────────────────

    function escapeCssIdentifier(value: string): string {
      if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
        return CSS.escape(value);
      }
      return String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
    }

    function getSelector(el: Element): string {
      if (el.id) return `#${escapeCssIdentifier(el.id)}`;

      const parts: string[] = [];
      let node: Element | null = el;

      while (node && node !== document.body) {
        let selector = node.tagName.toLowerCase();

        if (node.classList.length > 0) {
          const stableClasses = Array.from(node.classList)
            .filter(
              (cls) =>
                !["active", "open", "hover", "focus", "visible", "hidden", "show"].includes(cls)
            )
            .slice(0, 2);

          if (stableClasses.length > 0) {
            selector += `.${stableClasses
              .map((cls) => escapeCssIdentifier(cls))
              .join(".")}`;
          }
        }

        parts.unshift(selector);
        node = node.parentElement;
      }

      return parts.join(" > ");
    }

    function innerTextOf(el: Element): string {
      return (el as HTMLElement).innerText?.trim() ?? "";
    }

    function getComputedValue(el: Element, prop: string): string {
      try {
        return window.getComputedStyle(el).getPropertyValue(prop).trim();
      } catch {
        return "";
      }
    }

    // ─── Headline ────────────────────────────────────────────────────────────

    function findHeadline(): { el: Element; text: string } | null {
      const queries = [
        '[class*="hero"] h1',
        '[class*="header"] h1',
        "header h1",
        "main h1",
        "h1",
      ];
      for (const q of queries) {
        try {
          const el = document.querySelector(q);
          if (!el) continue;
          const text = innerTextOf(el);
          if (text.length >= 3) return { el, text };
        } catch { continue; }
      }
      return null;
    }

    // ─── Subheadline ─────────────────────────────────────────────────────────
    // Prefer elements that live in the same section / are visually close to H1.

    function findSubheadline(headlineEl: Element | null): { el: Element; text: string } | null {
      // Walk up to the h1's section/div container and look for p/h2 siblings.
      const containers: Element[] = [];
      if (headlineEl) {
        let parent = headlineEl.parentElement;
        let hops = 0;
        while (parent && parent !== document.body && hops < 4) {
          containers.push(parent);
          parent = parent.parentElement;
          hops++;
        }
      }

      const subSelectors = [
        '[class*="hero"] p',
        '[class*="hero"] h2',
        '[class*="subtitle"]',
        '[class*="sub-headline"]',
        '[class*="subheadline"]',
        ".hero-sub",
        "h2",
        "section p",
      ];

      for (const container of containers) {
        for (const sel of ["p", "h2"]) {
          try {
            const el = container.querySelector(sel);
            if (!el || el === headlineEl) continue;
            const text = innerTextOf(el);
            if (text.length >= 10) return { el, text };
          } catch { continue; }
        }
      }

      for (const q of subSelectors) {
        try {
          const el = document.querySelector(q);
          if (!el || el === headlineEl) continue;
          const text = innerTextOf(el);
          if (text.length >= 10) return { el, text };
        } catch { continue; }
      }

      return null;
    }

    // ─── CTA scoring ─────────────────────────────────────────────────────────
    // Candidates: all <a> and <button> elements with visible text.
    // Rejected if: inside <nav>/<header>, contains an <img> or <svg> child only
    //              (logo pattern), or has no background-color (plain text link).
    // Scored by:  clickable area + CTA keyword match + hero-section proximity.

    const CTA_KEYWORDS = [
      "start", "get", "try", "sign", "join", "buy", "shop", "book", "claim",
      "register", "subscribe", "download", "install", "watch", "demo", "free",
      "analyse", "analyze", "dashboard", "go to", "learn", "explore", "see",
    ];

    function isInsideNav(el: Element): boolean {
      let node: Element | null = el.parentElement;
      while (node && node !== document.body) {
        const tag = node.tagName.toLowerCase();
        if (tag === "nav" || tag === "header") return true;
        const cls = (node.className ?? "").toLowerCase();
        if (cls.includes("nav") || cls.includes("navbar") || cls.includes("topbar")) return true;
        node = node.parentElement;
      }
      return false;
    }

    function isLogoLink(el: Element): boolean {
      // Logo links contain only an img or svg and no meaningful text.
      const text = innerTextOf(el);
      if (text.length > 0) return false; // has text — not a logo
      const hasImg = el.querySelector("img, svg") !== null;
      return hasImg;
    }

    function hasButtonStyle(el: Element): boolean {
      const bg = getComputedValue(el, "background-color");
      const border = getComputedValue(el, "border");
      // Non-transparent / non-initial background means it's styled as a button.
      const isTransparent = bg === "" || bg === "transparent" || bg === "rgba(0, 0, 0, 0)";
      const hasBorder = border !== "" && !border.includes("none") && !border.includes("0px");
      return !isTransparent || hasBorder;
    }

    function ctaScore(el: Element): number {
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area < 400) return -1; // too small (e.g. inline text links)

      let score = 0;

      // Visible area bonus (larger = more prominent)
      score += Math.min(area / 1000, 20);

      // Button-like styling
      if (hasButtonStyle(el)) score += 30;

      // Keyword match in text
      const text = innerTextOf(el).toLowerCase();
      for (const kw of CTA_KEYWORDS) {
        if (text.includes(kw)) { score += 15; break; }
      }

      // Vertical position bonus — higher on page = more important
      score += Math.max(0, 20 - rect.top / 50);

      // Penalty for nav/header links
      if (isInsideNav(el)) score -= 50;

      return score;
    }

    function findCTAs(): Array<{ el: Element; text: string; score: number }> {
      const candidates: Array<{ el: Element; text: string; score: number }> = [];

      document.querySelectorAll("a, button").forEach((el) => {
        if (isLogoLink(el)) return;
        const text = innerTextOf(el);
        if (text.length < 2 || text.length > 60) return; // too short or paragraph-length

        const score = ctaScore(el);
        if (score < 0) return;

        candidates.push({ el, text, score });
      });

      // Sort best-first, deduplicate by text.
      candidates.sort((a, b) => b.score - a.score);

      const seen = new Set<string>();
      return candidates.filter(({ text }) => {
        const key = text.toLowerCase().slice(0, 30);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // ─── Badge / social-proof ────────────────────────────────────────────────

    function findBadge(): { el: Element; text: string } | null {
      const queries = [
        '[class*="trust"]',
        '[class*="badge"]',
        '[class*="social-proof"]',
        '[class*="guarantee"]',
        '[class*="secure"]',
        '[class*="sparkline"]',
        '[class*="stat"]',
        '[class*="proof"]',
      ];
      for (const q of queries) {
        try {
          const el = document.querySelector(q);
          if (!el) continue;
          const text = innerTextOf(el);
          if (text.length >= 2) return { el, text };
        } catch { continue; }
      }
      return null;
    }

    // ─── Assemble zones ──────────────────────────────────────────────────────

    const result: Array<{
      zone: string;
      selector: string;
      current_text: string;
      max_chars: number;
    }> = [];

    function push(zoneName: string, el: Element, text: string) {
      result.push({
        zone: zoneName,
        selector: getSelector(el),
        current_text: text,
        max_chars: Math.ceil(text.length * 1.4),
      });
    }

    // 1. Headline
    const headline = findHeadline();
    if (headline) push("headline", headline.el, headline.text);

    // 2. Subheadline
    const sub = findSubheadline(headline?.el ?? null);
    if (sub) push("subheadline", sub.el, sub.text);

    // 3. CTAs — primary + up to 2 secondary
    const ctas = findCTAs();
    if (ctas.length > 0) push("cta", ctas[0].el, ctas[0].text);
    if (ctas.length > 1) push("cta_secondary", ctas[1].el, ctas[1].text);
    if (ctas.length > 2) push("cta_tertiary", ctas[2].el, ctas[2].text);

    // 4. Badge / social proof
    const badge = findBadge();
    if (badge) push("badge", badge.el, badge.text);

    return result;
  });

  log.info(NODE, `Extracted ${zones.length} zone(s) in ${elapsed(t)}`, {
    zones: zones.map((z) => ({
      zone: z.zone,
      selector: z.selector,
      chars: z.current_text.length,
      max: z.max_chars,
      preview: z.current_text.slice(0, 60) + (z.current_text.length > 60 ? "…" : ""),
    })),
  });

  if (zones.length === 0) {
    log.warn(NODE, "No zones matched — rewrite will have nothing to work with");
  }

  log.step(NODE, `Done (${elapsed(t)})`);
  return { zones };
}
