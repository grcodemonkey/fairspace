// @vitest-environment node
import type { Session } from "next-auth";
import { expect, test, vi } from "vitest";
import { auth, signIn } from "@/auth";
import { changeRole, inviteUser, removeUser } from "@/users";
import { changeRoleAction, inviteAction, removeAction } from "./actions";

vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn() }));
vi.mock("@/users", () => ({ changeRole: vi.fn(), inviteUser: vi.fn(), removeUser: vi.fn() }));

// next build sets this from experimental.authInterrupts; without it forbidden() throws a plain Error.
vi.stubEnv("__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS", "true");

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

test.each([
  ["inviteAction", () => inviteAction({}, form({ email: "new@example.com", role: "editor" }))],
  ["changeRoleAction", () => changeRoleAction({}, form({ id: "some-id", role: "admin" }))],
  ["removeAction", () => removeAction({}, form({ id: "some-id" }))],
])("actions-require-admin: %s", async (_, run) => {
  const session: Session = { user: { email: "editor@example.com", role: "editor" }, expires: "" };
  vi.mocked(auth as () => Promise<Session | null>).mockResolvedValue(session);
  await expect(run()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;403" });
  for (const fn of [inviteUser, changeRole, removeUser, signIn]) expect(fn).not.toHaveBeenCalled();
});
