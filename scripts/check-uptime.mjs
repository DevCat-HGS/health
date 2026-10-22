// Checks every target once, stores the sample and rebuilds data/status.json. Run by .github/workflows/uptime.yml
// every 30 minutes; `node scripts/check-uptime.mjs` works locally too (it skips the issues without a token).
//
// Raw samples live in data/uptime/<YYYY-MM>.json, one entry per run, so every figure on the page can be traced back
// to the measurements behind it. An outage opens a public issue labelled "incidente" and closes it on recovery:
// GitHub emails the owner, and the issue list doubles as the incident history.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { TARGETS } from "./targets.mjs";

const DATA = new URL("../data/", import.meta.url);
const TIMEOUT_MS = 15000;
const RETRY_AFTER_MS = 10000;
const DAYS = 90;
// Colombia has no daylight saving: days on the page are Bogotá days (UTC-5).
const BOGOTA_OFFSET_MS = -5 * 3600 * 1000;

const readJson = (url, fallback) => (existsSync(url) ? JSON.parse(readFileSync(url, "utf8")) : fallback);
const writeJson = (url, value) => writeFileSync(url, JSON.stringify(value, null, 1) + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(target) {
  const started = performance.now();
  try {
    const res = await fetch(target.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "hgs-health-monitor (+https://health.hgsportafolio.site)" },
    });
    const body = await res.text();
    const ms = Math.round(performance.now() - started);
    const ok = res.status === 200 && body.includes(target.expect);
    return { status: res.status, ms, ok, why: ok ? undefined : res.status === 200 ? "content" : "status" };
  } catch (e) {
    return { status: 0, ms: Math.round(performance.now() - started), ok: false, why: e.name === "TimeoutError" ? "timeout" : "network" };
  }
}

/** A failure is checked again before it counts, so a single dropped packet is not an outage. */
async function check(target) {
  const first = await probe(target);
  if (first.ok) return first;
  await sleep(RETRY_AFTER_MS);
  return { ...(await probe(target)), retried: true };
}

const now = new Date();
const results = await Promise.all(TARGETS.map(check));
const sample = { t: now.toISOString(), r: {} };
TARGETS.forEach((target, i) => {
  const { status, ms, ok, why, retried } = results[i];
  sample.r[target.id] = { s: status, ms, ok, ...(why ? { why } : {}), ...(retried ? { retried } : {}) };
});

mkdirSync(new URL("uptime/", DATA), { recursive: true });
const monthFile = new URL(`uptime/${sample.t.slice(0, 7)}.json`, DATA);
const month = readJson(monthFile, []);
month.push(sample);
writeJson(monthFile, month);

// Every sample of the last DAYS days, oldest first, from the monthly files.
const since = now.getTime() - DAYS * 86400000;
const samples = readdirSync(new URL("uptime/", DATA))
  .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
  .sort()
  .flatMap((f) => readJson(new URL(`uptime/${f}`, DATA), []))
  .filter((s) => Date.parse(s.t) >= since);

const bogotaDay = (iso) => new Date(Date.parse(iso) + BOGOTA_OFFSET_MS).toISOString().slice(0, 10);

function uptime(id, hours) {
  const from = now.getTime() - hours * 3600000;
  const window = samples.filter((s) => Date.parse(s.t) >= from && s.r[id]);
  if (!window.length) return null;
  return { pct: (100 * window.filter((s) => s.r[id].ok).length) / window.length, n: window.length };
}

function days(id) {
  const byDay = new Map();
  for (const s of samples) {
    const r = s.r[id];
    if (!r) continue;
    const d = bogotaDay(s.t);
    const day = byDay.get(d) ?? { d, n: 0, ok: 0, ms: 0 };
    day.n++;
    if (r.ok) {
      day.ok++;
      day.ms += r.ms;
    }
    byDay.set(d, day);
  }
  return [...byDay.values()].map((d) => ({ d: d.d, n: d.n, ok: d.ok, ms: d.ok ? Math.round(d.ms / d.ok) : null }));
}

/** Consecutive failed samples form one incident; an open one has no end yet. */
function incidents(id) {
  const out = [];
  let open = null;
  for (const s of samples) {
    const r = s.r[id];
    if (!r) continue;
    if (!r.ok && !open) open = { start: s.t, end: null, samples: 0, why: r.why };
    if (!r.ok) open.samples++;
    if (r.ok && open) {
      open.end = s.t;
      out.push(open);
      open = null;
    }
  }
  if (open) out.push(open);
  return out.slice(-20).reverse();
}

const status = {
  generatedAt: sample.t,
  intervalMinutes: 30,
  days: DAYS,
  targets: TARGETS.map((t) => {
    const last = sample.r[t.id];
    return {
      id: t.id,
      group: t.group,
      name: t.name,
      url: t.url,
      last: { t: sample.t, ...last },
      uptime: { h24: uptime(t.id, 24), d7: uptime(t.id, 24 * 7), d30: uptime(t.id, 24 * 30), d90: uptime(t.id, 24 * DAYS) },
      daily: days(t.id),
      incidents: incidents(t.id),
    };
  }),
};
writeJson(new URL("status.json", DATA), status);

const down = status.targets.filter((t) => !t.last.ok);
console.log(`${sample.t}: ${TARGETS.length - down.length}/${TARGETS.length} up${down.length ? `, down: ${down.map((t) => t.id).join(", ")}` : ""}`);

await syncIssues(status.targets);

/** One open issue per target that is down; closed with a comment when it answers again. */
async function syncIssues(targets) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return;
  const api = (path, init = {}) =>
    fetch(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json" },
    }).then(async (r) => {
      if (!r.ok) throw new Error(`GitHub API ${init.method ?? "GET"} ${path}: ${r.status} ${await r.text()}`);
      return r.json();
    });

  const open = await api("/issues?state=open&labels=incidente&per_page=100");
  for (const t of targets) {
    const tag = `[${t.id}]`;
    const issue = open.find((i) => i.title.startsWith(tag));
    const reason = { status: `respondió ${t.last.s}`, content: "respondió 200 pero sin el contenido esperado", timeout: "no respondió en 15 s", network: "error de red" }[t.last.why];
    if (!t.last.ok && !issue) {
      await api("/issues", {
        method: "POST",
        body: JSON.stringify({
          title: `${tag} ${t.name.es} no responde`,
          labels: ["incidente"],
          body: `${t.url} ${reason} en la comprobación de ${t.last.t} (con un reintento a los 10 s).\n\nEste issue lo abrió el monitor y lo cerrará solo cuando la página vuelva a responder.`,
        }),
      });
      console.log(`Opened an incident for ${t.id}.`);
    } else if (t.last.ok && issue) {
      await api(`/issues/${issue.number}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: `Volvió a responder en la comprobación de ${t.last.t} (${t.last.ms} ms).` }),
      });
      await api(`/issues/${issue.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed", state_reason: "completed" }) });
      console.log(`Closed the incident for ${t.id}.`);
    }
  }
}
