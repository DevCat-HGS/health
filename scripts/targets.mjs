// What the monitor checks. A page counts as up only when it answers 200 *and* its HTML holds the expected text, so
// an error page served with a 200 is still a failure. The list is fixed in code: visitors cannot add URLs, so the
// monitor can never be pointed at anything else.
export const TARGETS = [
  { id: "home", group: "site", name: { es: "Portada", en: "Home" }, url: "https://hgsportafolio.site/", expect: "Harol Guerrero Salgado" },
  { id: "home-en", group: "site", name: { es: "Portada en inglés", en: "Home in English" }, url: "https://hgsportafolio.site/en/", expect: "Full Stack Developer" },
  { id: "migozz", group: "cases", name: { es: "Caso MIGOZZ", en: "MIGOZZ case" }, url: "https://hgsportafolio.site/migozz/", expect: "MIGOZZ" },
  { id: "aria", group: "cases", name: { es: "Caso ARIA", en: "ARIA case" }, url: "https://hgsportafolio.site/aria/", expect: "ARIA" },
  { id: "devpanel", group: "cases", name: { es: "Caso DevPanel", en: "DevPanel case" }, url: "https://hgsportafolio.site/devpanel/", expect: "DevPanel" },
  { id: "portafolio", group: "cases", name: { es: "Caso del portafolio", en: "Portfolio case" }, url: "https://hgsportafolio.site/portafolio/", expect: "Portafolio HGS" },
  { id: "docs", group: "support", name: { es: "Documentación", en: "Docs" }, url: "https://docs.hgsportafolio.site/", expect: "El Andén" },
  // This page watches itself too: a 404 on its own domain is an incident like any other.
  { id: "health", group: "support", name: { es: "Esta página", en: "This page" }, url: "https://health.hgsportafolio.site/", expect: "health.hgsportafolio.site" },
];

/** Pages audited once a day with Lighthouse and the security checks. */
export const AUDITED = "https://hgsportafolio.site/";

/** Domains whose TLS certificate is checked daily. */
export const DOMAINS = ["hgsportafolio.site", "docs.hgsportafolio.site", "health.hgsportafolio.site"];
