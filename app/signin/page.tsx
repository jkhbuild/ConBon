import { signIn } from "@/auth";

// Sign-in page. RSC so we can decide which provider buttons to render
// based on what env is configured: Google when GOOGLE_CLIENT_ID is set,
// dev-bypass when AUTH_DEV_USER_EMAIL is set and NODE_ENV !== production.
// Both buttons post to server actions that call signIn() directly.
//
// callbackUrl is preserved across the round-trip so middleware-bounced
// users land back on the originally requested page after auth.

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ callbackUrl?: string; error?: string }>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const { callbackUrl, error } = await searchParams;
  const redirectTo = callbackUrl ?? "/active";

  const hasGoogle = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const devBypassEmail =
    process.env.NODE_ENV !== "production" ? process.env.AUTH_DEV_USER_EMAIL : undefined;

  return (
    <main className="signin">
      <div className="signin-card">
        <h1 className="signin-title">ConBon</h1>
        <p className="signin-subtitle">Sign in to continue</p>

        {error && <p className="signin-error">{describeAuthError(error)}</p>}

        {hasGoogle && (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo });
            }}
          >
            <button type="submit" className="btn-primary signin-btn">
              Continue with Google
            </button>
          </form>
        )}

        {devBypassEmail && (
          <form
            action={async () => {
              "use server";
              await signIn("dev-bypass", { redirectTo });
            }}
          >
            <button type="submit" className="btn-ghost signin-btn">
              Dev bypass — sign in as {devBypassEmail}
            </button>
          </form>
        )}

        {!hasGoogle && !devBypassEmail && (
          <p className="signin-help">
            No sign-in provider configured. Set <code>GOOGLE_CLIENT_ID</code> /{" "}
            <code>GOOGLE_CLIENT_SECRET</code>, or in dev set <code>AUTH_DEV_USER_EMAIL</code>.
          </p>
        )}
      </div>
    </main>
  );
}

function describeAuthError(code: string): string {
  switch (code) {
    case "AccessDenied":
      return "That email is not on the allowlist. Ask your manager to add it.";
    case "OAuthSignin":
    case "OAuthCallback":
      return "Google sign-in failed. Try again.";
    default:
      return "Sign-in failed. Try again.";
  }
}
