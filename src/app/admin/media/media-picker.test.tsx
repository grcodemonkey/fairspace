import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import type { MediaItem } from "@/media";
import { listMediaAction } from "./actions";
import { MediaPicker } from "./media-picker";

vi.mock("./actions", () => ({ listMediaAction: vi.fn(), createUpload: vi.fn(), finishUpload: vi.fn() }));

const bike: MediaItem = {
  id: "0b5c6a52-3f43-4a8e-9a39-1e0b0f6c1d11",
  filename: "bike.png",
  contentType: "image/png",
  size: 100,
  alt: "A red bike",
  url: "/media/0b5c6a52-3f43-4a8e-9a39-1e0b0f6c1d11.png",
};

beforeAll(() => {
  // jsdom has no modal dialog.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("picker-lists-and-picks", async () => {
  vi.mocked(listMediaAction).mockResolvedValue([bike]);
  const onChange = vi.fn();
  render(<MediaPicker value={null} onChange={onChange} />);
  expect(screen.getByText("None chosen.")).toBeTruthy();
  expect(listMediaAction).not.toHaveBeenCalled(); // nothing to show until it opens

  fireEvent.click(screen.getByRole("button", { name: "Choose media" }));
  fireEvent.click(await screen.findByRole("button", { name: /bike\.png/ }));
  expect(onChange).toHaveBeenCalledWith(bike);
});

test("picker-images-only", async () => {
  vi.mocked(listMediaAction).mockResolvedValue([]);
  const { unmount } = render(<MediaPicker value={null} onChange={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Choose media" }));
  expect(await screen.findByText("No media yet.")).toBeTruthy();
  expect(listMediaAction).toHaveBeenLastCalledWith({ imagesOnly: true });
  unmount();

  render(<MediaPicker value={null} onChange={() => {}} imagesOnly={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Choose media" }));
  expect(listMediaAction).toHaveBeenLastCalledWith({ imagesOnly: false });
});

test("picker-remove", async () => {
  vi.mocked(listMediaAction).mockResolvedValue([bike]);
  const onChange = vi.fn();
  render(<MediaPicker value={bike.id} onChange={onChange} />);
  // The current choice loads its filename and thumbnail.
  // Role queries skip the closed dialog's list, so this is the current-choice thumbnail.
  expect(await screen.findByRole("img", { name: "A red bike" })).toBeTruthy();
  expect(screen.queryByText("None chosen.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  expect(onChange).toHaveBeenCalledWith(null);
});
