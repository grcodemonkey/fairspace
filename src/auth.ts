import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq, sql } from "drizzle-orm";
import NextAuth from "next-auth";
import { after } from "next/server";
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

/**
 * Makes ADMIN_EMAIL an admin, but only while no admin exists: a later change to ADMIN_EMAIL
 * mints no second admin, and ADMIN_EMAIL is not promoted while another admin exists.
 * When zero admins exist, the next ADMIN_EMAIL sign-in becomes admin again (lockout recovery).
 */
export async function ensureFirstAdmin(email: string, db: Pick<ReturnType<typeof getDb>, "execute"> = getDb()) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || adminEmail !== email.trim().toLowerCase()) return;
  await db.execute(sql`
    insert into users (id, email, role)
    select ${crypto.randomUUID()}, ${adminEmail}, 'admin'
    where not exists (select 1 from users where role = 'admin')
    on conflict (email) do update set role = 'admin'`);
}

// Code and message only: the whole Nodemailer error carries the recipient addresses.
function logSendError(error: unknown) {
  const { code, message } = error as { code?: string; message?: string };
  console.error("Sign-in email failed", { code, message });
}

// Function form: the adapter and db client are built per request, so `next build` needs no DATABASE_URL.
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const email = Nodemailer({ server: process.env.EMAIL_SERVER, from: process.env.EMAIL_FROM });
  return {
    adapter: DrizzleAdapter(getDb(), {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    session: { strategy: "database" },
    providers: [
      {
        ...email,
        // Send after the response, so a known email answers as fast as an unknown one (no timing leak).
        // An SMTP error goes to the server log; showing it to the user would also tell which emails are known.
        // after() itself is in the try too: a throw here would otherwise fail only on the known-email path.
        async sendVerificationRequest(params) {
          try {
            after(async () => {
              try {
                await email.sendVerificationRequest(params);
              } catch (error) {
                logSendError(error);
              }
            });
          } catch (error) {
            logSendError(error);
          }
        },
      },
    ],
    pages: { signIn: "/sign-in", verifyRequest: "/sign-in/check-email" },
    callbacks: {
      // Unknown email: same "check your email" URL, send nothing, create no user.
      async signIn({ user }) {
        if (user.email) await ensureFirstAdmin(user.email);
        if (!user.email || !(await isKnownEmail(user.email))) return CHECK_EMAIL_URL;
        return true;
      },
    },
  };
});
