import type { Metadata, Viewport } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";

const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dreamland - A Life Simulator",
  description:
    "Live an entire life from birth to death. Make choices that shape your journey toward your dream in this narrative-driven life simulator.",
  keywords: ["life simulator", "game", "narrative", "choices", "pixel art", "retro"],
  authors: [{ name: "Studio Pythia" }],
  openGraph: {
    title: "Dreamland - A Life Simulator",
    description: "Live an entire life from birth to death.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f380f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={pressStart2P.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
