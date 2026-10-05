import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { colors } from "@dosely/shared/tokens";
import { publicEnv } from "@/lib/env";
import { buildTokensCss } from "@/lib/tokens-css";
import "./globals.css";

/** Atkinson Hyperlegible Next: drawn by the Braille Institute for low-vision readers. */
const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  // next/font has no metrics for this family; use the system stack while it loads.
  adjustFontFallback: false,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const TOKENS_CSS = buildTokensCss();

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.appUrl),
  title: {
    default: "Dosely: free medication reminders with a caregiver circle",
    template: "%s | Dosely",
  },
  description:
    "Medication reminders you can act on from the notification, a dose-window Live Activity, widgets and refill tracking, plus an optional caregiver circle. Free, with no subscription and no ads.",
  applicationName: "Dosely",
  openGraph: {
    type: "website",
    siteName: "Dosely",
    title: "Dosely: reminders you can act on. Free, forever.",
    description: "Medication reminders with Taken and Snooze on the Lock Screen, and a caregiver circle for when a dose is missed.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: colors.light.surface },
    { media: "(prefers-color-scheme: dark)", color: colors.dark.surface },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={atkinson.variable} suppressHydrationWarning>
      <head>
        <style id="dosely-tokens" dangerouslySetInnerHTML={{ __html: TOKENS_CSS }} />
      </head>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
