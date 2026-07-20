const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const config = require("../config");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_attempts" },
});

router.post("/login", loginLimiter, async (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== "string" || !config.uiPasswordHash) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const ok = await bcrypt.compare(password, config.uiPasswordHash);
  if (!ok) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "session_error" });
    req.session.authenticated = true;
    req.session.loginAt = Date.now();
    res.json({ ok: true });
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/me", (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.json({ authenticated: true });
  }
  res.status(401).json({ authenticated: false });
});

module.exports = router;
