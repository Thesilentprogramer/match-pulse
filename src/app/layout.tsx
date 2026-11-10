import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Barlow_Condensed, Geist_Mono, Outfit } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { DirectionProvider } from "@/components/foundations/direction/direction";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const display = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-display-face",
  weight: ["500", "600", "700"],
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Match Pulse — live second screen",
  description:
    "Follow a chase with moment cards, a companion that quotes the live log, free Over-War calls, and a Match Story at the whistle.",
};

export const viewport: Viewport = {
  themeColor: "#07110d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme="pulse-red"
      className={`${outfit.variable} ${display.variable} ${mono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" forcedTheme="dark" enableSystem={false}>
          <TooltipProvider>
            <DirectionProvider locale="en">{children}</DirectionProvider>
            <Toaster theme="dark" position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
