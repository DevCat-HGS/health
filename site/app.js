// Renders the health page from the JSON the monitor writes (data/status.json, lighthouse.json, security.json).
// Data is only ever set as text, never as HTML. Anything missing or old is shown as such, never as a pass.
"use strict";

const REPO = "https://github.com/DevCat-HGS/health";
// Older than this, a block is flagged as out of date: twice the uptime interval, and a day and a half for the audit.
const STALE_UPTIME_MS = 2 * 3600 * 1000;
const STALE_DAILY_MS = 36 * 3600 * 1000;

const T = {
  es: {
    skip: "Saltar al contenido",
    kicker: "Centro de confianza técnica",
    title1: "Comprobado,",
    title2: "no prometido.",
    lede: "Esta página no la escribo yo: la llenan comprobaciones automáticas cada 30 minutos y una auditoría diaria contra producción, desde un repositorio público. Cada cifra trae su fecha y enlaza a la medición que la produjo. Lo que no se midió dice «No evaluado».",
    uptimeTitle: "Disponibilidad",
    uptimeExplain: "Una página cuenta como arriba solo si responde 200 y su HTML trae el texto esperado: una página de error que responda 200 sigue siendo una caída. Si falla, se vuelve a probar a los 10 segundos antes de contarla.",
    legendUp: "Todo el día arriba",
    legendPartial: "Alguna caída",
    legendDown: "Caída la mayor parte del día",
    legendNone: "Sin mediciones",
    incidentsTitle: "Incidentes",
    perfTitle: "Rendimiento",
    perfExplain: "Datos de laboratorio: Lighthouse en Chrome, en un servidor de GitHub, contra la portada en producción. Tres corridas por perfil y se muestra la mediana. El perfil móvil simula un teléfono lento con red 4G lenta.",
    fieldTitle: "Usuarios reales",
    fieldExplain: "Las métricas de usuarios reales (el informe CrUX de Chrome, e INP, que solo se mide con personas de verdad) necesitan un volumen de visitas que el sitio todavía no tiene. No se mezclan con las de laboratorio ni se inventan.",
    secTitle: "Seguridad observable",
    secExplain: "Solo lo que cualquiera puede comprobar desde fuera, como lo haría un navegador. No se publican versiones, valores completos de cabeceras ni nada que ayude a un ataque.",
    qTitle: "Accesibilidad y calidad",
    qExplain: "Una prueba automática que pasa no certifica accesibilidad completa ni ausencia de errores: detecta los problemas que una máquina puede ver.",
    evTitle: "Evidencias",
    mTitle: "Método y límites",
    notEvaluated: "No evaluado",
    pass: "Aprobado",
    fail: "Fallido",
    stale: "Desactualizado",
    up: "Arriba",
    down: "Caída",
    noData: "Sin datos todavía",
    lastCheck: "Última comprobación",
    lastAudit: "Última auditoría",
    every30: "cada 30 min",
    daily: "una vez al día",
    latency: "Respuesta",
    h24: "24 h",
    d7: "7 días",
    d30: "30 días",
    days90: "Últimos 90 días, en días de Bogotá",
    noIncidents: "Sin incidentes en los últimos 90 días.",
    ongoing: "en curso",
    samples: (n) => `${n} ${n === 1 ? "comprobación fallida" : "comprobaciones fallidas"}`,
    why: { status: "código de error", content: "200 sin el contenido esperado", timeout: "sin respuesta en 15 s", network: "error de red" },
    allIncidents: "Historial completo de incidentes (issues públicos)",
    mobile: "Móvil",
    desktop: "Escritorio",
    performance: "Rendimiento",
    accessibility: "Accesibilidad",
    "best-practices": "Buenas prácticas",
    seo: "SEO",
    runs: (n) => `mediana de ${n} ${n === 1 ? "corrida" : "corridas"}`,
    report: "Ver la corrida y sus informes",
    trend: (n) => `Rendimiento en las últimas ${n} auditorías`,
    actions: [
      ["Ver el código del monitor", REPO, "primary"],
      ["Ver los datos en bruto", `${REPO}/tree/main/data`],
      ["Ver los logs de cada medición", `${REPO}/actions`],
    ],
    stripUptime: "Disponibilidad",
    stripPerf: "Rendimiento (laboratorio)",
    stripSec: "Seguridad observable",
    stripCi: "CI del repositorio",
    upOf: (a, b) => `${a} de ${b} páginas arriba`,
    passOf: (a, b) => `${a} de ${b} controles aprobados`,
    perfValue: (m, d) => `móvil ${m} · escritorio ${d}`,
    ciLater: "Llega en la siguiente fase",
    checks: {
      hsts: ["HTTPS obligatorio (HSTS)", "El navegador recuerda usar siempre HTTPS durante al menos 180 días."],
      csp: ["Política de seguridad de contenido", "Existe una CSP con default-src y sin 'unsafe-eval'."],
      nosniff: ["Tipos de archivo estrictos", "X-Content-Type-Options: nosniff."],
      frame: ["Protección contra clickjacking", "La página no se puede incrustar en otro sitio."],
      referrer: ["Política de referente", "El sitio limita qué dirección se comparte al salir."],
      permissions: ["Permisos del navegador", "Cámara, micrófono, ubicación y similares están desactivados."],
      coop: ["Aislamiento entre ventanas", "Cross-Origin-Opener-Policy presente."],
      "https-redirect": ["Redirección a HTTPS", "La versión http:// redirige a https://."],
      "security-txt": ["Contacto de seguridad (security.txt)", "Existe /.well-known/security.txt con contacto y sin vencer (RFC 9116)."],
      tls: (host) => [`Certificado de ${host}`, "Válido y con al menos 14 días antes de vencer."],
    },
    daysLeft: (n) => `vence en ${n} días`,
    q: {
      a11yLab: ["Accesibilidad en Lighthouse (portada)", "Subconjunto de reglas de axe que incluye Lighthouse, móvil y escritorio."],
      axe: ["axe completo en todas las páginas de producción", "Llega en la siguiente fase. Hoy corre en el CI del repositorio privado, en español e inglés."],
      ci: ["Pruebas unitarias y de navegador del último despliegue", "Llega en una fase posterior: el CI corre en un repositorio privado y su resumen se publicará aquí con el commit comprobado."],
    },
    ev: [
      ["Caso del portafolio", "Cómo está hecho, decisiones y lo que se rompió.", "https://hgsportafolio.site/portafolio/"],
      ["Código del sitio", "Espejo público, actualizado con cada cambio en producción.", "https://github.com/DevCat-HGS/hgsportafolio"],
      ["Documentación técnica", "Arquitectura, CI/CD, SEO y operación.", "https://docs.hgsportafolio.site"],
      ["Cómo está montado", "Dominio, DNS, hosting, HTTPS y correo, paso a paso.", "https://github.com/DevCat-HGS/hgsportafolio-infra"],
      ["Este monitor", "El código que mide y los logs de cada medición.", REPO],
      ["Mediciones en bruto", "Cada comprobación de disponibilidad, mes por mes.", `${REPO}/tree/main/data`],
      ["Incidentes", "Cada caída abre un issue público y lo cierra al recuperarse.", `${REPO}/issues?q=label%3Aincidente`],
    ],
    limits: [
      "Se mide desde un solo lugar: los servidores de GitHub Actions. Una caída que solo afecte a otra región no se vería.",
      "GitHub retrasa sus tareas programadas, a veces horas. Por eso un temporizador en Netlify le pide la medición cada 30 minutos, y el cron de GitHub queda de respaldo. Si los dos fallan, la página lo marca como «Desactualizado».",
      "Lighthouse es una prueba de laboratorio en una máquina compartida: las cifras varían de un día a otro.",
      "La seguridad publicada son controles concretos y limitados, no una auditoría ni una prueba de penetración.",
      "El panel de administración del sitio es privado y no se monitorea aquí.",
      "Esta página está en GitHub Pages, aparte de Netlify, donde vive el sitio: si el sitio cae, esta página sigue en pie para contarlo.",
    ],
    foot: (t) => `Datos generados por ${REPO.replace("https://", "")}. Última actualización: ${t}.`,
    langLabel: "EN",
    langAria: "EN · Switch to English",
    title: "Salud de hgsportafolio.site · Harol Guerrero Salgado",
  },
  en: {
    skip: "Skip to content",
    kicker: "Technical trust center",
    title1: "Checked,",
    title2: "not promised.",
    lede: "I do not write this page: automated checks every 30 minutes and a daily audit of production fill it, from a public repository. Every figure carries its date and links to the measurement behind it. Anything not measured says “Not evaluated”.",
    uptimeTitle: "Availability",
    uptimeExplain: "A page counts as up only if it answers 200 and its HTML holds the expected text: an error page served with a 200 is still an outage. A failure is checked again after 10 seconds before it counts.",
    legendUp: "Up all day",
    legendPartial: "Some downtime",
    legendDown: "Down most of the day",
    legendNone: "No measurements",
    incidentsTitle: "Incidents",
    perfTitle: "Performance",
    perfExplain: "Lab data: Lighthouse in Chrome, on a GitHub server, against the home page in production. Three runs per profile, median shown. The mobile profile simulates a slow phone on slow 4G.",
    fieldTitle: "Real users",
    fieldExplain: "Real-user metrics (Chrome's CrUX report, and INP, which only real people can produce) need more traffic than the site has yet. They are never mixed with lab data or made up.",
    secTitle: "Observable security",
    secExplain: "Only what anyone can check from outside, the way a browser would. No versions, no full header values and nothing that would help an attack.",
    qTitle: "Accessibility and quality",
    qExplain: "A passing automated test does not certify full accessibility or the absence of bugs: it finds what a machine can see.",
    evTitle: "Evidence",
    mTitle: "Method and limits",
    notEvaluated: "Not evaluated",
    pass: "Pass",
    fail: "Fail",
    stale: "Out of date",
    up: "Up",
    down: "Down",
    noData: "No data yet",
    lastCheck: "Last check",
    lastAudit: "Last audit",
    every30: "every 30 min",
    daily: "once a day",
    latency: "Response",
    h24: "24 h",
    d7: "7 days",
    d30: "30 days",
    days90: "Last 90 days, in Bogotá days",
    noIncidents: "No incidents in the last 90 days.",
    ongoing: "ongoing",
    samples: (n) => `${n} failed ${n === 1 ? "check" : "checks"}`,
    why: { status: "error code", content: "200 without the expected content", timeout: "no answer in 15 s", network: "network error" },
    allIncidents: "Full incident history (public issues)",
    mobile: "Mobile",
    desktop: "Desktop",
    performance: "Performance",
    accessibility: "Accessibility",
    "best-practices": "Best practices",
    seo: "SEO",
    runs: (n) => `median of ${n} ${n === 1 ? "run" : "runs"}`,
    report: "See the run and its reports",
    trend: (n) => `Performance over the last ${n} audits`,
    actions: [
      ["See the monitor's code", REPO, "primary"],
      ["See the raw data", `${REPO}/tree/main/data`],
      ["See the log of every check", `${REPO}/actions`],
    ],
    stripUptime: "Availability",
    stripPerf: "Performance (lab)",
    stripSec: "Observable security",
    stripCi: "Repository CI",
    upOf: (a, b) => `${a} of ${b} pages up`,
    passOf: (a, b) => `${a} of ${b} checks passed`,
    perfValue: (m, d) => `mobile ${m} · desktop ${d}`,
    ciLater: "Coming in the next phase",
    checks: {
      hsts: ["HTTPS enforced (HSTS)", "Browsers remember to always use HTTPS for at least 180 days."],
      csp: ["Content security policy", "A CSP with default-src and without 'unsafe-eval'."],
      nosniff: ["Strict file types", "X-Content-Type-Options: nosniff."],
      frame: ["Clickjacking protection", "The page cannot be embedded in another site."],
      referrer: ["Referrer policy", "The site limits which address is shared on the way out."],
      permissions: ["Browser permissions", "Camera, microphone, location and the like are turned off."],
      coop: ["Window isolation", "Cross-Origin-Opener-Policy is set."],
      "https-redirect": ["HTTPS redirect", "The http:// version redirects to https://."],
      "security-txt": ["Security contact (security.txt)", "/.well-known/security.txt exists, with a contact and not expired (RFC 9116)."],
      tls: (host) => [`Certificate for ${host}`, "Valid, with at least 14 days before it expires."],
    },
    daysLeft: (n) => `expires in ${n} days`,
    q: {
      a11yLab: ["Accessibility in Lighthouse (home)", "The subset of axe rules Lighthouse includes, mobile and desktop."],
      axe: ["Full axe on every production page", "Coming in the next phase. Today it runs in the private repository's CI, in Spanish and English."],
      ci: ["Unit and browser tests of the last deploy", "Coming in a later phase: CI runs in a private repository and its summary will be published here with the commit it checked."],
    },
    ev: [
      ["Portfolio case study", "How it is built, decisions and what broke.", "https://hgsportafolio.site/en/portafolio/"],
      ["Site code", "Public mirror, updated with every change that ships.", "https://github.com/DevCat-HGS/hgsportafolio"],
      ["Technical docs", "Architecture, CI/CD, SEO and operations.", "https://docs.hgsportafolio.site"],
      ["How it is hosted", "Domain, DNS, hosting, HTTPS and email, step by step (in Spanish).", "https://github.com/DevCat-HGS/hgsportafolio-infra"],
      ["This monitor", "The code that measures, and the logs of every check.", REPO],
      ["Raw measurements", "Every availability check, month by month.", `${REPO}/tree/main/data`],
      ["Incidents", "Every outage opens a public issue and closes it on recovery.", `${REPO}/issues?q=label%3Aincidente`],
    ],
    limits: [
      "Measured from one place only: GitHub Actions servers. An outage that only hits another region would not show.",
      "GitHub delays its scheduled jobs, sometimes by hours. So a timer on Netlify asks for a check every 30 minutes, with GitHub's own cron as a fallback. If both fail, the page flags the data as “Out of date”.",
      "Lighthouse is a lab test on a shared machine: figures move from one day to the next.",
      "The published security items are concrete, limited checks, not an audit or a penetration test.",
      "The site's admin panel is private and is not monitored here.",
      "This page is on GitHub Pages, apart from Netlify, where the site lives: if the site goes down, this page stays up to say so.",
    ],
    foot: (t) => `Data generated by ${REPO.replace("https://", "")}. Last update: ${t}.`,
    langLabel: "ES",
    langAria: "ES · Cambiar a español",
    title: "Health of hgsportafolio.site · Harol Guerrero Salgado",
  },
};

let lang = "es";
try {
  const saved = localStorage.getItem("lang");
  if (saved === "en" || saved === "es") lang = saved;
  else if (!saved && /^en\b/i.test(navigator.language)) lang = "en";
} catch {
  /* Storage blocked: Spanish, or the browser's language below. */
  if (/^en\b/i.test(navigator.language)) lang = "en";
}

const data = { status: null, lighthouse: null, security: null };
const $ = (id) => document.getElementById(id);

/** Small element builder: children are nodes or strings (always as text). */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}

function svg(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

const t = () => T[lang];
const fmtTime = (iso) =>
  new Intl.DateTimeFormat(lang === "es" ? "es-CO" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(iso)) + " (UTC−5)";
const fmtDay = (d) =>
  new Intl.DateTimeFormat(lang === "es" ? "es-CO" : "en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const pct = (u) => (u ? `${u.pct.toFixed(u.pct === 100 ? 0 : 2)} %` : "—");
const isStale = (iso, limit) => !iso || Date.now() - Date.parse(iso) > limit;

function state(kind, text) {
  return el("span", { class: `state ${kind}` }, text ?? t()[kind === "unknown" ? "notEvaluated" : kind]);
}

function freshness(iso, limit, cadence, label) {
  if (!iso) return [t().noData];
  const parts = [`${label}: ${fmtTime(iso)} · ${cadence}`];
  return isStale(iso, limit) ? [state("stale"), " ", ...parts] : parts;
}

function renderStrip() {
  const s = data.status;
  const lab = data.lighthouse?.at(-1);
  const sec = data.security;
  const items = [];

  if (s) {
    const up = s.targets.filter((x) => x.last.ok).length;
    items.push([t().stripUptime, t().upOf(up, s.targets.length), s.generatedAt, STALE_UPTIME_MS, "#uptime", up === s.targets.length ? "pass" : "fail"]);
  } else items.push([t().stripUptime, t().notEvaluated, null, 0, "#uptime", "unknown"]);

  if (lab && (lab.mobile || lab.desktop)) {
    items.push([t().stripPerf, t().perfValue(lab.mobile?.scores.performance ?? "—", lab.desktop?.scores.performance ?? "—"), lab.t, STALE_DAILY_MS, "#performance", null]);
  } else items.push([t().stripPerf, t().notEvaluated, null, 0, "#performance", "unknown"]);

  if (sec) {
    const evaluated = sec.checks.filter((c) => c.state !== "unknown");
    const passed = evaluated.filter((c) => c.state === "pass").length;
    items.push([t().stripSec, t().passOf(passed, sec.checks.length), sec.t, STALE_DAILY_MS, "#security", passed === evaluated.length ? "pass" : "fail"]);
  } else items.push([t().stripSec, t().notEvaluated, null, 0, "#security", "unknown"]);

  items.push([t().stripCi, t().ciLater, null, 0, "#quality", "unknown"]);

  $("strip").replaceChildren(
    ...items.map(([label, value, when, limit, href, kind]) =>
      el(
        "li",
        {},
        el("a", { href }, el("span", { class: "label" }, label)),
        el("span", { class: "value" }, kind === "unknown" ? state("unknown", value) : value),
        when ? el("span", { class: "when" }, isStale(when, limit) ? [state("stale"), " "] : null, fmtTime(when)) : null,
      ),
    ),
  );
}

function dayClass(day) {
  if (!day || !day.n) return "none";
  if (day.ok === day.n) return "up";
  return day.ok / day.n >= 0.5 ? "partial" : "down";
}

function renderUptime() {
  const s = data.status;
  if (!s) {
    $("uptime-meta").replaceChildren(t().noData);
    $("targets").replaceChildren(state("unknown"));
    $("incidents").replaceChildren();
    return;
  }
  $("uptime-meta").replaceChildren(...freshness(s.generatedAt, STALE_UPTIME_MS, t().every30, t().lastCheck));

  // The 90 Bogotá days that end today, oldest first, so every row lines up.
  const today = new Date(Date.now() - 5 * 3600000);
  const span = Array.from({ length: s.days }, (_, i) => new Date(today.getTime() - (s.days - 1 - i) * 86400000).toISOString().slice(0, 10));

  $("targets").replaceChildren(
    ...s.targets.map((x) => {
      const byDay = new Map(x.daily.map((d) => [d.d, d]));
      const last = x.last;
      return el(
        "article",
        { class: "target", "aria-label": x.name[lang] },
        el(
          "div",
          { class: "target-top" },
          state(last.ok ? "pass" : "fail", last.ok ? t().up : t().down),
          el("span", { class: "target-name" }, x.name[lang]),
          el("a", { class: "target-url", href: x.url }, x.url.replace("https://", "")),
          el(
            "span",
            { class: "target-nums" },
            el("span", {}, `${t().latency} `, el("b", {}, last.ok ? `${last.ms} ms` : "—")),
            el("span", {}, `${t().h24} `, el("b", {}, pct(x.uptime.h24))),
            el("span", {}, `${t().d7} `, el("b", {}, pct(x.uptime.d7))),
            el("span", {}, `${t().d30} `, el("b", {}, pct(x.uptime.d30))),
          ),
        ),
        el(
          "div",
          { class: "days", role: "img", "aria-label": `${t().days90}: ${pct(x.uptime.d90)}` },
          span.map((d) => {
            const day = byDay.get(d);
            const tip = day ? `${fmtDay(d)}: ${day.ok}/${day.n}${day.ms ? ` · ${day.ms} ms` : ""}` : `${fmtDay(d)}: ${t().legendNone}`;
            return el("i", { class: `day ${dayClass(day)}`, title: tip });
          }),
        ),
      );
    }),
  );

  const all = s.targets
    .flatMap((x) => x.incidents.map((i) => ({ ...i, name: x.name[lang] })))
    .sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
    .slice(0, 10);
  $("incidents").replaceChildren(
    ...(all.length
      ? all.map((i) =>
          el(
            "li",
            {},
            state(i.end ? "pass" : "fail", i.end ? fmtTime(i.end) : t().ongoing),
            el("b", {}, i.name),
            el("span", {}, `${fmtTime(i.start)} · ${t().samples(i.samples)}${i.why ? ` · ${t().why[i.why]}` : ""}`),
          ),
        )
      : [el("li", {}, t().noIncidents)]),
    el("li", {}, el("a", { href: `${REPO}/issues?q=label%3Aincidente` }, t().allIncidents)),
  );
}

const ms = (v) => (v === null || v === undefined ? "—" : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`);

function renderLab() {
  const history = data.lighthouse ?? [];
  const last = history.at(-1);
  $("perf-meta").replaceChildren(...freshness(last?.t, STALE_DAILY_MS, t().daily, t().lastAudit));
  if (!last) {
    $("lab").replaceChildren(state("unknown"));
    return;
  }
  $("lab").replaceChildren(
    ...["mobile", "desktop"].map((preset) => {
      const r = last[preset];
      if (!r) return el("article", { class: "lab-card" }, el("h3", {}, t()[preset]), state("unknown"));
      const trend = history.map((h) => h[preset]?.scores.performance).filter((v) => typeof v === "number");
      const line = svg("svg", { class: "trend", viewBox: `0 0 ${Math.max(trend.length - 1, 1)} 100`, preserveAspectRatio: "none", "aria-hidden": "true" });
      line.append(svg("polyline", { points: trend.map((v, i) => `${i},${100 - v}`).join(" ") }));
      return el(
        "article",
        { class: "lab-card" },
        el("h3", {}, `${t()[preset]} · `, el("span", { class: "meta" }, t().runs(r.runs))),
        el(
          "dl",
          { class: "scores" },
          ["performance", "accessibility", "best-practices", "seo"].map((k) =>
            el("div", {}, el("dt", {}, t()[k]), el("dd", { class: r.scores[k] < 90 ? "low" : null }, String(r.scores[k] ?? "—"))),
          ),
        ),
        el(
          "dl",
          { class: "vitals" },
          el("div", {}, el("dt", { title: "Largest Contentful Paint" }, "LCP"), el("dd", {}, ms(r.lcp))),
          el("div", {}, el("dt", { title: "Cumulative Layout Shift" }, "CLS"), el("dd", {}, r.cls === null ? "—" : r.cls.toFixed(3))),
          el("div", {}, el("dt", { title: "Total Blocking Time" }, "TBT"), el("dd", {}, ms(r.tbt))),
          el("div", {}, el("dt", { title: "First Contentful Paint" }, "FCP"), el("dd", {}, ms(r.fcp))),
          el("div", {}, el("dt", { title: "Speed Index" }, "SI"), el("dd", {}, ms(r.si))),
        ),
        trend.length > 1 ? [line, el("p", { class: "trend-label" }, t().trend(trend.length))] : null,
        last.run ? el("p", { class: "trend-label" }, el("a", { href: last.run.url }, t().report)) : null,
      );
    }),
  );
}

function renderSecurity() {
  const sec = data.security;
  $("sec-meta").replaceChildren(...freshness(sec?.t, STALE_DAILY_MS, t().daily, t().lastAudit));
  if (!sec) {
    $("checks").replaceChildren(el("li", {}, state("unknown")));
    return;
  }
  $("checks").replaceChildren(
    ...sec.checks.map((c) => {
      const [name, why] = c.id.startsWith("tls:") ? t().checks.tls(c.host) : t().checks[c.id] ?? [c.id, ""];
      const extra = c.daysLeft !== undefined && c.daysLeft !== null ? t().daysLeft(c.daysLeft) : c.note;
      return el("li", {}, state(c.state), el("span", { class: "what" }, name, extra ? el("span", { class: "meta" }, ` · ${extra}`) : null), el("span", { class: "why" }, why));
    }),
  );
}

function renderQuality() {
  const last = data.lighthouse?.at(-1);
  const a11y = last && (last.mobile || last.desktop);
  const scores = a11y ? [last.mobile?.scores.accessibility, last.desktop?.scores.accessibility].filter((v) => v !== undefined) : [];
  const [a11yName, a11yWhy] = t().q.a11yLab;
  const items = [
    el(
      "li",
      {},
      scores.length ? state(scores.every((v) => v === 100) ? "pass" : "fail", scores.join(" · ")) : state("unknown"),
      el("span", { class: "what" }, a11yName),
      el("span", { class: "why" }, a11yWhy),
    ),
    ...["axe", "ci"].map((k) => el("li", {}, state("unknown"), el("span", { class: "what" }, t().q[k][0]), el("span", { class: "why" }, t().q[k][1]))),
  ];
  $("quality-list").replaceChildren(...items);
}

function renderStatic() {
  document.documentElement.lang = lang;
  document.title = t().title;
  for (const node of document.querySelectorAll("[data-i18n]")) {
    const value = t()[node.dataset.i18n];
    if (typeof value === "string") node.textContent = value;
  }
  const button = $("lang");
  button.textContent = t().langLabel;
  button.setAttribute("aria-label", t().langAria);
  $("actions").replaceChildren(
    ...t().actions.map(([label, href, kind]) => el("a", { class: kind ? `cta ${kind}` : "cta", href, target: "_blank", rel: "noreferrer" }, label, " ↗")),
  );
  $("evidence-list").replaceChildren(...t().ev.map(([name, what, href]) => el("li", {}, el("a", { href }, el("b", {}, name), el("span", {}, what)))));
  $("limits").replaceChildren(...t().limits.map((l) => el("li", {}, l)));
  const updated = data.status?.generatedAt;
  $("foot").textContent = t().foot(updated ? fmtTime(updated) : "—");
}

function render() {
  renderStatic();
  renderStrip();
  renderUptime();
  renderLab();
  renderSecurity();
  renderQuality();
}

$("lang").addEventListener("click", () => {
  lang = lang === "es" ? "en" : "es";
  try {
    localStorage.setItem("lang", lang);
  } catch {
    /* Not remembered; the toggle still works. */
  }
  render();
});

async function load(name) {
  try {
    // A query string per load so a fresh deploy is never hidden behind a cached copy.
    const res = await fetch(`data/${name}.json?v=${Date.now()}`, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

render();
Promise.all([load("status"), load("lighthouse"), load("security")]).then(([status, lighthouse, security]) => {
  Object.assign(data, { status, lighthouse, security });
  render();
});
