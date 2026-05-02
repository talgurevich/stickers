// Countries we ship to. The list is the source of truth for the cart's
// country picker AND the pricing table — both consult `SUPPORTED_COUNTRIES`,
// so adding/removing a country is one edit (plus a re-run of
// scripts/quote-prodigi-by-country.mjs to refresh shipping costs).
//
// Order matters: it determines the order in the dropdown, with IL pinned
// first as the default and most common destination.

export type CountryCode =
  | "IL"
  | "US"
  | "GB"
  | "DE"
  | "FR"
  | "IT"
  | "ES"
  | "CA"
  | "AU"
  | "TH";

type CountryEntry = {
  code: CountryCode;
  /** Hebrew display name. */
  he: string;
  /** English display name (used in admin/owner emails). */
  en: string;
  /** Display flag emoji. */
  flag: string;
};

export const SUPPORTED_COUNTRIES: CountryEntry[] = [
  { code: "IL", he: "ישראל", en: "Israel", flag: "🇮🇱" },
  { code: "US", he: "ארצות הברית", en: "United States", flag: "🇺🇸" },
  { code: "GB", he: "בריטניה", en: "United Kingdom", flag: "🇬🇧" },
  { code: "DE", he: "גרמניה", en: "Germany", flag: "🇩🇪" },
  { code: "FR", he: "צרפת", en: "France", flag: "🇫🇷" },
  { code: "IT", he: "איטליה", en: "Italy", flag: "🇮🇹" },
  { code: "ES", he: "ספרד", en: "Spain", flag: "🇪🇸" },
  { code: "CA", he: "קנדה", en: "Canada", flag: "🇨🇦" },
  { code: "AU", he: "אוסטרליה", en: "Australia", flag: "🇦🇺" },
  { code: "TH", he: "תאילנד", en: "Thailand", flag: "🇹🇭" },
];

const SUPPORTED_SET = new Set<string>(
  SUPPORTED_COUNTRIES.map((c) => c.code),
);

export function isSupportedCountry(code: unknown): code is CountryCode {
  return typeof code === "string" && SUPPORTED_SET.has(code);
}

export function countryEntry(code: CountryCode): CountryEntry {
  // Safe: the type narrows to the supported set, so the find always hits.
  return SUPPORTED_COUNTRIES.find((c) => c.code === code)!;
}
