// @vitest-environment node
import { sql } from "drizzle-orm";
import { expect, test } from "vitest";
import { db } from "./index";

test("tests run against the test database", async () => {
  const [row] = await db.execute<{ current_database: string }>(sql`select current_database()`);
  expect(row.current_database).toBe("fairspace_test");
});

test("migrations ran", async () => {
  const rows = await db.execute(sql`select 1 from drizzle.__drizzle_migrations`);
  expect(rows.length).toBeGreaterThanOrEqual(1);
});
