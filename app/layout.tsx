import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Troopod – Message-Match Personalisation Pipeline",
  description:
    "Upload an ad creative, add a landing page URL, and Troopod extracts deterministic zones, rewrites copy with local Gemma via Ollama, and returns before/after evidence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
