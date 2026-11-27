import { type EmbedKind, parseEmbedUrl } from "../embed-providers";

// allow-same-origin is safe: the src is always a third-party origin, never this site. Players need it for storage.
const SANDBOX: Record<EmbedKind, string> = {
  video: "allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox",
  embed:
    "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation",
};
const ALLOW: Record<EmbedKind, string> = { video: "fullscreen; picture-in-picture; encrypted-media", embed: "payment" };

/**
 * A sandboxed third-party frame. The `src` is rebuilt from the stored link at render time, so a value that skipped
 * the save check (an unsaved edit, old data) shows nothing. No hooks: safe on the server.
 */
export function EmbedFrame({ url, title, kind, height }: { url: string; title: string; kind: EmbedKind; height?: number }) {
  const src = url ? parseEmbedUrl(url, kind) : null;
  if (!src) return <></>;
  return (
    <div className="block-container my-4">
      <iframe
        src={src}
        title={title.trim() || (kind === "video" ? "Video" : "Embedded form")}
        loading="lazy"
        // Not no-referrer: YouTube refuses to play without one.
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox={SANDBOX[kind]}
        allow={ALLOW[kind]}
        className={`w-full rounded-md border-0 ${kind === "video" ? "aspect-video" : ""}`}
        style={height ? { height } : undefined}
      />
    </div>
  );
}
