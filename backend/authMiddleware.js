const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // service role key — has full DB access
);

// Middleware: verify JWT and attach user to request
async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — no token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Unauthorized — invalid token' });
    req.user = user;
    req.userId = user.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Optional auth — attaches user if present but doesn't block
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) { req.user = user; req.userId = user.id; }
    } catch {}
  }
  next();
}

module.exports = { requireAuth, optionalAuth, supabase };
