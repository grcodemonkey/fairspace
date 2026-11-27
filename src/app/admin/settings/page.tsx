import { Suspense } from "react";
import { requireAdmin } from "@/guards";
import { getSiteSettings } from "@/site-settings";
import { BrandForm } from "./brand-form";
import { SeoForm } from "./seo-form";

// One page, one section per setting area (#18 Brand; #20 Analytics and #16 SEO add theirs).
export default function SettingsPage() {
  return (
    <main className="p-8">
      <Suspense fallback={<p>Loading…</p>}>
        <SettingsAdmin />
      </Suspense>
    </main>
  );
}

// Guard first, in the same Suspense child that reads the settings.
async function SettingsAdmin() {
  await requireAdmin();
  const settings = await getSiteSettings();
  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Settings</h1>
      <div className="flex flex-col gap-10">
        <BrandForm settings={settings} />
        <SeoForm settings={settings} />
      </div>
    </>
  );
}
