"use client";

import { type FormEvent, startTransition, useActionState, useState } from "react";
import type { AnalyticsProvider } from "@/analytics";
import type { SiteSettings } from "@/site-settings";
import { saveAnalyticsAction } from "./actions";

const ID_LABEL = { plausible: "Site domain, like example.org", google: "Measurement ID, like G-XXXXXXXXXX" } as const;

export function AnalyticsForm({ settings }: { settings: SiteSettings }) {
  const [state, action, pending] = useActionState(saveAnalyticsAction, {});
  const [provider, setProvider] = useState<AnalyticsProvider | "">(settings.analytics?.provider ?? "");
  const [id, setId] = useState(settings.analytics?.id ?? "");

  // Not `<form action>` like brand-form and seo-form: React 19 calls form.reset() after the action. That puts the
  // controlled select back on its first option ("None") while the state still says "google", so after a refused ID
  // the form would look cleared. e2e analytics-public-only checks the select keeps its value after an error.
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };

  return (
    <form onSubmit={submit} id="analytics" className="flex flex-col gap-5 items-start max-w-xl">
      <h2 className="text-xl font-bold">Analytics</h2>
      <p className="text-sm">
        The script loads on public pages only, and only when a provider is chosen. Plausible sets no cookies. Google
        Analytics sets cookies: where the law requires consent (for example the EU and UK), you must get it. Fairspace has
        no consent banner.
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor="analyticsProvider">Provider</label>
        <select
          id="analyticsProvider"
          name="analyticsProvider"
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value as AnalyticsProvider | "");
            setId(""); // a domain is not a measurement ID
          }}
          className="border rounded px-3 py-2 w-96"
        >
          <option value="">None</option>
          <option value="plausible">Plausible (no cookies)</option>
          <option value="google">Google Analytics</option>
        </select>
      </div>
      {provider && (
        <div className="flex flex-col gap-1">
          <label htmlFor="analyticsId">{ID_LABEL[provider]}</label>
          <input
            id="analyticsId"
            name="analyticsId"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className="border rounded px-3 py-2 w-96"
          />
        </div>
      )}
      <button type="submit" disabled={pending} className="border rounded px-3 py-2 font-semibold">
        Save analytics
      </button>
      <p role="status" className={state.error ? "text-red-700" : ""}>
        {state.error ?? state.message}
      </p>
    </form>
  );
}
