/**
 * Simplified Vercel-friendly pipeline logger.
 * Maps directly to standard console functions so cloud providers
 * can properly digest, timestamp, and parse objects.
 */

export const log = {
  /** Generic informational message */
  info(node: string, message: string, data?: unknown): void {
    if (data !== undefined) {
      console.log(`[INFO] [${node}] ${message}`, data);
    } else {
      console.log(`[INFO] [${node}] ${message}`);
    }
  },

  /** Step started / completed markers */
  step(node: string, message: string, data?: unknown): void {
    if (data !== undefined) {
      console.log(`[STEP] [${node}] ${message}`, data);
    } else {
      console.log(`[STEP] [${node}] ${message}`);
    }
  },

  /** Non-fatal warnings (fallbacks, skipped zones, etc.) */
  warn(node: string, message: string, data?: unknown): void {
    if (data !== undefined) {
      console.warn(`[WARN] [${node}] ${message}`, data);
    } else {
      console.warn(`[WARN] [${node}] ${message}`);
    }
  },

  /** Fatal errors just before a throw */
  error(node: string, message: string, data?: unknown): void {
    if (data !== undefined) {
      console.error(`[ERROR] [${node}] ${message}`, data);
    } else {
      console.error(`[ERROR] [${node}] ${message}`);
    }
  },

  /** Graph-level separator / section header */
  graph(message: string): void {
    console.log(`\n=== GRAPH: ${message} ===\n`);
  },
};

/** Returns an elapsed-ms string since `start` (from Date.now()). */
export function elapsed(start: number): string {
  return `${Math.max(0, Date.now() - start)}ms`;
}
