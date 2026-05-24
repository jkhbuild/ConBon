// Shown via CSS media query below 1024px. The .mobile-splash / .app pair
// in globals.css toggles visibility so only one renders at any width.
// Desktop-only is a v1 hard constraint — a mobile redesign is out of scope.

export function MobileSplash() {
  return (
    <div className="mobile-splash" role="status">
      <div className="brand-mark" aria-hidden="true" />
      <h1>Open ConBon on a wider screen</h1>
      <p>
        ConBon is desktop-only in v1. Please switch to a screen at least
        1024px wide to use the kanban board.
      </p>
    </div>
  );
}
