import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter_Tight, IBM_Plex_Sans } from "next/font/google";
import { TRPCProvider } from "@/lib/trpc/provider";
import { ThemeProvider, themeInitScript } from "@/components/shell/ThemeProvider";
import "./globals.css";

// next/font handles preload + font-display: swap automatically. Subsetting
// to Latin keeps the payload small. Each font exposes its family name as
// a CSS variable that globals.css consumes via var(--font-display) etc.
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const ibmPlex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ConBon",
  description: "Project Controls Kanban Board",
};

// theme-color tints the browser chrome (mobile address bar, PWA splash).
// We map prefers-color-scheme since the in-app toggle isn't visible to
// the OS; the user's system preference is a sensible proxy on first load.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EBDEC0" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1714" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${ibmPlex.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Set data-theme synchronously before first paint so we don't flash
            the wrong palette on reload. Reads the same localStorage key
            ThemeProvider writes to. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <TRPCProvider>{children}</TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
