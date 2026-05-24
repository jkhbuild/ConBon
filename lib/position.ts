// Integer-with-gaps position scheme for card ordering within an assignee
// bucket. Cards start at multiples of POSITION_GAP and inserts compute
// the midpoint between the two neighbors. With 32-bit ints starting at
// 1024 multiples, ~30 successive midpoint inserts between the same pair
// of cards exhaust the precision — well outside the 4-8 user / few-dozen
// cards-per-bucket scale ConBon targets, so a column-wide rebalance is
// deferred until it's actually needed.
//
// Pure module: no React, no Prisma. Used both client-side (Board.tsx
// drag handler computes a new position from neighbors) and conceptually
// mirrored by the server's append logic for cards.create / cards.restore.

export const POSITION_GAP = 1024;

export function computePosition(
  prev: number | null,
  next: number | null,
): number {
  if (prev === null && next === null) return POSITION_GAP;
  if (prev === null) return (next as number) - POSITION_GAP;
  if (next === null) return prev + POSITION_GAP;
  return Math.floor((prev + next) / 2);
}
