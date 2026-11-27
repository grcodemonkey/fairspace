import { type EmbedKind, parseEmbedUrl } from "../embed-providers";

// allow-same-origin is safe: the src is always a third-party origin, never this site. Players need it for storage.
const SANDBOX: Record<EmbedKind, string> = {
  video: "allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox",
  embed: "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox",
};

/**
 * A sandboxed third-party frame. The `src` is rebuilt from the stored link at render time, so a value that skipped
 * the save check (an unsaved edit, old data) shows nothing. No hooks: safe on the server.
 */
export function EmbedFrame({ url, title, kind, height }: { url: string; title: string; kind: EmbedKind; height?: number }) {
  const src = url ? parseEmbedUrl(url, kind) : null;
  if (!src) return <></>;
  // Only Donorbox takes card payments inside its frame. `src` comes from a fixed template, so the prefix check is exact.
  const allow =
    kind === "video" ? "fullscreen; picture-in-picture; encrypted-media" : src.startsWith("https://donorbox.org/") ? "payment" : undefined;
  return (
    <div className="block-container my-4">
      <iframe
        src={src}
        title={title}
        loading="lazy"
        // Not no-referrer: YouTube refuses to play without one.
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox={SANDBOX[kind]}
        allow={allow}
        className={`w-full rounded-md border-0 ${kind === "video" ? "aspect-video" : ""}`}
        style={height ? { height } : undefined}
      />
    </div>
  );
}
