const config = require("../config");

async function request(method, path, body) {
  const res = await fetch(`${config.controlUrl}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const err = new Error(data.error || `control request failed (${res.status})`);
    err.statusCode = res.status;
    throw err;
  }

  return data;
}

module.exports = {
  getStatus: () => request("GET", "/status"),
  start: () => request("POST", "/start"),
  stop: () => request("POST", "/stop"),
  restart: () => request("POST", "/restart"),
  getConfig: () => request("GET", "/config"),
  putConfig: (patch) => request("PUT", "/config", patch),
  recreate: () => request("POST", "/recreate"),

  consolePlayers: () => request("GET", "/console/players"),
  kick: (id, reason) => request("POST", "/console/kick", { id, reason }),
  ban: (id) => request("POST", "/console/ban", { id }),
  unban: (id) => request("POST", "/console/unban", { id }),
  bans: () => request("GET", "/console/bans"),
};
