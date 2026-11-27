"use client";

import type { FieldProps } from "@puckeditor/core";
import { createContext, useContext } from "react";
import { MediaPicker } from "@/app/admin/media/media-picker";
import type { MediaItem } from "@/media";

/** The editor adds a picked image to its media map, so the preview shows it before any save. */
export const RememberMediaContext = createContext<((item: MediaItem) => void) | null>(null);

/** The editor's render for the `media` field type (see `mediaField` in puck/fields.ts). Register it in `overrides.fieldTypes`. */
export function MediaFieldRender({ field, value, onChange, readOnly }: FieldProps<{ label?: string }, string | null>) {
  const remember = useContext(RememberMediaContext);
  return (
    <fieldset disabled={readOnly} className="contents">
      <MediaPicker value={value ?? null} onChange={(item) => {
          if (item) remember?.(item);
          onChange(item?.id ?? null);
        }} label={field.label} />
    </fieldset>
  );
}
