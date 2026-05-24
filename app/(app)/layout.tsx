import type { ReactNode } from "react";
import { Header } from "@/components/shell/Header";
import { MobileSplash } from "@/components/shell/MobileSplash";

// Shell layout for the authenticated app routes — /active, /archive, /admin.
// The root layout owns ThemeProvider + TRPCProvider; this one just wires
// the header + main column and renders MobileSplash alongside (CSS in
// globals.css picks which one is visible based on viewport width).

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="app">
        <Header />
        <main className="app-main">{children}</main>
      </div>
      <MobileSplash />
    </>
  );
}
