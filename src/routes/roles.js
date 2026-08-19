const express = require('express');
const router = express.Router();
const db = require('../config/database');
const AuditService = require('../services/auditService');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

/**
 * GET /api/roles
 * List all roles with their assigned permission count and IDs
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const roles = await db('roles').orderBy('id', 'asc');
    const rolePermissions = await db('role_permissions')
      .join('permissions', 'role_permissions.permission_id', 'permissions.id')
      .select('role_permissions.role_id', 'permissions.id as permission_id', 'permissions.name');

    const enriched = roles.map(role => {
      const perms = rolePermissions.filter(rp => rp.role_id === role.id);
      return {
        ...role,
        permission_count: role.id === 1 ? 'All (Super Admin)' : perms.length,
        permission_ids: perms.map(p => p.permission_id),
        permissions: perms.map(p => p.name)
      };
    });

    res.json({
      success: true,
      data: enriched
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve roles.' });
  }
});

/**
 * GET /api/roles/permissions
 * List all permissions grouped by module for the permission assignment matrix
 */
router.get('/permissions', requireAuth, async (req, res) => {
  try {
    const permissions = await db('permissions').orderBy('id', 'asc');

    // Group by module
    const grouped = {};
    permissions.forEach(p => {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    });

    res.json({
      success: true,
      data: {
        all: permissions,
        grouped
      }
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve permissions.' });
  }
});

/**
 * PUT /api/roles/:id/permissions
 * Update permissions assigned to a role
 */
router.put('/:id/permissions', requireAuth, requirePermission('role.manage'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const { id } = req.params;
    const { permission_ids = [] } = req.body;

    const role = await trx('roles').where('id', id).first();
    if (!role) {
      await trx.rollback();
      return res.status(404).json({ success: false, message: 'Role not found.' });
    }

    if (role.name === 'Super Admin') {
      await trx.rollback();
      return res.status(400).json({
        success: false,
        message: 'Super Admin always retains all system permissions.'
      });
    }

    // Delete existing permissions
    await trx('role_permissions').where('role_id', id).del();

    // Insert new permissions
    if (permission_ids && permission_ids.length > 0) {
      const inserts = permission_ids.map(pId => ({
        role_id: parseInt(id, 10),
        permission_id: parseInt(pId, 10)
      }));
      await trx('role_permissions').insert(inserts);
    }

    await trx.commit();

    await AuditService.log({
      userId: req.session.user.id,
      module: 'role',
      action: 'update_permissions',
      recordId: id,
      description: `Updated permissions for role '${role.name}' (${permission_ids.length} permissions assigned)`,
      req
    });

    res.json({
      success: true,
      message: `Permissions updated successfully for role '${role.name}'.`
    });
  } catch (error) {
    await trx.rollback();
    console.error('Error updating role permissions:', error);
    res.status(500).json({ success: false, message: 'Failed to update permissions.' });
  }
});

module.exports = router;
