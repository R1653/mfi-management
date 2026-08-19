const bcrypt = require('bcryptjs');

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function(knex) {
  // Clear tables in reverse dependency order
  await knex('role_permissions').del();
  await knex('users').del();
  await knex('permissions').del();
  await knex('roles').del();

  // 1. Insert Roles
  const roles = await knex('roles').insert([
    { id: 1, name: 'Super Admin', description: 'Full system access with all privileges', status: 'active' },
    { id: 2, name: 'Admin', description: 'Administrative and operational management access', status: 'active' },
    { id: 3, name: 'MFI Manager', description: 'MFI, Branch, and Agreement management access', status: 'active' },
    { id: 4, name: 'Viewer', description: 'Read-only access across all modules', status: 'active' }
  ]).returning('id');

  // 2. Insert Permissions
  const permissionsList = [
    // Dashboard
    { id: 1, name: 'dashboard.view', module: 'dashboard', action: 'view' },
    
    // MFI
    { id: 2, name: 'mfi.view', module: 'mfi', action: 'view' },
    { id: 3, name: 'mfi.create', module: 'mfi', action: 'create' },
    { id: 4, name: 'mfi.update', module: 'mfi', action: 'update' },
    { id: 5, name: 'mfi.delete', module: 'mfi', action: 'delete' },
    { id: 6, name: 'mfi.status', module: 'mfi', action: 'status' },

    // Branch
    { id: 7, name: 'branch.view', module: 'branch', action: 'view' },
    { id: 8, name: 'branch.create', module: 'branch', action: 'create' },
    { id: 9, name: 'branch.update', module: 'branch', action: 'update' },
    { id: 10, name: 'branch.delete', module: 'branch', action: 'delete' },
    { id: 11, name: 'branch.status', module: 'branch', action: 'status' },

    // Agreement
    { id: 12, name: 'agreement.view', module: 'agreement', action: 'view' },
    { id: 13, name: 'agreement.create', module: 'agreement', action: 'create' },
    { id: 14, name: 'agreement.update', module: 'agreement', action: 'update' },
    { id: 15, name: 'agreement.delete', module: 'agreement', action: 'delete' },

    // Users
    { id: 16, name: 'user.view', module: 'user', action: 'view' },
    { id: 17, name: 'user.create', module: 'user', action: 'create' },
    { id: 18, name: 'user.update', module: 'user', action: 'update' },
    { id: 19, name: 'user.delete', module: 'user', action: 'delete' },
    { id: 20, name: 'user.reset_password', module: 'user', action: 'reset_password' },

    // Roles
    { id: 21, name: 'role.manage', module: 'role', action: 'manage' },

    // Audit
    { id: 22, name: 'audit.view', module: 'audit', action: 'view' },

    // Reports
    { id: 23, name: 'report.view', module: 'report', action: 'view' },
    { id: 24, name: 'report.export', module: 'report', action: 'export' }
  ];

  await knex('permissions').insert(permissionsList);

  // 3. Assign Role Permissions
  // Super Admin: All Permissions (1 to 24)
  const superAdminRolePerms = permissionsList.map(p => ({ role_id: 1, permission_id: p.id }));

  // Admin: All except role.manage and hard delete permissions
  const adminPermIds = [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 20, 22, 23, 24];
  const adminRolePerms = adminPermIds.map(id => ({ role_id: 2, permission_id: id }));

  // MFI Manager: MFI, Branch, Agreement, Reports
  const managerPermIds = [1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 23, 24];
  const managerRolePerms = managerPermIds.map(id => ({ role_id: 3, permission_id: id }));

  // Viewer: Read-only views
  const viewerPermIds = [1, 2, 7, 12, 23];
  const viewerRolePerms = viewerPermIds.map(id => ({ role_id: 4, permission_id: id }));

  await knex('role_permissions').insert([
    ...superAdminRolePerms,
    ...adminRolePerms,
    ...managerRolePerms,
    ...viewerRolePerms
  ]);

  // 4. Default Seed Users
  const superAdminPassword = await bcrypt.hash('Admin@1234', 10);
  const managerPassword = await bcrypt.hash('Manager@1234', 10);
  const viewerPassword = await bcrypt.hash('Viewer@1234', 10);

  await knex('users').insert([
    {
      id: 1,
      name: 'System Super Administrator',
      login_id: 'superadmin',
      email: 'superadmin@mfimanagement.com',
      mobile: '+8801700000001',
      password: superAdminPassword,
      role_id: 1,
      status: 'active'
    },
    {
      id: 2,
      name: 'Operations Admin',
      login_id: 'admin',
      email: 'admin@mfimanagement.com',
      mobile: '+8801700000002',
      password: superAdminPassword,
      role_id: 2,
      status: 'active'
    },
    {
      id: 3,
      name: 'MFI Account Manager',
      login_id: 'manager',
      email: 'manager@mfimanagement.com',
      mobile: '+8801700000003',
      password: managerPassword,
      role_id: 3,
      status: 'active'
    },
    {
      id: 4,
      name: 'Audit Viewer',
      login_id: 'viewer',
      email: 'viewer@mfimanagement.com',
      mobile: '+8801700000004',
      password: viewerPassword,
      role_id: 4,
      status: 'active'
    }
  ]);
};
