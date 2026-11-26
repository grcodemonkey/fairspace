// @vitest-environment node
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { getDb } from "./db";
import { sessions, users, verificationTokens } from "./db/schema";
import { changeRole, inviteUser, LAST_ADMIN, removeUser } from "./users";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
class Rollback extends Error {}

// The test database is shared, and "last admin" is global: every test demotes all admins
// inside a transaction that always rolls back, so no test commits a zero-admin state.
async function inRollback(fn: (tx: Tx) => Promise<void>) {
  await expect(
    getDb().transaction(async (tx) => {
      await tx.update(users).set({ role: "editor" }).where(eq(users.role, "admin"));
      await fn(tx);
      throw new Rollback();
    }),
  ).rejects.toBeInstanceOf(Rollback);
}

const newEmail = () => `user-${crypto.randomUUID()}@example.com`;
const seed = async (tx: Tx, role: "admin" | "editor") =>
  (await tx.insert(users).values({ email: newEmail(), role }).returning())[0];

test("invite-lower-cases-email", async () => {
  const email = newEmail();
  await inRollback(async (tx) => {
    expect(await inviteUser(` ${email.toUpperCase()} `, "editor", tx)).toEqual({});
    expect(await tx.select({ email: users.email }).from(users).where(eq(users.email, email))).toEqual([{ email }]);
  });
});

test("invite-existing-email-refused", async () => {
  await inRollback(async (tx) => {
    const user = await seed(tx, "editor");
    expect(await inviteUser(user.email!.toUpperCase(), "admin", tx)).toEqual({ error: "Already a user." });
    expect((await tx.select().from(users).where(eq(users.id, user.id)))[0].role).toBe("editor");
  });
});

test("invite-defaults-editor", async () => {
  const email = newEmail();
  await inRollback(async (tx) => {
    await inviteUser(email, undefined, tx);
    expect((await tx.select().from(users).where(eq(users.email, email)))[0].role).toBe("editor");
  });
});

test("last-admin-demote-refused", async () => {
  await inRollback(async (tx) => {
    const admin = await seed(tx, "admin");
    expect(await changeRole(admin.id, "editor", tx)).toEqual({ error: LAST_ADMIN });
    expect((await tx.select().from(users).where(eq(users.id, admin.id)))[0].role).toBe("admin");
  });
});

test("last-admin-remove-refused", async () => {
  await inRollback(async (tx) => {
    const admin = await seed(tx, "admin");
    expect(await removeUser(admin.id, tx)).toEqual({ error: LAST_ADMIN });
    expect(await tx.select().from(users).where(eq(users.id, admin.id))).toHaveLength(1);
  });
});

test("second-admin-can-be-demoted", async () => {
  await inRollback(async (tx) => {
    const first = await seed(tx, "admin");
    await seed(tx, "admin");
    expect(await changeRole(first.id, "editor", tx)).toEqual({});
    expect((await tx.select().from(users).where(eq(users.id, first.id)))[0].role).toBe("editor");
  });
});

test("remove-cascades-sessions", async () => {
  await inRollback(async (tx) => {
    const user = await seed(tx, "editor");
    const sessionToken = crypto.randomUUID();
    await tx.insert(sessions).values({ sessionToken, userId: user.id, expires: new Date(Date.now() + 86_400_000) });
    expect(await removeUser(user.id, tx)).toEqual({});
    expect(await tx.select().from(sessions).where(eq(sessions.sessionToken, sessionToken))).toEqual([]);
  });
});

test("remove-deletes-verification-tokens", async () => {
  await inRollback(async (tx) => {
    const user = await seed(tx, "editor");
    await tx
      .insert(verificationTokens)
      .values({ identifier: user.email!, token: crypto.randomUUID(), expires: new Date(Date.now() + 86_400_000) });
    expect(await removeUser(user.id, tx)).toEqual({});
    expect(await tx.select().from(verificationTokens).where(eq(verificationTokens.identifier, user.email!))).toEqual([]);
  });
});
