// Daily audit of production, run by .github/workflows/daily.yml: Lighthouse (lab data, mobile and desktop) and the
// security checks anyone could make from outside. Appends to data/lighthouse.json and rewrites data/security.json.
// The full Lighthouse reports are kept as the run's artifact (.reports/), linked from the page.
//
// It only reads what a browser would see. It never sends credentials, never touches the admin and never reports a
// value that would help an attack (no versions, no full header values).
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { connect } from "node:tls";
import { AUDITED, DOMAINS } from "./targets.mjs";

const DATA = new URL("../data/", import.meta.url);
const REPORTS = ".reports";
// The same pinned version as the portfolio's own CI, so both sets of scores compare.
const LIGHTHOUSE = "lighthouse@12.8.2";
const RUNS = 3;
const HISTORY = 180;

const readJson = (url, fallback) => (existsSync(url) ? JSON.parse(readFileSync(url, "utf8")) : fallback);
const writeJson = (url, value) => writeFileSync(url, JSON.stringify(value, null, 1) + "\n");
const now = new Date().toISOString();
const run = process.env.GITHUB_RUN_ID
  ? { id: process.env.GITHUB_RUN_ID, url: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` }
  : null;

mkdirSync(REPORTS, { recursive: true });

// —— Lighthouse ——
function lighthouse(preset, i) {
  const file = `${REPORTS}/lh-${preset}-${i}.json`;
  const presetArg = preset === "desktop" ? "--preset=desktop" : "";
  // Chrome sometimes fails to record the trace; that says nothing about the page, so the run is retried.
  for (let attempt = 1; ; attempt++) {
    try {
      execSync(
        `npx --yes ${LIGHTHOUSE} ${AUDITED} ${presetArg} --only-categories=performance,accessibility,best-practices,seo ` +
          `--output=json --output=html --output-path="${REPORTS}/lh-${preset}-${i}" --chrome-flags="--headless=new --no-sandbox" --quiet`,
        { stdio: ["ignore", "ignore", "inherit"] },
      );
      return JSON.parse(readFileSync(`${REPORTS}/lh-${preset}-${i}.report.json`, "utf8"));
    } catch (e) {
      if (attempt >= 3) {
        console.warn(`Lighthouse ${preset} run ${i + 1} failed three times: ${e.message}`);
        return null;
      }
    }
  }
}

const metric = (lhr, id) => lhr.audits[id]?.numericValue ?? null;
const lab = {};
// SKIP_LIGHTHOUSE=1 runs only the security checks, for trying them locally; nothing is added to the history.
const skipLighthouse = process.env.SKIP_LIGHTHOUSE === "1";
for (const preset of skipLighthouse ? [] : ["mobile", "desktop"]) {
  const runs = Array.from({ length: RUNS }, (_, i) => lighthouse(preset, i)).filter(Boolean);
  if (!runs.length) {
    lab[preset] = null;
    continue;
  }
  // The median run by performance, as in the portfolio's CI: one slow run on a shared machine does not decide.
  const lhr = runs.sort((a, b) => a.categories.performance.score - b.categories.performance.score)[Math.floor(runs.length / 2)];
  lab[preset] = {
    runs: runs.length,
    scores: Object.fromEntries(Object.entries(lhr.categories).map(([k, c]) => [k, Math.round(c.score * 100)])),
    lcp: metric(lhr, "largest-contentful-paint"),
    cls: metric(lhr, "cumulative-layout-shift"),
    tbt: metric(lhr, "total-blocking-time"),
    fcp: metric(lhr, "first-contentful-paint"),
    si: metric(lhr, "speed-index"),
  };
}
const lighthouseFile = new URL("lighthouse.json", DATA);
if (!skipLighthouse) {
  const history = readJson(lighthouseFile, []);
  history.push({ t: now, url: AUDITED, version: LIGHTHOUSE.split("@")[1], run, ...lab });
  writeJson(lighthouseFile, history.slice(-HISTORY));
}

// —— Security, as seen from outside ——
const checks = [];
const add = (id, ok, detail = {}) => checks.push({ id, state: ok === null ? "unknown" : ok ? "pass" : "fail", ...detail });

async function get(url, init) {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(15000), ...init });
  } catch {
    return null;
  }
}

const page = await get(AUDITED);
if (!page) {
  for (const id of ["hsts", "csp", "nosniff", "frame", "referrer", "permissions", "coop"]) add(id, null);
} else {
  const h = (name) => page.headers.get(name);
  const hsts = h("strict-transport-security") ?? "";
  const maxAge = Number(hsts.match(/max-age=(\d+)/)?.[1] ?? 0);
  add("hsts", maxAge >= 15552000, { note: maxAge ? `max-age ${Math.round(maxAge / 86400)} d` : undefined });
  const csp = h("content-security-policy") ?? "";
  add("csp", /default-src/.test(csp) && !/'unsafe-eval'/.test(csp));
  add("nosniff", h("x-content-type-options") === "nosniff");
  add("frame", h("x-frame-options") === "DENY" || /frame-ancestors\s+'none'/.test(csp));
  add("referrer", Boolean(h("referrer-policy")));
  add("permissions", Boolean(h("permissions-policy")));
  add("coop", Boolean(h("cross-origin-opener-policy")));
}

const plain = await get(AUDITED.replace("https://", "http://"), { redirect: "manual" });
add("https-redirect", plain ? [301, 302, 307, 308].includes(plain.status) && (plain.headers.get("location") ?? "").startsWith("https://") : null);

const txt = await get(new URL("/.well-known/security.txt", AUDITED));
if (!txt || txt.status !== 200) add("security-txt", txt ? false : null);
else {
  const body = await txt.text();
  const expires = Date.parse(body.match(/^Expires:\s*(.+)$/m)?.[1] ?? "");
  add("security-txt", /^Contact:/m.test(body) && expires > Date.now(), {
    note: Number.isNaN(expires) ? undefined : `vence ${new Date(expires).toISOString().slice(0, 10)}`,
  });
}

function certificate(host) {
  return new Promise((resolve) => {
    const socket = connect({ host, port: 443, servername: host, timeout: 15000 }, () => {
      const cert = socket.getPeerCertificate();
      const authorized = socket.authorized;
      socket.end();
      resolve({ authorized, validTo: cert?.valid_to ? new Date(cert.valid_to).toISOString() : null });
    });
    socket.on("error", () => resolve(null));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
  });
}

for (const host of DOMAINS) {
  const cert = await certificate(host);
  if (!cert) add(`tls:${host}`, null, { host });
  else {
    const daysLeft = cert.validTo ? Math.floor((Date.parse(cert.validTo) - Date.now()) / 86400000) : null;
    // Netlify and GitHub renew on their own around 30 days before expiry; under 14 days means renewal is failing.
    add(`tls:${host}`, cert.authorized && daysLeft !== null && daysLeft >= 14, { host, daysLeft });
  }
}

writeJson(new URL("security.json", DATA), { t: now, url: AUDITED, run, checks });

const summary = (p) => (lab[p] ? Object.values(lab[p].scores).join("/") : "no data");
console.log(`Lighthouse mobile ${summary("mobile")}, desktop ${summary("desktop")}`);
console.log(`Security: ${checks.filter((c) => c.state === "pass").length} pass, ${checks.filter((c) => c.state === "fail").length} fail, ${checks.filter((c) => c.state === "unknown").length} not evaluated`);
