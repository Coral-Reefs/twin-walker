import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DayZero — Bandar Bukit Raja living lab",
  description:
    "Explore daily journeys in Bandar Bukit Raja, compare parking-aware travel and test illustrative neighbourhood improvements.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f5c4d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-MY">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
