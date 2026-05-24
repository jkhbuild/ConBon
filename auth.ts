import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

// Phase 7 auth config.
//
// Session strategy is JWT (not the Prisma adapter): Person is already the
// canonical user table, and we have ≤8 users — adding the Auth.js User /
// Account / Session models would just duplicate Person without adding
// value. The JWT carries the resolved Person.id + Role across requests,
// so a signed-in user costs zero Postgres roundtrips per request.
//
// signIn callback enforces the allowlist (AllowedUser.email) and upserts
// a Person row on first sign-in with the role copied from AllowedUser.
// Subsequent sign-ins are a no-op upsert — the admin can change role /
// name in Phase 9 without sign-in clobbering them.
//
// Dev bypass: when AUTH_DEV_USER_EMAIL is set and NODE_ENV !== production,
// a "Sign in as <email>" Credentials provider runs through the same
// signIn / jwt / session pipeline as a real Google flow. Lets us verify
// Phase 7 end-to-end before Google creds are wired.

const isProd = process.env.NODE_ENV === "production";
const devBypassEmail = process.env.AUTH_DEV_USER_EMAIL?.toLowerCase().trim();

const providers: Provider[] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  );
}

if (!isProd && devBypassEmail) {
  providers.push(
    Credentials({
      id: "dev-bypass",
      name: "Dev bypass",
      credentials: {},
      authorize: () => ({
        email: devBypassEmail,
        name: devBypassEmail,
      }),
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers,
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase().trim();
      if (!email) return false;

      const allowed = await db.allowedUser.findUnique({ where: { email } });
      if (!allowed) return false;

      await db.person.upsert({
        where: { email },
        update: {},
        create: {
          email,
          name: user.name ?? email,
          role: allowed.role,
          color: "#888888",
        },
      });

      return true;
    },

    async jwt({ token, trigger }) {
      if (!token.userId || trigger === "signIn" || trigger === "signUp") {
        const email = token.email?.toLowerCase();
        if (email) {
          const person = await db.person.findUnique({
            where: { email },
            select: { id: true, role: true },
          });
          if (person) {
            token.userId = person.id;
            token.role = person.role;
          }
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.userId && token.role) {
        session.user.id = token.userId as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});
