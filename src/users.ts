import { asc, eq } from "drizzle-orm";
import type { Role } from "@/auth";
import { getDb } from "@/db";
import { users, verificationTokens } from "@/db/schema";

// A db or a transaction: tests pass a transaction that always rolls back.
type Db = Pick<ReturnType<typeof getDb>, "select" | "insert" | "transaction">;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Result = { error?: string };

export const LAST_ADMIN = "The last admin cannot be changed to editor or removed.";

export function listUsers(db: Db = getDb()) {
  return db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .orderBy(asc(users.email));
}

/** Creates the user (lower-case email). An existing email changes nothing. */
export async function inviteUser(email: string, role: Role = "editor", db: Db = getDb()): Promise<Result> {
  const rows = await db
    .insert(users)
    .values({ email: email.trim().toLowerCase(), role })
    .onConflictDoNothing()
    .returning({ id: users.id });
  return rows.length ? {} : { error: "Already a user." };
}

// Locks every admin row first, so two admins demoting each other at the same time cannot leave zero admins.
async function isLastAdmin(tx: Tx, id: string) {
  const admins = await tx.select({ id: users.id }).from(users).where(eq(users.role, "admin")).for("update");
  return admins.length === 1 && admins[0].id === id;
}

export function changeRole(id: string, role: Role, db: Db = getDb()): Promise<Result> {
  return db.transaction(async (tx) => {
    if (role !== "admin" && (await isLastAdmin(tx, id))) return { error: LAST_ADMIN };
    const rows = await tx.update(users).set({ role }).where(eq(users.id, id)).returning({ id: users.id });
    return rows.length ? {} : { error: "No such user." };
  });
}

/** Deletes the user. Sessions and accounts go by cascade, so the user is signed out at once. */
export function removeUser(id: string, db: Db = getDb()): Promise<Result> {
  return db.transaction(async (tx) => {
    if (await isLastAdmin(tx, id)) return { error: LAST_ADMIN };
    const [row] = await tx.delete(users).where(eq(users.id, id)).returning({ email: users.email });
    if (!row) return { error: "No such user." };
    // An unused magic link must not outlive the user.
    if (row.email) await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, row.email));
    return {};
  });
}
