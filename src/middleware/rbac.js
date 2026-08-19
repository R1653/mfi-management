/**
 * RBAC (Role-Based Access Control) Middleware
 * Enforces module and action level permissions.
 */

function hasPermission(user, permissionName) {
  if (!user) return false;
  // Super Admin role possesses all permissions implicitly
  if (user.role === 'Super Admin' || user.role_id === 1) return true;
  if (!Array.isArray(user.permissions)) return false;
  return user.permissions.includes(permissionName);
}

function requirePermission(permissionName) {
  return (req, res, next) => {
    const user = req.session?.user;

    if (!user) {
      if (req.path.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.'
        });
      }
      return res.redirect('/login');
    }

    if (hasPermission(user, permissionName)) {
      return next();
    }

    // Forbidden
    if (req.path.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: You do not possess the required permission [${permissionName}].`
      });
    }

    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>403 Forbidden - Access Denied</title>
        <link rel="stylesheet" href="/css/main.css">
        <link rel="stylesheet" href="/css/layout.css">
      </head>
      <body class="bg-surface flex items-center justify-center min-h-screen p-4">
        <div class="card max-w-md w-full text-center p-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-danger-light text-danger mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h1 class="text-2xl font-bold text-slate-800 mb-2">Access Denied (403)</h1>
          <p class="text-slate-600 mb-6">You lack the necessary permission (<code>${permissionName}</code>) to access this resource.</p>
          <div class="flex gap-3 justify-center">
            <a href="javascript:history.back()" class="btn btn-secondary">Go Back</a>
            <a href="/dashboard" class="btn btn-primary">Dashboard</a>
          </div>
        </div>
      </body>
      </html>
    `);
  };
}

module.exports = {
  hasPermission,
  requirePermission
};
