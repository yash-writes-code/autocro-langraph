/** Step 1 — Validates inputs. pageUrl and adFilePath are pre-resolved by the
 * API route before graph invocation; this node just confirms they exist. */
import type { PipelineState } from "../types";
import { PipelineError } from "../errors";
import { log } from "../logger";

const NODE = "resolveInputs";

export async function resolveInputs(
  state: PipelineState
): Promise<Partial<PipelineState>> {
  log.step(NODE, "Validating pipeline inputs", {
    pageUrl: state.pageUrl,
    adFilePath: state.adFilePath,
  });

  const { pageUrl, adFilePath } = state;

  if (!pageUrl) {
    log.error(NODE, "pageUrl is missing");
    throw new PipelineError("pageUrl is required", 400);
  }

  try {
    const parsed = new URL(pageUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("unsupported protocol");
    }
    log.info(NODE, `URL validated: ${parsed.origin}${parsed.pathname}`);
  } catch {
    log.error(NODE, `pageUrl is not a valid http/https URL: ${pageUrl}`);
    throw new PipelineError("pageUrl must be a valid http or https URL", 400);
  }

  if (!adFilePath) {
    log.error(NODE, "adFilePath is missing");
    throw new PipelineError("adFilePath is required", 400);
  }

  log.step(NODE, "Inputs valid — proceeding to fan-out");
  // No state changes — inputs are already in state. Return empty update.
  return {};
}
