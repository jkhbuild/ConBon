import type { ReactNode } from "react";
import { auth } from "@/auth";
import { Header } from "@/components/shell/Header";
import { MobileSplash } from "@/components/shell/MobileSplash";
import { RealtimeSync } from "@/components/realtime/RealtimeSync";
import { NotificationToasts } from "@/components/notifications/NotificationToasts";

// Shell layout for the authenticated app routes — /active, /archive, /admin.
// The root layout owns ThemeProvider + TRPCProvider; this one just wires
// the header + main column and renders MobileSplash alongside (CSS in
// globals.css picks which one is visible based on viewport width).
// <RealtimeSync /> opens the SSE pipe to /api/events; it renders nothing
// and lives at this layer so every signed-in route stays in sync.
// <NotificationToasts /> subscribes to audit.listForUser and pops a
// Radix Toast on each new event affecting the viewer.
//
// Session is fetched server-side and passed as a narrow `viewer` prop to
// the Header — avoids dragging next-auth/react + a SessionProvider into
// the bundle just to render a role pill.

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const viewer = session?.user
    ? {
        id: session.user.id,
        name: session.user.name ?? session.user.email ?? "Signed in",
        role: session.user.role,
      }
    : null;
  return (
    <>
      <div className="app">
        <Header viewer={viewer} />
        <main className="app-main">{children}</main>
      </div>
      <MobileSplash />
      <RealtimeSync />
      {viewer && <NotificationToasts viewerId={viewer.id} />}
    </>
  );
}
