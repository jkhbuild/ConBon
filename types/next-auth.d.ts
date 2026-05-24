import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Module-augment Auth.js's Session.user and JWT with the two fields the
// signIn / jwt / session callbacks stamp on (see auth.ts):
//   - id:   the Person.id (cuid) — primary key for ownership checks
//   - role: the Person.role — drives tRPC procedure ladder + UI gating

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
  }
}
