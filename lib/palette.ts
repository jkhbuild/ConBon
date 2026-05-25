// Shared color palette for People and Contracts.
//
// The first four entries are the prototype's seeded person colors
// (reference/prototype/data.jsx) so seed output is unchanged. The next
// four extend the palette with the same muted, ~50-60% lightness profile
// — enough variety for the 4-8 user scale ConBon targets with room to
// grow, and white initials (used by the avatar component) stay legible
// against every swatch.
//
// The Admin UI's color picker is constrained to this list (free-form
// hexes would break the design system's chip + stripe consistency).
// Person rows enforce a color; Contract rows allow null (no chip color)
// in addition to any palette hex.

export type PaletteSwatch = {
  name: string;
  hex: string;
};

export const PALETTE = [
  { name: "Rose", hex: "#d68aa6" },
  { name: "Walnut", hex: "#8b6f4d" },
  { name: "Slate", hex: "#7e9bb8" },
  { name: "Sage", hex: "#7ea687" },
  { name: "Amber", hex: "#c9a06b" },
  { name: "Lilac", hex: "#9d8bb3" },
  { name: "Teal", hex: "#6f9b9b" },
  { name: "Terracotta", hex: "#b87a6e" },
] as const satisfies readonly PaletteSwatch[];

const PALETTE_HEXES: ReadonlySet<string> = new Set(PALETTE.map((p) => p.hex));

export function isPaletteHex(hex: string): boolean {
  return PALETTE_HEXES.has(hex.toLowerCase());
}

// Default color stamped onto a Person row created by the auth signIn
// callback before any admin has assigned them a palette swatch. The
// People admin UI is where this gets replaced.
export const PALETTE_DEFAULT_HEX = "#888888";
