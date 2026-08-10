export const SITE_ORIGIN = "https://runtimejs.vercel.app";
export const SITE_TITLE = "runtime.js — an interactive tour of JavaScript itself";
export const SITE_DESCRIPTION =
  "A DevTools-styled walk through JavaScript's eras, with a real sandboxed REPL and an event loop visualizer driven by actual instrumentation of your code.";

export function siteTitle(extra?: string): string {
  return extra ? `${extra} — runtime.js` : SITE_TITLE;
}

/** JSON-LD (schema.org WebSite) for the root page. */
export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "runtime.js",
    url: `${SITE_ORIGIN}/`,
    description: SITE_DESCRIPTION,
    inLanguage: "en",
  };
}

/** JSON-LD (schema.org CollectionPage) for an era route. */
export function eraPageJsonLd(era: { id: string; label: string; years: string; summary: string }): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${era.label} (${era.years})`,
    url: `${SITE_ORIGIN}/era/${era.id}`,
    description: era.summary,
    inLanguage: "en",
    isPartOf: {
      "@type": "WebSite",
      name: "runtime.js",
      url: `${SITE_ORIGIN}/`,
    },
  };
}

/** JSON-LD (schema.org TechArticle) for a concept route. */
export function conceptPageJsonLd(era: { id: string }, concept: { id: string; name: string; blurb: string }): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: concept.name,
    description: concept.blurb,
    url: `${SITE_ORIGIN}/era/${era.id}/${concept.id}`,
    inLanguage: "en",
    isPartOf: {
      "@type": "CollectionPage",
      url: `${SITE_ORIGIN}/era/${era.id}`,
    },
  };
}
