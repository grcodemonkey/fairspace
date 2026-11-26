// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";
import { isKnownEmail } from "./auth";
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

test("the lookup ignores case", async () => {
  expect(await isKnownEmail(email.toUpperCase())).toBe(true);
});
