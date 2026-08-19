const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const AuditService = require('../services/auditService');
const { paginate } = require('../utils/pagination');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const dayjs = require('dayjs');

/**
 * GET /api/users
 * Paginated list of users
 */
router.get('/', requireAuth, requirePermission('user.view'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      role_id = '',
      status = ''
    } = req.query;

    let query = db('users')
      .leftJoin('roles', 'users.role_id', 'roles.id')
      .select(
        'users.id',
        'users.name',
        'users.login_id',
        'users.email',
        'users.mobile',
        'users.role_id',
        'users.status',
        'users.last_login_at',
        'users.created_at',
        'roles.name as role_name'
      )
      .orderBy('users.id', 'desc');

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.andWhere(function() {
        this.where('users.name', 'like', s)
            .orWhere('users.login_id', 'like', s)
            .orWhere('users.email', 'like', s)
            .orWhere('users.mobile', 'like', s);
      });
    }

    if (role_id) {
      query = query.andWhere('users.role_id', role_id);
    }

    if (status) {
      query = query.andWhere('users.status', status);
    }

    const result = await paginate(query, { page, limit });

    const enriched = result.data.map((u, idx) => ({
      ...u,
      sl: (result.pagination.page - 1) * result.pagination.limit + idx + 1,
      last_login_at_formatted: u.last_login_at ? dayjs(u.last_login_at).format('YYYY-MM-DD HH:mm') : 'Never',
      created_at_formatted: dayjs(u.created_at).format('YYYY-MM-DD')
    }));

    res.json({
      success: true,
      data: enriched,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve users.' });
  }
});

/**
 * GET /api/users/:id
 */
router.get('/:id', requireAuth, requirePermission('user.view'), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await db('users')
      .leftJoin('roles', 'users.role_id', 'roles.id')
      .where('users.id', id)
      .select(
        'users.id',
        'users.name',
        'users.login_id',
        'users.email',
        'users.mobile',
        'users.role_id',
        'users.status',
        'users.last_login_at',
        'users.created_at',
        'roles.name as role_name'
      )
      .first();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve user.' });
  }
});

/**
 * POST /api/users
 * Create a new user
 */
router.post('/', requireAuth, requirePermission('user.create'), async (req, res) => {
  try {
    const {
      name,
      login_id,
      email,
      mobile,
      password,
      confirm_password,
      role_id,
      status = 'active'
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Full Name is required.' });
    }

    if (!login_id || !login_id.trim()) {
      return res.status(400).json({ success: false, message: 'Login ID is required.' });
    }

    const cleanLoginId = login_id.trim().toLowerCase();

    // Check login_id unique
    const existingLogin = await db('users').where('login_id', cleanLoginId).first();
    if (existingLogin) {
      return res.status(400).json({ success: false, message: 'Login ID is already taken.' });
    }

    if (email && email.trim()) {
      const existingEmail = await db('users').where('email', email.trim().toLowerCase()).first();
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'Email address is already in use.' });
      }
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    if (confirm_password !== undefined && password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [userId] = await db('users').insert({
      name: name.trim(),
      login_id: cleanLoginId,
      email: email ? email.trim().toLowerCase() : null,
      mobile: mobile ? mobile.trim() : null,
      password: hashedPassword,
      role_id: role_id || null,
      status: status === 'inactive' ? 'inactive' : 'active',
      created_at: new Date(),
      updated_at: new Date()
    });

    await AuditService.log({
      userId: req.session.user.id,
      module: 'user',
      action: 'create',
      recordId: userId,
      newValue: { name: name.trim(), login_id: cleanLoginId, role_id },
      description: `Created new user account '${name.trim()}' (${cleanLoginId})`,
      req
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      userId
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: 'Failed to create user.' });
  }
});

/**
 * PUT /api/users/:id
 * Update user details
 */
router.put('/:id', requireAuth, requirePermission('user.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      login_id,
      email,
      mobile,
      role_id,
      status
    } = req.body;

    const existing = await db('users').where('id', id).first();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Full Name is required.' });
    }

    if (!login_id || !login_id.trim()) {
      return res.status(400).json({ success: false, message: 'Login ID is required.' });
    }

    const cleanLoginId = login_id.trim().toLowerCase();

    // Check duplicate login_id
    const duplicateLogin = await db('users')
      .where('login_id', cleanLoginId)
      .whereNot('id', id)
      .first();

    if (duplicateLogin) {
      return res.status(400).json({ success: false, message: 'Login ID is already taken by another user.' });
    }

    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      const duplicateEmail = await db('users')
        .where('email', cleanEmail)
        .whereNot('id', id)
        .first();

      if (duplicateEmail) {
        return res.status(400).json({ success: false, message: 'Email is already used by another user.' });
      }
    }

    const updatePayload = {
      name: name.trim(),
      login_id: cleanLoginId,
      email: email ? email.trim().toLowerCase() : null,
      mobile: mobile ? mobile.trim() : null,
      role_id: role_id || null,
      updated_at: new Date()
    };

    if (status && ['active', 'inactive'].includes(status)) {
      updatePayload.status = status;
    }

    await db('users').where('id', id).update(updatePayload);

    await AuditService.log({
      userId: req.session.user.id,
      module: 'user',
      action: 'update',
      recordId: id,
      oldValue: { name: existing.name, login_id: existing.login_id, role_id: existing.role_id, status: existing.status },
      newValue: updatePayload,
      description: `Updated user account '${cleanLoginId}'`,
      req
    });

    res.json({
      success: true,
      message: 'User updated successfully.'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Failed to update user.' });
  }
});

/**
 * POST /api/users/:id/reset-password
 * Reset user password
 */
router.post('/:id/reset-password', requireAuth, requirePermission('user.reset_password'), async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password, confirm_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    if (confirm_password !== undefined && new_password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const user = await db('users').where('id', id).first();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await db('users').where('id', id).update({
      password: hashedPassword,
      updated_at: new Date()
    });

    await AuditService.log({
      userId: req.session.user.id,
      module: 'user',
      action: 'password_change',
      recordId: id,
      description: `Reset password for user '${user.login_id}'`,
      req
    });

    res.json({
      success: true,
      message: `Password has been reset successfully for user '${user.login_id}'.`
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
});

/**
 * PATCH /api/users/:id/status
 */
router.patch('/:id/status', requireAuth, requirePermission('user.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    // Prevent self deactivation
    if (parseInt(id, 10) === req.session.user.id && status === 'inactive') {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }

    const user = await db('users').where('id', id).first();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await db('users').where('id', id).update({
      status,
      updated_at: new Date()
    });

    await AuditService.log({
      userId: req.session.user.id,
      module: 'user',
      action: status === 'active' ? 'activate' : 'deactivate',
      recordId: id,
      oldValue: { status: user.status },
      newValue: { status },
      description: `Changed status of user '${user.login_id}' to ${status}`,
      req
    });

    res.json({
      success: true,
      message: `User '${user.login_id}' has been ${status === 'active' ? 'activated' : 'deactivated'}.`
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ success: false, message: 'Failed to change user status.' });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user account (Super Admin / user.delete permission)
 */
router.delete('/:id', requireAuth, requirePermission('user.delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const userIdNum = parseInt(id, 10);

    // Prevent self deletion
    if (userIdNum === req.session.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own user account.' });
    }

    // Protect master superadmin account
    if (userIdNum === 1) {
      return res.status(400).json({ success: false, message: 'Primary System Super Administrator account cannot be deleted.' });
    }

    const user = await db('users').where('id', id).first();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    await db('users').where('id', id).del();

    await AuditService.log({
      userId: req.session.user.id,
      module: 'user',
      action: 'delete',
      recordId: id,
      oldValue: { name: user.name, login_id: user.login_id, email: user.email },
      description: `Deleted user account '${user.login_id}' (${user.name})`,
      req
    });

    res.json({
      success: true,
      message: `User '${user.login_id}' has been permanently deleted.`
    });
  } catch (error) {
    console.error('User delete error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user account.' });
  }
});

module.exports = router;
