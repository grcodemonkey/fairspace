import Script from "next/script";
import { type Analytics as AnalyticsSetting, validAnalytics } from "@/analytics";

// Public pages only: this renders in the (site) layout, never in /admin, /sign-in, or the editor.
// The hosts and templates are fixed here; the admin supplies only an ID that passed the regex in the action, the DB, and again below.
export function Analytics({ analytics }: { analytics: AnalyticsSetting | null }) {
  const valid = analytics && validAnalytics(analytics.provider, analytics.id);
  if (!valid) return null;
  if (valid.provider === "plausible") {
    return <Script src="https://plausible.io/js/script.js" data-domain={valid.id} strategy="afterInteractive" />;
  }
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(valid.id)}`} strategy="afterInteractive" />
      <Script id="ga-config" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config",${JSON.stringify(valid.id)});`}
      </Script>
    </>
  );
}
