// No imports: next.config.ts reads EMBED_FRAME_ORIGINS for its CSP header.

export type EmbedKind = "video" | "embed";

type Provider = { kind: EmbedKind; hosts: string[]; toSrc: (url: URL) => string | null };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const youtube: Provider = {
  kind: "video",
  hosts: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"],
  toSrc: (url) => {
    const path =
      url.hostname === "youtu.be"
        ? url.pathname.match(/^\/([^/]+)$/)
        : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/);
    const id = path?.[1] ?? (url.pathname === "/watch" ? url.searchParams.get("v") : null);
    // "videoseries" is a playlist path, not a video id, and it is 11 characters long.
    return id && id !== "videoseries" && YOUTUBE_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  },
};

const vimeo: Provider = {
  kind: "video",
  hosts: ["vimeo.com", "www.vimeo.com", "player.vimeo.com"],
  toSrc: (url) => {
    // Unlisted videos have a hash: vimeo.com/<id>/<hash> or player.vimeo.com/video/<id>?h=<hash>.
    const match =
      url.hostname === "player.vimeo.com"
        ? url.pathname.match(/^\/video\/(\d{1,12})$/)
        : url.pathname.match(/^\/(\d{1,12})(?:\/([0-9a-f]{1,32}))?$/);
    if (!match) return null;
    const hash = match[2] ?? url.searchParams.get("h");
    if (hash !== null && !/^[0-9a-f]{1,32}$/.test(hash)) return null;
    return `https://player.vimeo.com/video/${match[1]}?dnt=1${hash ? `&h=${hash}` : ""}`;
  },
};

const googleForms: Provider = {
  kind: "embed",
  hosts: ["docs.google.com"],
  toSrc: (url) => {
    const id = url.pathname.match(/^\/forms\/d\/e\/([A-Za-z0-9_-]{1,200})\/viewform$/)?.[1];
    return id ? `https://docs.google.com/forms/d/e/${id}/viewform?embedded=true` : null;
  },
};

const donorbox: Provider = {
  kind: "embed",
  hosts: ["donorbox.org", "www.donorbox.org"],
  toSrc: (url) => {
    // Only the documented embed link: a bare donorbox.org/<path> can be any site page (/login, /pricing).
    const slug = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{1,100})$/)?.[1];
    return slug ? `https://donorbox.org/embed/${slug}` : null;
  },
};

const PROVIDERS = [youtube, vimeo, googleForms, donorbox];

/** The origins the built `src` values use. The site CSP allows frames from these only. */
export const EMBED_FRAME_ORIGINS = [
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://docs.google.com",
  "https://donorbox.org",
];

export const EMBED_HINT: Record<EmbedKind, string> = {
  video: "must be a YouTube or Vimeo video link (https://)",
  embed:
    "must be a Google Forms link (https://docs.google.com/forms/d/e/…/viewform) or a Donorbox embed link (https://donorbox.org/embed/…)",
};

/**
 * Turns a pasted page link into an iframe `src` from a fixed template, or null.
 * The pasted string is never the `src`: only an id that passed a strict pattern goes into the template.
 */
export function parseEmbedUrl(value: string, kind: EmbedKind): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  // https only, no userinfo, no custom port. `hostname` is lowercased by the parser, so the match is exact.
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const provider = PROVIDERS.find((p) => p.kind === kind && p.hosts.includes(url.hostname));
  return provider ? provider.toSrc(url) : null;
}
