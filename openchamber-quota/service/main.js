// src/main.ts
import http from "node:http";
// node_modules/@openchamber/sdk/dist/scrollbar-style.js
var GUEST_SCROLLING_ATTRIBUTE = "data-oc-scrolling";
var GUEST_SCROLLBAR_CSS = `
:root {
  /* Quiet at rest like the app's own thumbs; hover gives a clear grab target. */
  --oc-scrollbar-thumb: color-mix(in srgb, var(--oc-muted, currentColor) 18%, transparent);
  --oc-scrollbar-thumb-hover: color-mix(in srgb, var(--oc-muted, currentColor) 36%, transparent);
  scrollbar-gutter: stable;
}
* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
:hover, [${GUEST_SCROLLING_ATTRIBUTE}] {
  scrollbar-color: var(--oc-scrollbar-thumb) transparent;
}
/* Chromium's standard scrollbar properties otherwise override its pseudo-elements. */
@supports selector(::-webkit-scrollbar) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-width: auto; scrollbar-color: auto; }
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
    min-width: 24px;
    min-height: 24px;
  }
  :hover::-webkit-scrollbar-thumb, [${GUEST_SCROLLING_ATTRIBUTE}]::-webkit-scrollbar-thumb { background: var(--oc-scrollbar-thumb); }
  ::-webkit-scrollbar-thumb:hover { background: var(--oc-scrollbar-thumb-hover); }
  ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
}
@media (forced-colors: active) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-color: auto; }
  ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb:hover { background: CanvasText; }
}
`;
function installGuestScrollbarActivity(doc) {
  const root = doc.documentElement;
  if (root.hasAttribute("data-oc-scrollbar-activity"))
    return;
  root.setAttribute("data-oc-scrollbar-activity", "");
  const timers = new WeakMap;
  doc.addEventListener("scroll", (event) => {
    const target = event.target === doc ? root : event.target;
    if (!(target instanceof Element))
      return;
    if (!target.hasAttribute("data-oc-scrolling"))
      target.setAttribute("data-oc-scrolling", "");
    const pending = timers.get(target);
    if (pending !== undefined)
      clearTimeout(pending);
    timers.set(target, setTimeout(() => {
      timers.delete(target);
      target.removeAttribute("data-oc-scrolling");
    }, 1000));
  }, { capture: true, passive: true });
}
var GUEST_SCROLLBAR_SCRIPT = `(${installGuestScrollbarActivity.toString()})(document);`;
// node_modules/@openchamber/sdk/dist/manifest.js
var GUEST_PROVIDER_LOGO_BYTES_MAX = 1024 * 1024;
var TRACKER_URL_TOKENS = ["{id}", "{segment}", "{segments+}"];
var TRACKER_URL_TOKEN_SET = new Set(TRACKER_URL_TOKENS);
// node_modules/@openchamber/sdk/dist/session-events.js
var GUEST_SESSION_EVENT_TYPES = [
  "turn-finished",
  "turn-failed",
  "permission-asked",
  "question-asked",
  "turn-started",
  "session-created",
  "session-archived",
  "session-deleted"
];
var SESSION_EVENTS_IDLE_MS = 10 * 60000;
var EVENT_TYPES = new Set(GUEST_SESSION_EVENT_TYPES);
// node_modules/@openchamber/sdk/dist/service-host.js
var SERVICE_SCHEDULE_IDLE_MS = 10 * 60000;
var MENTIONS_IDLE_MS = 10 * 60000;
// node_modules/@openchamber/sdk/dist/file-editor.js
var patternExpressions = new Map;
// node_modules/@openchamber/sdk/dist/contract.js
var GUEST_FILE_STAT_KINDS = ["file", "directory", "other", "missing"];
var GUEST_GENERATE_LATE_KEEP_MS = 60 * 60000;
var HOST_REQUEST_ERROR_CODES = [
  "HOST_UNAVAILABLE",
  "HOST_TIMEOUT",
  "HOST_REJECTED",
  "DISCONNECTED",
  "DISABLED",
  "BAD_PATH",
  "NO_INTEGRATION",
  "NO_SERVICE",
  "SERVICE_FAILED",
  "REQUEST_FAILED",
  "RESPONSE_TOO_LARGE",
  "NO_SESSION",
  "SESSION_BUSY",
  "NOT_GRANTED",
  "NO_DIRECTORY",
  "NOT_FOUND",
  "FILE_TOO_LARGE",
  "DENIED",
  "NO_MODEL",
  "MODEL_FAILED",
  "UNSUPPORTED"
];
var SERVICE_STATUS_VALUES = ["stopped", "starting", "ready", "failed"];
var hostRequestErrorCodeSet = new Set(HOST_REQUEST_ERROR_CODES);
var serviceStatusSet = new Set(SERVICE_STATUS_VALUES);
var fileStatKindSet = new Set(GUEST_FILE_STAT_KINDS);
var HOST_PUSH_TYPES = new Set([
  "workspace",
  "shells",
  "ready",
  "directory",
  "session",
  "connection",
  "settings",
  "session-lifecycle",
  "item",
  "resolve",
  "action",
  "service-event",
  "status-control-event",
  "popover-closed",
  "file-open",
  "file-snapshot",
  "file-saved",
  "generate-late",
  "microphone-audio",
  "microphone-ended"
]);
// node_modules/@openchamber/sdk/dist/service-providers.js
var BROWSER_CONTROL_ACTIONS = [
  "browser.open",
  "browser.snapshot",
  "browser.click",
  "browser.type",
  "browser.select",
  "browser.scroll",
  "browser.back",
  "browser.forward",
  "browser.inspect",
  "browser.capture",
  "browser.resize",
  "browser.close"
];
var BROWSER_PROVIDER_IDLE_MS = 10 * 60000;
var CONTROL_ACTIONS = new Set(BROWSER_CONTROL_ACTIONS);
var SOURCE_CONTROL_PROVIDER_IDLE_MS = 10 * 60000;
var NOTIFICATIONS_PROVIDER_IDLE_MS = 10 * 60000;
var TRACKER_PROVIDER_IDLE_MS = 10 * 60000;
var QUOTA_PROVIDER_PATH = "/quota";
var QUOTA_PROVIDER_WIRE_VERSION = 1;
var QUOTA_PROVIDER_METHODS = ["usage.read"];
var QUOTA_PROVIDER_IDLE_MS = 10 * 60000;
var isQuotaProviderMethod = (value) => QUOTA_PROVIDER_METHODS.some((method) => method === value);
var readQuotaProviderRequest = (body) => {
  let wire;
  try {
    const parsed = JSON.parse(body);
    if (Object(parsed) !== parsed || parsed === null)
      return null;
    wire = parsed;
  } catch {
    return null;
  }
  const { v, requestId, method, provider, input } = wire;
  if (v !== QUOTA_PROVIDER_WIRE_VERSION)
    return null;
  if (String(requestId) !== requestId || requestId.length === 0)
    return null;
  if (String(provider) !== provider || provider.length === 0)
    return null;
  if (String(method) !== method || !isQuotaProviderMethod(method))
    return null;
  if (Object(input) !== input || input === null || input === undefined || Array.isArray(input))
    return null;
  const { credentials } = input;
  if (Object(credentials) !== credentials || credentials === null || Array.isArray(credentials))
    return null;
  if (Object.values(Object(credentials)).some((credential) => Object(credential) !== credential || credential === null || Array.isArray(credential)))
    return null;
  return { v: QUOTA_PROVIDER_WIRE_VERSION, requestId, method, provider, input: { credentials } };
};
// node_modules/@openchamber/sdk/dist/service-surface.js
var SURFACE_CONTROLLERS = ["none", "agent", "user"];
var CONTROLLERS = new Set(SURFACE_CONTROLLERS);
// src/quota.ts
import { execFile } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
var FIVE_HOURS = 5 * 3600;
var DAY = 24 * 3600;
var WEEK = 7 * DAY;
var AGY_TIMEOUT_MS = 15000;
var ERROR_MAX = 2000;
function resolveAgyBinary(env = process.env) {
  const override = env.AGY_BIN?.trim();
  if (override)
    return override;
  const home = env.HOME || os.homedir();
  const candidates = [
    ...(env.PATH ?? "").split(path.delimiter).filter(Boolean).map((dir) => path.join(dir, "agy")),
    path.join(home, ".local", "bin", "agy"),
    "/opt/homebrew/bin/agy",
    "/usr/local/bin/agy"
  ];
  return candidates.find((c) => existsSync(c)) ?? "agy";
}
function agyEnv() {
  const env = { ...process.env };
  for (const key of ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS"])
    delete env[key];
  return env;
}
function windowSeconds(bucket) {
  const w = `${bucket.window ?? ""} ${bucket.id ?? ""}`.toLowerCase();
  if (w.includes("week") || w.includes("7d"))
    return WEEK;
  if (w.includes("5h") || w.includes("five"))
    return FIVE_HOURS;
  if (w.includes("day"))
    return DAY;
  return null;
}
function windowKey(bucket, seconds) {
  if (seconds === WEEK)
    return "weekly";
  if (seconds === FIVE_HOURS)
    return "5h";
  if (seconds === DAY)
    return "daily";
  return (bucket.window || bucket.id || "limit").toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
}
function toWindow(bucket, seconds) {
  const remaining = typeof bucket.remaining_fraction === "number" ? bucket.remaining_fraction : null;
  const resetAt = bucket.reset_time ? Date.parse(bucket.reset_time) : Number.NaN;
  return {
    usedPercent: remaining === null ? null : Math.round(Math.min(100, Math.max(0, (1 - remaining) * 100)) * 10) / 10,
    windowSeconds: seconds,
    resetAt: Number.isFinite(resetAt) ? resetAt : null
  };
}
function toUsageData(output) {
  const groups = output.command?.data?.groups ?? [];
  const models = {};
  for (const group of groups) {
    const name = group.name?.trim();
    if (!name || !Array.isArray(group.buckets))
      continue;
    const windows = {};
    for (const bucket of group.buckets) {
      const seconds = windowSeconds(bucket);
      windows[windowKey(bucket, seconds)] = toWindow(bucket, seconds);
    }
    if (Object.keys(windows).length > 0)
      models[name] = { windows };
  }
  if (Object.keys(models).length === 0) {
    return failure(output.response?.trim() ? `agy reported no quota groups: ${output.response.trim()}` : "agy reported no quota groups. Sign in with `agy` and try again.");
  }
  const windows = {};
  for (const model of Object.values(models)) {
    for (const [key, window2] of Object.entries(model.windows)) {
      const current = windows[key];
      if (!current || (window2.usedPercent ?? -1) > (current.usedPercent ?? -1))
        windows[key] = window2;
    }
  }
  return { ok: true, configured: true, usage: { windows, models } };
}
function failure(error) {
  return { ok: false, configured: true, error: error.slice(0, ERROR_MAX), usage: null };
}
function runAgyQuota(binary = resolveAgyBinary(), cwd = defaultCwd()) {
  return new Promise((resolve) => {
    execFile(binary, ["-p", "/quota", "--output-format", "json"], { cwd, env: agyEnv(), timeout: AGY_TIMEOUT_MS, maxBuffer: 1e6 }, (error, stdout, stderr) => {
      if (error && error.code === "ENOENT") {
        resolve(failure(`agy was not found (${binary}). Install the Antigravity CLI or set AGY_BIN.`));
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch {}
      if (!parsed) {
        const detail = (stderr || error?.message || stdout || "no output").trim().split(`
`).slice(-3).join(" ");
        resolve(failure(`agy /quota failed: ${detail}`));
        return;
      }
      if (parsed.status && parsed.status !== "SUCCESS") {
        resolve(failure(`agy /quota answered ${parsed.status}: ${(parsed.response ?? "").trim()}`));
        return;
      }
      resolve(toUsageData(parsed));
    });
  });
}
function defaultCwd() {
  const dir = process.env.OPENCHAMBER_SERVICE_DATA_DIR || path.join(os.tmpdir(), "antigravity-quota");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

// src/main.ts
var port = Number(process.env.OPENCHAMBER_SERVICE_PORT);
var serviceToken = process.env.OPENCHAMBER_SERVICE_TOKEN ?? "";
if (!port || !serviceToken) {
  console.error("OPENCHAMBER_SERVICE_PORT and OPENCHAMBER_SERVICE_TOKEN are required");
  process.exit(1);
}
var CACHE_MS = 60000;
var inFlight;
var cached;
var readQuota = () => {
  if (cached && Date.now() - cached.at < CACHE_MS)
    return Promise.resolve(cached.data);
  inFlight ??= runAgyQuota().then((data) => {
    cached = data.ok ? { at: Date.now(), data } : undefined;
    return data;
  }).finally(() => {
    inFlight = undefined;
  });
  return inFlight;
};
var send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
var readBody = (req) => new Promise((resolve, reject) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => resolve(body));
  req.on("error", reject);
});
var server = http.createServer((req, res) => {
  if (req.headers.authorization !== `Bearer ${serviceToken}`) {
    send(res, 401, { error: "unauthorized" });
    return;
  }
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/health") {
    send(res, 200, { ok: true });
    return;
  }
  if (url.pathname !== QUOTA_PROVIDER_PATH || req.method !== "POST") {
    send(res, 404, { error: "not-found" });
    return;
  }
  readBody(req).then(async (body) => {
    if (!readQuotaProviderRequest(body)) {
      send(res, 400, { error: "not a usage call this service understands" });
      return;
    }
    send(res, 200, { ok: true, data: await readQuota() });
  }).catch(() => send(res, 500, { error: "could not read the request" }));
});
server.listen(port, "127.0.0.1");
