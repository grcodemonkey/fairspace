// No imports: the action, the site layout, and the tests share these. The DB check constraint copies the patterns.
export const ANALYTICS_PROVIDERS = ["plausible", "google"] as const;
export type AnalyticsProvider = (typeof ANALYTICS_PROVIDERS)[number];
export type Analytics = { provider: AnalyticsProvider; id: string };

export const isAnalyticsProvider = (value: unknown): value is AnalyticsProvider =>
  ANALYTICS_PROVIDERS.includes(value as AnalyticsProvider);

/** Plausible site domain, lower-case. */
export const PLAUSIBLE_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
export const PLAUSIBLE_DOMAIN_MAX = 253;
/** Google Analytics 4 measurement ID, upper-case. */
export const GOOGLE_ID = /^G-[A-Z0-9]{4,20}$/;

/** The provider and ID when both are valid, else null. Strict: the ID is put into a script tag. */
export function validAnalytics(provider: unknown, id: unknown): Analytics | null {
  if (typeof id !== "string") return null;
  if (provider === "plausible" && id.length <= PLAUSIBLE_DOMAIN_MAX && PLAUSIBLE_DOMAIN.test(id)) return { provider, id };
  if (provider === "google" && GOOGLE_ID.test(id)) return { provider, id };
  return null;
}
