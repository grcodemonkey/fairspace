import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Page from "./page";

test("home page shows the Fairspace heading", () => {
  render(<Page />);
  expect(screen.getByRole("heading", { level: 1, name: "Fairspace" })).toBeDefined();
});
