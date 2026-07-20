let csrfToken = null;

async function ensureCsrfToken() {
  if (csrfToken) return csrfToken;
  const res = await fetch("/api/csrf-token", { credentials: "include" });
  const data = await res.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };

  if (method !== "GET") {
    headers["x-csrf-token"] = await ensureCsrfToken();
  }

  const res = await fetch(path, {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    const err = new Error("not_authenticated");
    err.status = 401;
    throw err;
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const err = new Error(data.error || `request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  // Login regenerates the server-side session id, which invalidates any
  // CSRF token issued beforehand (the token is cryptographically bound to
  // the session id) -- drop the cached token so the next protected call
  // fetches a fresh one bound to the new post-login session.
  login: (password) => request("POST", "/api/auth/login", { password }).then((r) => {
    csrfToken = null;
    return r;
  }),
  logout: () => request("POST", "/api/auth/logout").then((r) => {
    csrfToken = null;
    return r;
  }),
  me: () => request("GET", "/api/auth/me"),

  status: () => request("GET", "/api/server/status"),
  start: () => request("POST", "/api/server/start"),
  stop: () => request("POST", "/api/server/stop"),
  restart: () => request("POST", "/api/server/restart"),

  getConfig: () => request("GET", "/api/config"),
  stageConfig: (patch) => request("PUT", "/api/config", patch),
  applyConfig: () => request("POST", "/api/config/apply"),

  logFiles: () => request("GET", "/api/logs/files"),
  logEvents: (file, limit) =>
    request("GET", `/api/logs/events?${new URLSearchParams({ file: file || "", limit: limit || 200 })}`),
  logTail: (file, lines) =>
    request("GET", `/api/logs/tail?${new URLSearchParams({ file: file || "", lines: lines || 200 })}`),

  saves: () => request("GET", "/api/saves"),

  onlinePlayers: () => request("GET", "/api/players/online"),
  consolePlayers: () => request("GET", "/api/players/console"),
  kickPlayer: (id, reason) => request("POST", "/api/players/kick", { id, reason }),
  banPlayer: (id) => request("POST", "/api/players/ban", { id }),
  unbanPlayer: (id) => request("POST", "/api/players/unban", { id }),
  bans: () => request("GET", "/api/players/bans"),
};
