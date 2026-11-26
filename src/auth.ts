import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { sql } from "drizzle-orm";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { getDb } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

const CHECK_EMAIL = "/sign-in/check-email";

/** True when a user row has this email (case-insensitive). Only known users get a sign-in link. */
export async function isKnownEmail(email: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
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
  pages: { signIn: "/sign-in", verifyRequest: CHECK_EMAIL },
  callbacks: {
    // Unknown email: show the same "check your email" page, send nothing, create no user.
    async signIn({ user }) {
      if (!user.email || !(await isKnownEmail(user.email))) return CHECK_EMAIL;
      return true;
    },
  },
}));
