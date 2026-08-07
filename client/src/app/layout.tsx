import type { Metadata } from "next";
import "./globals.css";
import AuthInit from "@/lib/components/AuthInit";

export const metadata: Metadata = {
  title: "EasyDraw",
  description: "A draw.io-style diagramming app.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Match the Svelte global.css `html, body { height: 100% }` with a non-flex
    // body — each page owns its own min-h-screen + background. (A `flex flex-col`
    // body clipped per-page backgrounds once content passed one screen.)
    <html lang="en" className="h-full">
      <body className="h-full font-sans text-ink">
        <AuthInit />
        {children}
      </body>
    </html>
  );
}
