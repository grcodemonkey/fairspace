import { render, screen } from "@testing-library/react";
import { test } from "vitest";
import Page from "./page";

test("home page shows the Fairspace heading", () => {
  render(<Page />);
  // getByRole throws when the heading is missing
  screen.getByRole("heading", { level: 1, name: "Fairspace" });
});
