"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { trpc } from "@/lib/trpc/client";
import { viewerSummary, type AuditEventRow } from "@/lib/audit/diff";

// Notifications bell + dropdown for the Header.
//
// Two tRPC queries drive this:
//
//   audit.unreadCount — cheap COUNT(*) for the badge. Recomputed on every
//   SSE NOTIFY (useRealtimeSync invalidates) so the badge tracks live.
//
//   audit.listForUser — the dropdown payload. Capped at 30 server-side.
//   Always shows recent events affecting the viewer regardless of read
//   state, so opening the bell after `markRead` still shows what just
//   happened — it's a feed, not a backlog.
//
// Open semantics: opening the dropdown immediately fires prefs.markRead,
// which bumps Person.lastSeenAt to now() and (after the next audit.unreadCount
// fetch) drops the badge to 0. The dropdown contents are unchanged by
// the markRead bump — listForUser doesn't filter on lastSeenAt — so the
// user can read what they came for while the badge clears.

type Props = {
  viewerId: string;
};

const TIMESTAMP_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function BellMenu({ viewerId }: Props) {
  const utils = trpc.useUtils();
  const { data: unreadCount = 0 } = trpc.audit.unreadCount.useQuery();
  const { data: events } = trpc.audit.listForUser.useQuery();

  const markRead = trpc.prefs.markRead.useMutation({
    onSettled: () => {
      void utils.audit.unreadCount.invalidate();
    },
  });

  const onOpenChange = (open: boolean) => {
    if (open && unreadCount > 0) {
      markRead.mutate();
    }
  };

  const items = (events ?? [])
    .map((raw) => {
      const event = raw as unknown as AuditEventRow;
      const text = viewerSummary(event, viewerId);
      if (!text) return null;
      return { event, text };
    })
    .filter((x): x is { event: AuditEventRow; text: string } => x !== null);

  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <DropdownMenu.Root onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="icon-btn bell-wrap"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
        >
          <BellIcon />
          {unreadCount > 0 && (
            <span className="bell-badge" aria-hidden="true">
              {badgeLabel}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="bell-dropdown"
          align="end"
          sideOffset={8}
        >
          <div className="bell-dropdown-head">Notifications</div>
          {items.length === 0 ? (
            <div className="bell-empty">You&apos;re all caught up.</div>
          ) : (
            items.map(({ event, text }) => (
              <DropdownMenu.Item
                key={event.id}
                className="bell-item"
                // Don't auto-close on selecting an item — the user is
                // reading, not navigating. Esc / click-outside still close.
                onSelect={(e) => e.preventDefault()}
              >
                <div className="bell-item-text">{text}</div>
                <div className="bell-item-meta">
                  {TIMESTAMP_FMT.format(new Date(event.createdAt))}
                </div>
              </DropdownMenu.Item>
            ))
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function BellIcon() {
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
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
