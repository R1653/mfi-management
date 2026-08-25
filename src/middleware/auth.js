/**
 * Authentication Middleware
 * Enforces session-based authentication for web and API requests.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    res.locals.currentUser = req.session.user;
    return next();
  }

  const isApi = (req.originalUrl && req.originalUrl.startsWith('/api/')) ||
                (req.baseUrl && req.baseUrl.startsWith('/api/')) ||
                (req.path && req.path.startsWith('/api/')) ||
                req.xhr ||
                req.headers.accept?.includes('application/json');

  // Check if API request or HTML page request
  if (isApi) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please sign in to continue.'
    });
  }

  // Redirect page request to login
  const returnUrl = encodeURIComponent(req.originalUrl || '/dashboard');
  return res.redirect(`/login?redirect=${returnUrl}`);
}

/**
 * Guest Middleware
 * Redirects logged in users away from login/register pages.
 */
function requireGuest(req, res, next) {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = {
  requireAuth,
  requireGuest
};
