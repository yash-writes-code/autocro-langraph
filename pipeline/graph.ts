/**
 * LangGraph StateGraph — AutoCRO personalisation pipeline.
 *
 * Execution topology (fully sequential):
 *
 *   START
 *     └─ resolveInputs
 *          └─ extractAd                  ← classify ad intent first (Ollama vision)
 *               └─ openBrowser
 *                    └─ extractZones
 *                         └─ extractStyleProfile
 *                              └─ takeBeforeScreenshots
 *                                   └─ rewriteContent   ← fan-in removed, single predecessor
 *                                        └─ validateZones
 *                                             └─ buildBannerAndScript
 *                                                  └─ injectAndStabilise
 *                                                       └─ checkAndFixOverflow
 *                                                            └─ captureRects
 *                                                                 └─ takeAfterScreenshots
 *                                                                      └─ buildFinalResponse
 *                                                                           └─ END
 *
 * NOTE: extractAd previously ran in parallel with the browser chain, but
 * LangGraph's fan-in semantics caused rewriteContent (and the entire tail)
 * to execute TWICE — once per incoming edge — leading to checkAndFixOverflow
 * seeing 0 validatedZones on the first spurious pass and an "Execution context
 * was destroyed" error when takeAfterScreenshots closed the page while the
 * second pass was still running. Making extractAd sequential eliminates both.
 */

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import type {
  PipelineState,
  Zone,
  StyleProfile,
  Tile,
  AdJson,
  BannerData,
  OverflowItem,
  BoundingRect,
  FinalResponse,
} from "./types";
import { closeBrowserContext } from "./browserContext";
import { log, elapsed } from "./logger";

// ─── Node imports ─────────────────────────────────────────────────────────────
import { resolveInputs } from "./nodes/resolveInputs";
import { openBrowser } from "./nodes/openBrowser";
import { extractZones } from "./nodes/extractZones";
import { extractStyleProfile } from "./nodes/extractStyleProfile";
import { takeBeforeScreenshots } from "./nodes/takeBeforeScreenshots";
import { extractAd } from "./nodes/extractAd";
import { rewriteContent } from "./nodes/rewriteContent";
import { validateZones } from "./nodes/validateZones";
import { buildBannerAndScript } from "./nodes/buildBannerAndScript";
import { injectAndStabilise } from "./nodes/injectAndStabilise";
import { checkAndFixOverflow } from "./nodes/checkAndFixOverflow";
import { captureRects } from "./nodes/captureRects";
import { takeAfterScreenshots } from "./nodes/takeAfterScreenshots";
import { buildFinalResponse } from "./nodes/buildFinalResponse";

// ─── State annotation ─────────────────────────────────────────────────────────
// "Last write wins" reducer for all fields — each node writes to distinct keys,
// so there are no conflicts even during parallel execution.

const PipelineStateAnnotation = Annotation.Root({
  pageUrl: Annotation<string>({ reducer: (_, b: string) => b, default: () => "" }),
  adFilePath: Annotation<string>({ reducer: (_, b: string) => b, default: () => "" }),
  zones: Annotation<Zone[]>({ reducer: (_, b: Zone[]) => b, default: () => [] }),
  styleProfile: Annotation<StyleProfile | null>({
    reducer: (_, b: StyleProfile | null) => b,
    default: () => null,
  }),
  beforePath: Annotation<string>({ reducer: (_, b: string) => b, default: () => "" }),
  beforeTiles: Annotation<Tile[]>({ reducer: (_, b: Tile[]) => b, default: () => [] }),
  adJson: Annotation<AdJson | null>({
    reducer: (_, b: AdJson | null) => b,
    default: () => null,
  }),
  rewrittenZones: Annotation<Zone[]>({ reducer: (_, b: Zone[]) => b, default: () => [] }),
  validatedZones: Annotation<Zone[]>({ reducer: (_, b: Zone[]) => b, default: () => [] }),
  banner: Annotation<BannerData | null>({
    reducer: (_, b: BannerData | null) => b,
    default: () => null,
  }),
  injectionScript: Annotation<string>({ reducer: (_, b: string) => b, default: () => "" }),
  injectionSuccess: Annotation<boolean>({
    reducer: (_, b: boolean) => b,
    default: () => false,
  }),
  overflowCheck: Annotation<OverflowItem[]>({
    reducer: (_, b: OverflowItem[]) => b,
    default: () => [],
  }),
  boundingRects: Annotation<BoundingRect[]>({
    reducer: (_, b: BoundingRect[]) => b,
    default: () => [],
  }),
  afterPath: Annotation<string>({ reducer: (_, b: string) => b, default: () => "" }),
  afterTiles: Annotation<Tile[]>({ reducer: (_, b: Tile[]) => b, default: () => [] }),
  finalResponse: Annotation<FinalResponse | null>({
    reducer: (_, b: FinalResponse | null) => b,
    default: () => null,
  }),
});

// ─── Graph definition ─────────────────────────────────────────────────────────

const workflow = new StateGraph(PipelineStateAnnotation)
  // Nodes
  .addNode("resolveInputs", resolveInputs)
  .addNode("openBrowser", openBrowser)
  .addNode("extractZones", extractZones)
  .addNode("extractStyleProfile", extractStyleProfile)
  .addNode("takeBeforeScreenshots", takeBeforeScreenshots)
  .addNode("extractAd", extractAd)
  .addNode("rewriteContent", rewriteContent)
  .addNode("validateZones", validateZones)
  .addNode("buildBannerAndScript", buildBannerAndScript)
  .addNode("injectAndStabilise", injectAndStabilise)
  .addNode("checkAndFixOverflow", checkAndFixOverflow)
  .addNode("captureRects", captureRects)
  .addNode("takeAfterScreenshots", takeAfterScreenshots)
  .addNode("buildFinalResponse", buildFinalResponse)

  // ── Entry ──────────────────────────────────────────────────────────────────
  .addEdge(START, "resolveInputs")

  // ── Fully sequential chain ─────────────────────────────────────────────────
  // extractAd runs first so adJson is available before the browser opens.
  // Previously extractAd ran in parallel with the browser chain, but that
  // caused LangGraph to fire rewriteContent (and all downstream nodes) twice —
  // once per incoming edge — producing a 0-zone overflow pass and a
  // "Execution context was destroyed" crash when the page was closed mid-chain.
  .addEdge("resolveInputs", "extractAd")
  .addEdge("extractAd", "openBrowser")
  .addEdge("openBrowser", "extractZones")
  .addEdge("extractZones", "extractStyleProfile")
  .addEdge("extractStyleProfile", "takeBeforeScreenshots")
  .addEdge("takeBeforeScreenshots", "rewriteContent")
  .addEdge("rewriteContent", "validateZones")
  .addEdge("validateZones", "buildBannerAndScript")
  .addEdge("buildBannerAndScript", "injectAndStabilise")
  .addEdge("injectAndStabilise", "checkAndFixOverflow")
  .addEdge("checkAndFixOverflow", "captureRects")
  .addEdge("captureRects", "takeAfterScreenshots")
  .addEdge("takeAfterScreenshots", "buildFinalResponse")
  .addEdge("buildFinalResponse", END);

const app = workflow.compile();

// ─── Public entry point ───────────────────────────────────────────────────────

export async function runGraph(
  pageUrl: string,
  adFilePath: string
): Promise<FinalResponse> {
  const t = Date.now();
  const initialState: Partial<PipelineState> = { pageUrl, adFilePath };

  log.graph(`▶  Pipeline START  →  ${pageUrl}`);
  log.info("graph", "Topology", {
    nodes: [
      "resolveInputs",
      "extractAd",
      "openBrowser",
      "extractZones",
      "extractStyleProfile",
      "takeBeforeScreenshots",
      "rewriteContent",
      "validateZones",
      "buildBannerAndScript",
      "injectAndStabilise",
      "checkAndFixOverflow",
      "captureRects",
      "takeAfterScreenshots",
      "buildFinalResponse",
    ],
  });

  try {
    const result = await app.invoke(initialState as PipelineState);
    const response = result.finalResponse as FinalResponse | null;

    if (!response) {
      throw new Error("Pipeline completed without producing a final response");
    }

    log.graph(
      `✔  Pipeline DONE   →  ${elapsed(t)}  |  success=${response.success}  |  zones_changed=${response.meta.zones_changed}`
    );

    return response;
  } catch (err) {
    log.error("graph", `Pipeline FAILED after ${elapsed(t)}: ${(err as Error).message}`);
    throw err;
  } finally {
    // Always close the browser, even if a node threw.
    await closeBrowserContext();
  }
}
