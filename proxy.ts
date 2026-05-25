import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Gate every app route on a signed-in session. Public exceptions are
// configured via the matcher (auth API, tRPC API, SSE events, signin
// page, Next internals, favicon). Cookies + JWT decode happen inside
// auth() — no Prisma touch, so this is edge-runtime safe.
//
// /api/trpc/* and /api/events are intentionally NOT proxied: those
// clients expect JSON errors (tRPC) or an SSE-shaped 401 (EventSource),
// not HTML redirects, on an expired session. The route-level guards
// return proper UNAUTHORIZED codes that the client layer can act on.

export default auth((req) => {
  if (req.auth) return NextResponse.next();

  const signinUrl = new URL("/signin", req.nextUrl);
  // Preserve the originally requested path so /signin can bounce back
  // post-sign-in. Skip the callback when bouncing from "/" or "/signin"
  // themselves to keep the URL tidy.
  if (req.nextUrl.pathname !== "/" && req.nextUrl.pathname !== "/signin") {
    signinUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
  }
  return NextResponse.redirect(signinUrl);
});

export const config = {
  matcher: ["/((?!api/auth|api/trpc|api/events|signin|_next/static|_next/image|favicon.ico).*)"],
};
