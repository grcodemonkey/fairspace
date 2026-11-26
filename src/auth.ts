import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

// Exactly where Auth.js lands a known email (its verify-request redirect adds this query).
// Unknown emails must land on the same URL, or the URL shows which emails have an account.
export const CHECK_EMAIL_URL = "/sign-in/check-email?provider=nodemailer&type=email";

/** True when a user row has this email. Emails are stored lower case (a check constraint enforces it). */
export async function isKnownEmail(email: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return rows.length > 0;
}

// Function form: the adapter and db client are built per request, so `next build` needs no DATABASE_URL.
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  providers: [Nodemailer({ server: process.env.EMAIL_SERVER, from: process.env.EMAIL_FROM })],
  pages: { signIn: "/sign-in", verifyRequest: "/sign-in/check-email" },
  callbacks: {
    // Unknown email: same "check your email" URL, send nothing, create no user.
    async signIn({ user }) {
      if (!user.email || !(await isKnownEmail(user.email))) return CHECK_EMAIL_URL;
      return true;
    },
  },
}));
