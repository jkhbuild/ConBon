import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TRPCProvider } from "@/lib/trpc/provider";

export const metadata: Metadata = {
  title: "ConBon",
  description: "Project Controls Kanban Board",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
