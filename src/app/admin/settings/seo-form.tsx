"use client";

import { useActionState, useState } from "react";
import { SEO_DESCRIPTION_MAX } from "@/puck/seo";
import type { SiteSettings } from "@/site-settings";
import { MediaPicker } from "../media/media-picker";
import { saveSeoAction } from "./actions";

export function SeoForm({ settings }: { settings: SiteSettings }) {
  const [state, action, pending] = useActionState(saveSeoAction, {});
  const [description, setDescription] = useState(settings.defaultDescription ?? "");
  const [imageId, setImageId] = useState(settings.defaultShareImage?.id ?? null);

  return (
    <form action={action} id="search-and-sharing" className="flex flex-col gap-5 items-start max-w-xl">
      <h2 className="text-xl font-bold">Search and sharing</h2>
      <p className="text-sm">Pages with no description or share image of their own use these.</p>
      <div className="flex flex-col gap-1">
        <label htmlFor="defaultDescription">Default description (about 160 characters)</label>
        <textarea
          id="defaultDescription"
          name="defaultDescription"
          rows={3}
          maxLength={SEO_DESCRIPTION_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border rounded px-3 py-2 w-96"
        />
      </div>
      <MediaPicker label="Default share image" value={imageId} onChange={(item) => setImageId(item?.id ?? null)} />
      <input type="hidden" name="defaultShareImageId" value={imageId ?? ""} />
      <button type="submit" disabled={pending} className="border rounded px-3 py-2 font-semibold">
        Save search and sharing
      </button>
      <p role="status" className={state.error ? "text-red-700" : ""}>
        {state.error ?? state.message}
      </p>
    </form>
  );
}
