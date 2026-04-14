"use client";

import { useMemo, useState } from "react";
import { ImgComparisonSlider } from "@img-comparison-slider/react";
import type { FormEvent, DragEvent, ChangeEvent } from "react";

const SAMPLE_AD_PATH = "/sample-ad.png";
const RESULT_STORAGE_KEY = "troopod:last-result";

interface Change {
  zone: string;
  original: string;
  new: string;
  selector: string;
  overflow: boolean;
  changed: boolean;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface AdIntent {
  offer_type: string;
  urgency_level: string;
  cta_style: string;
  key_messages: string[];
}

interface ResultMeta {
  zones_changed: number;
}

interface PersonaliseResult {
  success: boolean;
  changes: Change[];
  images: {
    before: string;
    after: string;
  };
  ad_intent: AdIntent;
  banner: { text: string; backgroundColor: string; textColor: string } | null;
  meta: ResultMeta;
}

function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

interface ChangeCardProps {
  change: Change;
}

function ChangeCard({ change }: ChangeCardProps) {
  return (
    <article className="change-card">
      <span className="zone-label">{change.zone}</span>
      <div className="change-copy">
        <div className="change-block">{change.original}</div>
        <div className="change-arrow">-&gt;</div>
        <div className="change-block">{change.new}</div>
      </div>
      <div className="selector-line">{change.selector}</div>
      <div className="overflow-line">Overflow: {change.overflow ? "detected" : "none"}</div>
    </article>
  );
}

export default function HomePage() {
  const [adFile, setAdFile] = useState<File | null>(null);
  const [adInputUrl, setAdInputUrl] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pageUrl, setPageUrl] = useState<string>("");
  const [status, setStatus] = useState<string>("Ready to analyse.");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<PersonaliseResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDragActive, setIsDragActive] = useState<boolean>(false);

  const changedZones = useMemo<Change[]>(
    () => result?.changes?.filter((change) => change.changed) ?? [],
    [result]
  );

  function applyFile(file: File | null): void {
    setAdFile(file);
    setAdInputUrl("");
    setResult(null);
    setError("");
    setStatus(file ? "Ad creative attached." : "Ready to analyse.");

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(file ? createPreviewUrl(file) : null);
  }

  function applyUrl(url: string): void {
    setAdInputUrl(url);
    setAdFile(null);
    setResult(null);
    setError("");

    if (!url) {
      setPreviewUrl(null);
      setStatus("Ready to analyse.");
      return;
    }
    
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    
    setPreviewUrl(url);
    setStatus("Ad creative URL attached.");
  }

  function useSampleAd(): void {
    setAdFile(null);
    setAdInputUrl("");
    setResult(null);
    setError("");

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(SAMPLE_AD_PATH);
    setStatus("Sample ad selected.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!pageUrl.trim()) {
      setError("Landing page URL is required.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setResult(null);
    setStatus("Running ad extraction and page rendering in parallel...");

    try {
      const formData = new FormData();
      formData.append("pageUrl", pageUrl.trim());

      if (adFile) {
        formData.append("adFile", adFile);
      } else if (adInputUrl) {
        formData.append("adUrl", adInputUrl);
      } else if (previewUrl === SAMPLE_AD_PATH) {
        formData.append("adUrl", new URL(SAMPLE_AD_PATH, window.location.origin).toString());
      } else {
        throw new Error("Please provide an Ad File, an Ad URL, or use the sample ad.");
      }

      const response = await fetch("/api/personalise", {
        method: "POST",
        body: formData
      });
      const payload: PersonaliseResult & { error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Personalisation failed.");
      }

      setResult(payload);
      window.localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(payload));
      setStatus(
        payload.success
          ? "Personalisation complete."
          : "Personalisation finished with a graceful fallback."
      );
    } catch (submissionError) {
      setError((submissionError as Error).message || "Personalisation failed.");
      setStatus("Run failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="troopod-shell">
      <section className="hero">
        <span className="eyebrow">Troopod Pipeline</span>
        <h1>Message-match landing pages without handing DOM control to the model.</h1>
        <p>
          Upload an ad creative, add a landing page URL, and Troopod will extract
          deterministic zones, rewrite only approved copy with local Gemma via
          Ollama, validate every change, and return before/after evidence.
        </p>
      </section>

      <form className="panel" onSubmit={handleSubmit}>
        <div className="input-grid">
          <div className="field-column" style={{ display: "flex", flexDirection: "column" }}>
            <label className="field-label">Ad Creative Upload</label>
            <label
              className={`dropzone${isDragActive ? " is-active" : ""}`}
              onDragEnter={() => setIsDragActive(true)}
              onDragLeave={() => setIsDragActive(false)}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragActive(true);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragActive(false);
                applyFile(event.dataTransfer.files?.[0] ?? null);
              }}
            >
              <input accept=".png,.jpg,.jpeg,.gif" type="file" onChange={(event) => applyFile(event.target.files?.[0] ?? null)} />
              {previewUrl ? (
                <img alt="Ad preview" className="dropzone-preview" src={previewUrl} />
              ) : (
                <div>
                  <strong>Drop JPG, PNG, or GIF here</strong>
                  <p className="hint">
                    Upload an explicit file, or skip to provide a URL below.
                  </p>
                </div>
              )}
              <div className="dropzone-actions" style={{ flexWrap: "wrap", justifyContent: "center" }}>
                <span className="ghost-button">Choose file</span>
                <button className="ghost-button" onClick={(event) => { event.preventDefault(); useSampleAd(); }} type="button" suppressHydrationWarning>
                  Use sample ad
                </button>
              </div>
            </label>

            <div style={{ margin: "1rem 0", display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ flex: 1, borderTop: "1px solid currentColor", opacity: 0.15 }}></span>
                <span style={{ fontSize: "0.85rem", opacity: 0.5, fontWeight: 500, textTransform: "uppercase" }}>or paste image url</span>
                <span style={{ flex: 1, borderTop: "1px solid currentColor", opacity: 0.15 }}></span>
            </div>

            <input
              className="text-input"
              id="adUrl"
              onChange={(event) => applyUrl(event.target.value)}
              placeholder="https://example.com/ad-image.jpg"
              type="url"
              value={adInputUrl}
            />
          </div>

          <div className="field-column">
            <label className="field-label" htmlFor="pageUrl">Landing Page URL</label>
            <input
              className="text-input"
              id="pageUrl"
              onChange={(event) => setPageUrl(event.target.value)}
              placeholder="https://example.com/landing-page"
              type="url"
              value={pageUrl}
            />
            <p className="hint">
              The backend accepts <code>multipart/form-data</code> with <code>adFile</code> or
              <code>adUrl</code> plus <code>pageUrl</code>, then runs the pipeline in the exact
              order defined by the blueprint.
            </p>
          </div>
        </div>

        <div className="submit-row">
          <div className={`status-line${error ? " error" : ""}`}>{error || status}</div>
          <button className="primary-button" disabled={isSubmitting} type="submit" suppressHydrationWarning>
            {isSubmitting ? "Running pipeline..." : "Analyse and Personalise"}
          </button>
        </div>
      </form>

      {result ? (
        <section className="results">
          <div className="results-head">
            <div>
              <h2>Run Output</h2>
              <p className="hint">
                {result.success
                  ? "Before and after screenshots were captured successfully."
                  : "Injection failed gracefully, so the after image may match the before state."}
              </p>
            </div>
          </div>

          <div className="panel comparison-frame">
            <ImgComparisonSlider>
              <img alt="Before personalisation" slot="first" src={result.images.before} />
              <img alt="After personalisation" slot="second" src={result.images.after} />
            </ImgComparisonSlider>
            <p className="slider-caption">Slide to reveal the changes.</p>
          </div>

          <div className="compare-launch-row">
            <a className="primary-button compare-launch-link" href="/compare" rel="noreferrer" target="_blank">
              Open full-page compare
            </a>
            <p className="hint compare-launch-hint">
              Opens a dedicated page with scrollable side-by-side website captures and change floaters.
            </p>
          </div>

          <div className="comparison-fallback">
            <div className="panel comparison-card">
              <h3>Before</h3>
              <img alt="Before screenshot" src={result.images.before} />
            </div>
            <div className="panel comparison-card">
              <h3>After</h3>
              <img alt="After screenshot" src={result.images.after} />
            </div>
          </div>

          <div className="panel meta-grid">
            <div className="meta-item">
              <strong>Offer Type</strong>
              <span>{result.ad_intent.offer_type || "none"}</span>
            </div>
            <div className="meta-item">
              <strong>Urgency</strong>
              <span>{result.ad_intent.urgency_level || "none"}</span>
            </div>
            <div className="meta-item">
              <strong>CTA Style</strong>
              <span>{result.ad_intent.cta_style || "soft"}</span>
            </div>
            <div className="meta-item">
              <strong>Key Messages</strong>
              <span>{result.ad_intent.key_messages.join(" · ") || "None detected"}</span>
            </div>
            <div className="meta-item">
              <strong>Zones Changed</strong>
              <span>{result.meta.zones_changed}</span>
            </div>
          </div>

          <div className="panel diff-grid">
            <h3>Structured Diff</h3>
            {changedZones.length > 0 ? (
              changedZones.map((change) => <ChangeCard change={change} key={change.zone} />)
            ) : (
              <div className="empty-state">
                No zones changed. This can happen when the model output was invalid, all changes
                failed validation, or injection was blocked.
              </div>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
