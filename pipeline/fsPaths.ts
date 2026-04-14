import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/**
 * Screenshots and ad images are written to the OS temp directory
 * because Vercel Serverless/Edge functions strictly enforce read-only filesystems.
 */
const OUTPUT_DIR = path.join(os.tmpdir(), "autocro-output");

export function getOutputDir(): string {
  return OUTPUT_DIR;
}

export function getOutputPath(filename: string): string {
  return path.join(OUTPUT_DIR, filename);
}

export async function ensureOutputDir(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}
