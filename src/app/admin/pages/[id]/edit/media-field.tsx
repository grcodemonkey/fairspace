"use client";

import type { FieldProps } from "@puckeditor/core";
import { MediaPicker } from "@/app/admin/media/media-picker";

/** The editor's render for the `media` field type (see `mediaField` in puck/fields.ts). Register it in `overrides.fieldTypes`. */
export function MediaFieldRender({ field, value, onChange, readOnly }: FieldProps<{ label?: string }, string | null>) {
  return (
    <fieldset disabled={readOnly} className="contents">
      <MediaPicker value={value ?? null} onChange={(item) => onChange(item?.id ?? null)} label={field.label} />
    </fieldset>
  );
}
