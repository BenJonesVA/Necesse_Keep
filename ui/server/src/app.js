const path = require("path");
const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const { doubleCsrf } = require("csrf-csrf");

const config = require("./config");
const { requireAuth } = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const serverControlRoutes = require("./routes/serverControl");
const configRoutes = require("./routes/config");
const logsRoutes = require("./routes/logs");
const savesRoutes = require("./routes/saves");
const playersRoutes = require("./routes/players");

if (!config.uiPasswordHash) {
  console.error("UI_PASSWORD_HASH is not set -- login will always fail. See .env.example.");
}
if (!config.sessionSecret) {
  console.error("SESSION_SECRET is not set -- refusing to start with an insecure default.");
  process.exit(1);
}

const app = express();

// Only trust X-Forwarded-* headers when actually behind a reverse proxy
// (e.g. cloudflared); otherwise `secure` cookies would never be sent over
// plain LAN/localhost HTTP.
if (config.trustProxy) {
  app.set("trust proxy", 1);
}

app.use(express.json());
app.use(cookieParser());

app.use(
  session({
    name: "necesse-ui.sid",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: config.trustProxy,
      sameSite: "strict",
      maxAge: 60 * 60 * 1000, // 1h idle timeout
    },
  })
);

const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => config.sessionSecret,
  cookieName: "necesse-ui.csrf",
  cookieOptions: {
    httpOnly: true,
    sameSite: "strict",
    secure: config.trustProxy,
  },
  getSessionIdentifier: (req) => (req.session && req.session.id) || "anonymous",
});

app.get("/api/csrf-token", (req, res) => {
  // overwrite:true -- always issue a fresh token/cookie rather than trying
  // to validate+reuse whatever CSRF cookie the client already has. Without
  // this, a stale cookie from before a session-regenerating login (see
  // client.js) makes generateToken() throw instead of just rotating it.
  res.json({ csrfToken: generateToken(req, res, true) });
});

app.use("/api/auth", authRoutes);

// Everything below requires both a valid session and a valid CSRF token on
// state-changing methods.
app.use("/api", requireAuth, doubleCsrfProtection);
app.use("/api/server", serverControlRoutes);
app.use("/api/config", configRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/saves", savesRoutes);
app.use("/api/players", playersRoutes);

const clientDist = path.join(__dirname, "..", "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(clientDist, "index.html"));
});

app.use((err, req, res, next) => {
  if (err && err.code === "EBADCSRFTOKEN") {
    return res.status(403).json({ error: "invalid_csrf_token" });
  }
  console.error(err);
  res.status(err.statusCode || 500).json({ error: err.message || "internal_error" });
});

app.listen(config.port, () => {
  console.log(`necesse-ui listening on ${config.port}`);
});
