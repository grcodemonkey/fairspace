// @vitest-environment node
import type { Session } from "next-auth";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { auth } from "./auth";
import { requireAdmin, requireUser } from "./guards";

vi.mock("./auth", () => ({ auth: vi.fn() }));

// next build sets this from experimental.authInterrupts; without it forbidden() throws a plain Error.
vi.stubEnv("__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS", "true");

const signedInAs = (role: "admin" | "editor") => {
  const session: Session = { user: { email: `${role}@example.com`, role }, expires: "" };
  vi.mocked(auth as () => Promise<Session | null>).mockResolvedValue(session);
  return session.user;
};

// Digest formats from next/dist/client/components/redirect.js and forbidden.js.
const REDIRECT_TO_SIGN_IN = /^NEXT_REDIRECT;\w+;\/sign-in;307;$/;
const FORBIDDEN = "NEXT_HTTP_ERROR_FALLBACK;403";

beforeEach(() => {
  vi.mocked(auth as () => Promise<Session | null>).mockResolvedValue(null);
});

describe.each([
  ["requireUser", requireUser],
  ["requireAdmin", requireAdmin],
])("%s", (_, guard) => {
  test("guard-no-session-redirects", async () => {
    await expect(guard()).rejects.toMatchObject({ digest: expect.stringMatching(REDIRECT_TO_SIGN_IN) });
  });
});

test("guard-editor-passes-user", async () => {
  const user = signedInAs("editor");
  await expect(requireUser()).resolves.toEqual(user);
});

test("guard-editor-forbidden-admin", async () => {
  signedInAs("editor");
  await expect(requireAdmin()).rejects.toMatchObject({ digest: FORBIDDEN });
});

test("guard-admin-passes", async () => {
  const user = signedInAs("admin");
  await expect(requireAdmin()).resolves.toEqual(user);
});
