"use client";

import { useActionState, useState } from "react";
import { DARK_BG, FONTS, LIGHT_BG, onColor, SITE_NAME_MAX } from "@/brand";
import type { SiteSettings } from "@/site-settings";
import { MediaPicker } from "../media/media-picker";
import { saveBrandAction } from "./actions";

// Controlled fields: a refused save keeps what the admin typed (React resets uncontrolled fields after an action).
export function BrandForm({ settings }: { settings: SiteSettings }) {
  const [state, action, pending] = useActionState(saveBrandAction, {});
  const [siteName, setSiteName] = useState(settings.siteName);
  const [logoId, setLogoId] = useState(settings.logo?.id ?? null);
  const [light, setLight] = useState(settings.primaryLight);
  const [dark, setDark] = useState(settings.primaryDark);
  const [font, setFont] = useState<string>(settings.font);

  const color = (id: string, label: string, value: string, set: (v: string) => void, background: string) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id}>{label}</label>
      <div className="flex items-center gap-3">
        <input id={id} name={id} type="color" value={value} onChange={(e) => set(e.target.value)} className="h-10 w-16" />
        {/* A preview of the button and a link on that scheme's page background. */}
        <span className="flex items-center gap-3 rounded border px-3 py-2" style={{ background }}>
          <span className="rounded px-2 py-1 font-semibold" style={{ background: value, color: onColor(value) }}>
            Button
          </span>
          <span className="underline" style={{ color: value }}>
            Link
          </span>
        </span>
      </div>
    </div>
  );

  return (
    <form action={action} id="brand" className="flex flex-col gap-5 items-start max-w-xl">
      <h2 className="text-xl font-bold">Brand</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="siteName">Site name</label>
        <input
          id="siteName"
          name="siteName"
          required
          maxLength={SITE_NAME_MAX}
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          className="border rounded px-3 py-2 w-80"
        />
      </div>
      <MediaPicker label="Logo" value={logoId} onChange={(item) => setLogoId(item?.id ?? null)} />
      <input type="hidden" name="logoId" value={logoId ?? ""} />
      {color("primaryLight", "Primary color, light mode", light, setLight, LIGHT_BG)}
      {color("primaryDark", "Primary color, dark mode", dark, setDark, DARK_BG)}
      <p className="text-sm">Each color needs 4.5:1 contrast on its page background (WCAG AA).</p>
      <div className="flex flex-col gap-1">
        <label htmlFor="font">Font</label>
        <select id="font" name="font" value={font} onChange={(e) => setFont(e.target.value)} className="border rounded px-3 py-2">
          {Object.entries(FONTS).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" disabled={pending} className="border rounded px-3 py-2 font-semibold">
        Save brand
      </button>
      <p role="status" className={state.error ? "text-danger" : ""}>
        {state.error ?? state.message}
      </p>
    </form>
  );
}
