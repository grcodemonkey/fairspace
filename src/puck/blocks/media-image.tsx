import type { PuckContext } from "@puckeditor/core";
import Image from "next/image";
import type { MediaMap } from "@/media";

/** The URL and alt of a media id from the page's media map (`<Render metadata={{ media }}>`), or undefined. */
export const mediaMeta = (puck: PuckContext, id: string | null | undefined) =>
  id ? (puck.metadata.media as MediaMap | undefined)?.[id] : undefined;

/**
 * A library image for a block. Sync and hook-free, so it renders on the server.
 * No image (none chosen, deleted, or not an image): nothing on the public page, a placeholder in the editor.
 * `crop`: a fixed 4:3 box (cards); else the natural aspect ratio at full width.
 */
export function MediaImage({ id, puck, sizes, crop }: { id: string | null; puck: PuckContext; sizes: string; crop?: boolean }) {
  const meta = mediaMeta(puck, id);
  if (!meta) {
    if (!puck.isEditing) return null;
    return (
      <div className={`flex items-center justify-center bg-gray-200 p-4 text-center text-gray-800 ${crop ? "aspect-[4/3]" : "min-h-40"}`}>
        {id ? "This image was deleted. Choose another." : "Choose an image"}
      </div>
    );
  }
  const alt = meta.alt ?? "";
  return (
    <>
      {crop ? (
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image src={meta.url} alt={alt} fill sizes={sizes} className="object-cover" />
        </div>
      ) : (
        // shortcut: no stored width/height, so no reserved space (layout shift); add dimensions to the media table if CLS matters.
        <Image src={meta.url} alt={alt} width={0} height={0} sizes={sizes} className="h-auto w-full" />
      )}
      {puck.isEditing && meta.alt === null && (
        <p className="mt-1 text-sm text-danger">No alt text. Add it in the media library.</p>
      )}
    </>
  );
}
