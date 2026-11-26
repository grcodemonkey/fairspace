// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { ensureFirstAdmin, isKnownEmail } from "./auth";
import { getDb } from "./db";
import { users } from "./db/schema";

const email = `known-${crypto.randomUUID()}@example.com`;

beforeAll(async () => {
  await getDb().insert(users).values({ email });
});

afterAll(async () => {
  await getDb().delete(users).where(eq(users.email, email));
});

test("a seeded user is known", async () => {
  expect(await isKnownEmail(email)).toBe(true);
});

test("an unknown email is not known", async () => {
  expect(await isKnownEmail(`unknown-${crypto.randomUUID()}@example.com`)).toBe(false);
});

test("the lookup lower-cases the input", async () => {
  expect(await isKnownEmail(email.toUpperCase())).toBe(true);
});

test("the database rejects a mixed-case email", async () => {
  await expect(getDb().insert(users).values({ email: `Mixed-${crypto.randomUUID()}@Example.com` })).rejects.toThrow();
});

describe("ensureFirstAdmin", () => {
  type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
  class Rollback extends Error {}

  // "No admin exists" is global and fairspace_test is shared by all worktrees,
  // so each test demotes every admin inside a transaction that always rolls back.
  async function withNoAdmin(fn: (tx: Tx) => Promise<void>) {
    await expect(
      getDb().transaction(async (tx) => {
        await tx.update(users).set({ role: "editor" }).where(eq(users.role, "admin"));
        await fn(tx);
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);
  }

  const adminEmail = () => `admin-${crypto.randomUUID()}@example.com`;
  const rowsFor = (tx: Tx, email: string) =>
    tx.select({ email: users.email, role: users.role }).from(users).where(eq(users.email, email));

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("creates the admin, lower case, when no admin exists", async () => {
    const email = adminEmail();
    vi.stubEnv("ADMIN_EMAIL", ` ${email.toUpperCase()} `);
    await withNoAdmin(async (tx) => {
      await ensureFirstAdmin(email.toUpperCase(), tx);
      expect(await rowsFor(tx, email)).toEqual([{ email, role: "admin" }]);
    });
  });

  test("makes no second admin", async () => {
    const first = adminEmail();
    const second = adminEmail();
    await withNoAdmin(async (tx) => {
      await tx.insert(users).values({ email: first, role: "admin" });
      vi.stubEnv("ADMIN_EMAIL", second);
      await ensureFirstAdmin(second, tx);
      expect(await rowsFor(tx, second)).toEqual([]);
    });
  });

  test("does nothing for another email", async () => {
    const other = adminEmail();
    vi.stubEnv("ADMIN_EMAIL", adminEmail());
    await withNoAdmin(async (tx) => {
      await ensureFirstAdmin(other, tx);
      expect(await rowsFor(tx, other)).toEqual([]);
    });
  });

  test.each([
    ["empty", ""],
    ["unset", undefined],
  ])("does nothing when ADMIN_EMAIL is %s", async (_, value) => {
    vi.stubEnv("ADMIN_EMAIL", value);
    await withNoAdmin(async (tx) => {
      // An empty email equals an empty ADMIN_EMAIL, so only the guard stops a row here.
      await ensureFirstAdmin("", tx);
      const email = adminEmail();
      await tx.insert(users).values({ email });
      await ensureFirstAdmin(email, tx);
      expect(await tx.select().from(users).where(eq(users.role, "admin"))).toEqual([]);
    });
  });

  test("promotes an existing user while no admin exists", async () => {
    const email = adminEmail();
    vi.stubEnv("ADMIN_EMAIL", email);
    await withNoAdmin(async (tx) => {
      await tx.insert(users).values({ email });
      await ensureFirstAdmin(email, tx);
      expect(await rowsFor(tx, email)).toEqual([{ email, role: "admin" }]);
    });
  });
});
