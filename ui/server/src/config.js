module.exports = {
  port: process.env.PORT || 3000,
  uiPasswordHash: process.env.UI_PASSWORD_HASH || "",
  sessionSecret: process.env.SESSION_SECRET || "",
  controlUrl: process.env.CONTROL_URL || "http://necesse-control:4000",
  trustProxy: process.env.TRUST_PROXY === "1",
  logsDir: process.env.LOGS_DIR || "/necesse/logs",
  savesDir: process.env.SAVES_DIR || "/necesse/saves",
};
