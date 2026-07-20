function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.status(401).json({ error: "not_authenticated" });
}

module.exports = { requireAuth };
