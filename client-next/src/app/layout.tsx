import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EasyDraw",
  description: "A draw.io-style diagramming app.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col font-sans text-ink">{children}</body>
    </html>
  );
}
