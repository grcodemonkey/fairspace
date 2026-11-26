import { expect, test, vi } from "vitest";
import { resolveSlug } from "./page";

// Vitest loads Puck's browser entry (needs ResizeObserver); Next loads the react-server entry.
vi.mock("@puckeditor/core", () => ({ Render: () => null }));

test("resolve-slug-cases", () => {
  expect(resolveSlug(undefined)).toBe("home");
  expect(resolveSlug(["about"])).toBe("about");
  expect(resolveSlug(["a", "b"])).toBeNull();
  expect(resolveSlug(["_"])).toBeNull();
  expect(resolveSlug(["About"])).toBeNull();
});
