"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { Role } from "@prisma/client";
import { trpc } from "@/lib/trpc/client";
import {
  useBoardLayout,
  useSetBoardLayout,
  useTheme,
} from "./PreferencesProvider";
import { signOutAction } from "@/app/(app)/_actions/signOut";
import { BellMenu } from "@/components/notifications/BellMenu";

// The shell header. Client component so the theme toggle, open-task counter,
// and role pill can all live in one place. The counter reads cards.list via
// tRPC — the same query the board page uses, so the React Query cache
// serves it without a second roundtrip.
//
// The viewer prop is passed from the (app) layout (server-fetched session)
// rather than via useSession() so we don't have to wrap the tree in
// SessionProvider just to render a name + role badge.

export type Viewer = {
  id: string;
  name: string;
  role: Role;
};

type Props = {
  viewer: Viewer | null;
};

const ROLE_LABEL: Record<Role, string> = {
  ANALYST: "Analyst",
  ESTIMATOR: "Estimator",
  SCHEDULER: "Scheduler",
  COMMERCIAL_MANAGER: "Commercial Manager",
  ADMIN: "Admin",
};

const ROLE_CLASS: Record<Role, string> = {
  ANALYST: "is-analyst",
  ESTIMATOR: "is-estimator",
  SCHEDULER: "is-scheduler",
  COMMERCIAL_MANAGER: "is-commercial-manager",
  ADMIN: "is-admin",
};

export function Header({ viewer }: Props) {
  const { theme, toggle } = useTheme();
  const { data: cards } = trpc.cards.list.useQuery();
  const openCount = cards?.length ?? 0;

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true" />
        <span>ConBon</span>
        <span className="brand-sep" aria-hidden="true">·</span>
        <span className="brand-sub">Project Controls Kanban Board</span>
      </div>

      <div className="topbar-spacer" />

      <div className="topbar-count" aria-live="polite">
        {openCount} open task{openCount === 1 ? "" : "s"}
      </div>

      {viewer ? (
        <AccountMenu viewer={viewer} />
      ) : (
        <span className="role-pill-placeholder" aria-label="Not signed in">
          Signed-out
        </span>
      )}

      {viewer && <BellMenu viewerId={viewer.id} />}

      {viewer && <LayoutToggle />}

      <button
        type="button"
        className="icon-btn"
        onClick={toggle}
        aria-label={theme === "soft" ? "Switch to dark theme" : "Switch to light theme"}
        title={theme === "soft" ? "Switch to dark theme" : "Switch to light theme"}
      >
        {theme === "soft" ? <MoonIcon /> : <SunIcon />}
      </button>
    </header>
  );
}

// The name+role pill doubles as an account menu trigger. Nav items are
// context-aware: whichever route the viewer is currently on is hidden,
// so the menu always offers somewhere new to go.
//   - Active → /active, hidden on /active
//   - Archive → /archive, hidden on /archive
//   - Admin → /admin/people, gated to viewer.role === "ADMIN" and hidden
//     on /admin/*. Mirrors the tightened admin/layout.tsx server gate;
//     deep-linking still bounces non-Admin to the friendly 403 panel.
//   - Sign out → awaits the server action (clears the session cookie),
//     then router.push("/signin") on the client. PR #21 tried doing the
//     redirect inside the SA via next/navigation's redirect(), but the
//     Radix DropdownMenu.Item closes its portal synchronously on click
//     and unmounts the form before React's SA-redirect protocol resolves,
//     so the redirect was silently dropped in practice. Driving the
//     navigation from a client onSelect handler decouples it from the
//     form-mount lifetime.
function AccountMenu({ viewer }: { viewer: Viewer }) {
  const pathname = usePathname();
  const router = useRouter();
  const onActive = pathname === "/active";
  const onArchive = pathname === "/archive";
  const onAdmin = pathname.startsWith("/admin");
  const isAdmin = viewer.role === "ADMIN";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={`role-pill role-pill-trigger ${ROLE_CLASS[viewer.role]}`}
          aria-label="Account menu"
        >
          <span className="role-pill-name">{viewer.name}</span>
          <span className="role-pill-tag">{ROLE_LABEL[viewer.role]}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="account-dropdown"
          align="end"
          sideOffset={8}
        >
          {!onActive && (
            <DropdownMenu.Item asChild>
              <Link href="/active" className="account-item">
                Active
              </Link>
            </DropdownMenu.Item>
          )}
          {!onArchive && (
            <DropdownMenu.Item asChild>
              <Link href="/archive" className="account-item">
                Archive
              </Link>
            </DropdownMenu.Item>
          )}
          {isAdmin && !onAdmin && (
            <DropdownMenu.Item asChild>
              <Link href="/admin/people" className="account-item">
                Admin
              </Link>
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Separator className="account-separator" />
          <DropdownMenu.Item
            className="account-item account-item-danger"
            onSelect={async () => {
              await signOutAction();
              router.push("/signin");
            }}
          >
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// Split into its own component so the useBoardLayout / useSetBoardLayout
// calls only run when PreferencesBridge is in the tree (signed-in routes
// only; the bridge throws if used outside its provider). The parent
// Header gates this on `viewer`.
function LayoutToggle() {
  const layout = useBoardLayout();
  const setLayout = useSetBoardLayout();
  const next = layout === "columns" ? "swimlanes" : "columns";
  const label =
    layout === "columns" ? "Switch to swim lanes" : "Switch to columns";
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => setLayout(next)}
      aria-label={label}
      title={label}
      aria-pressed={layout === "swimlanes"}
    >
      {layout === "columns" ? <LanesIcon /> : <ColumnsIcon />}
    </button>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function ColumnsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="9.5" y="4" width="5" height="16" rx="1" />
      <rect x="16" y="4" width="5" height="16" rx="1" />
    </svg>
  );
}

function LanesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="3" width="16" height="5" rx="1" />
      <rect x="4" y="9.5" width="16" height="5" rx="1" />
      <rect x="4" y="16" width="16" height="5" rx="1" />
    </svg>
  );
}

