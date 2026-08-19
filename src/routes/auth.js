const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const AuditService = require('../services/auditService');
const { requireAuth } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * User login with credential verification and session initialization
 */
router.post('/login', async (req, res) => {
  try {
    const { login_id, password } = req.body;

    if (!login_id || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both Login ID and Password.'
      });
    }

    const user = await db('users')
      .leftJoin('roles', 'users.role_id', 'roles.id')
      .where('users.login_id', login_id.trim())
      .select(
        'users.id',
        'users.name',
        'users.login_id',
        'users.email',
        'users.mobile',
        'users.password',
        'users.role_id',
        'users.status',
        'roles.name as role_name'
      )
      .first();

    if (!user) {
      // Record failed attempt
      await AuditService.log({
        module: 'auth',
        action: 'login_failed',
        description: `Failed login attempt for unknown Login ID: ${login_id}`,
        req
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid Login ID or Password.'
      });
    }

    if (user.status !== 'active') {
      await AuditService.log({
        userId: user.id,
        module: 'auth',
        action: 'login_blocked',
        description: `Login attempted on deactivated account: ${user.login_id}`,
        req
      });

      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated. Please contact your system administrator.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await AuditService.log({
        userId: user.id,
        module: 'auth',
        action: 'login_failed',
        description: `Invalid password entered for user: ${user.login_id}`,
        req
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid Login ID or Password.'
      });
    }

    // Fetch user permissions
    let permissions = [];
    if (user.role_name === 'Super Admin' || user.role_id === 1) {
      const allPerms = await db('permissions').select('name');
      permissions = allPerms.map(p => p.name);
    } else if (user.role_id) {
      const rolePerms = await db('role_permissions')
        .join('permissions', 'role_permissions.permission_id', 'permissions.id')
        .where('role_permissions.role_id', user.role_id)
        .select('permissions.name');
      permissions = rolePerms.map(p => p.name);
    }

    // Update last_login_at
    await db('users')
      .where('id', user.id)
      .update({ last_login_at: new Date() });

    // Store user session
    const sessionUser = {
      id: user.id,
      name: user.name,
      login_id: user.login_id,
      email: user.email,
      mobile: user.mobile,
      role: user.role_name || 'No Role',
      role_id: user.role_id,
      permissions
    };

    req.session.user = sessionUser;

    // Audit log
    await AuditService.log({
      userId: user.id,
      module: 'auth',
      action: 'login',
      recordId: user.id,
      newValue: { login_id: user.login_id, role: user.role_name },
      description: `User '${user.name}' (${user.login_id}) signed in successfully`,
      req
    });

    res.json({
      success: true,
      message: 'Login successful.',
      user: sessionUser,
      redirect: req.body.redirect || '/dashboard'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
});

/**
 * POST /api/auth/logout
 * Destroy user session and record audit
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;

    await AuditService.log({
      userId: user.id,
      module: 'auth',
      action: 'logout',
      recordId: user.id,
      description: `User '${user.name}' (${user.login_id}) signed out`,
      req
    });

    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).json({ success: false, message: 'Failed to logout cleanly.' });
      }
      res.clearCookie('connect.sid');
      res.json({
        success: true,
        message: 'Logged out successfully.',
        redirect: '/login'
      });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Internal server error during logout.' });
  }
});

/**
 * GET /api/auth/me
 * Return current session user details & permissions
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: req.session.user
  });
});

module.exports = router;
