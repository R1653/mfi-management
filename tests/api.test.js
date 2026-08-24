const request = require('supertest');
const app = require('../app');
const db = require('../src/config/database');

describe('Full API Integration Tests (Auth, RBAC, MFI, Branches, Audit)', () => {
  let agent;
  let createdMfiId;

  beforeAll(async () => {
    agent = request.agent(app);
  });

  afterAll(async () => {
    if (createdMfiId) {
      await db('branches').where('mfi_id', createdMfiId).del();
      await db('mfi_agreements').where('mfi_id', createdMfiId).del();
      await db('mfi').where('id', createdMfiId).del();
    }
    await db.destroy();
  });

  test('POST /api/auth/login - Should fail with invalid credentials', async () => {
    const res = await agent
      .post('/api/auth/login')
      .send({ login_id: 'superadmin', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/auth/login - Should succeed with Super Admin credentials', async () => {
    const res = await agent
      .post('/api/auth/login')
      .send({ login_id: 'superadmin', password: 'Admin@1234' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.role).toBe('Super Admin');
  });

  test('GET /api/dashboard - Should return consolidated dashboard statistics', async () => {
    const res = await agent.get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cards).toBeDefined();
    expect(res.body.data.charts).toBeDefined();
  });

  test('POST /api/mfis - Should create a new MFI and auto-create initial agreement', async () => {
    const res = await agent
      .post('/api/mfis')
      .send({
        full_name: 'Test Automation MFI Society',
        short_name: 'TAMS',
        establish_date: '2021-03-10',
        initial_agreement_date: '2021-04-01',
        initial_license_fee: 1400.00,
        initial_om_fee: 700.00,
        initial_branch_count: 3,
        status: 'active'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.mfiId).toBeDefined();
    createdMfiId = res.body.mfiId;

    // Check that initial agreement was automatically created!
    const agr = await db('mfi_agreements').where('mfi_id', createdMfiId).first();
    expect(agr).toBeDefined();
    expect(agr.license_fee_per_branch).toBe(1400.00);
    expect(agr.om_fee_per_branch).toBe(700.00);
  });

  test('POST /api/mfis - Should prevent duplicate MFI short name', async () => {
    const res = await agent
      .post('/api/mfis')
      .send({
        full_name: 'Duplicate Short Name Test',
        short_name: 'TAMS',
        establish_date: '2021-03-10',
        initial_agreement_date: '2021-04-01'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('already exists');
  });

  test('POST /api/branches - Should create a branch under the MFI', async () => {
    const res = await agent
      .post('/api/branches')
      .send({
        mfi_id: createdMfiId,
        branch_name: 'Gulshan Branch',
        branch_code: '101',
        branch_opening_date: '2021-05-01',
        software_start_date: '2021-06-01',
        billable_month: '2021-06',
        branch_type: 'Branch Office',
        status: 'active'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.branchId).toBeDefined();
  });

  test('POST /api/branches - Should enforce branch_code uniqueness within same MFI', async () => {
    const res = await agent
      .post('/api/branches')
      .send({
        mfi_id: createdMfiId,
        branch_name: 'Duplicate Code Branch',
        branch_code: '101',
        branch_opening_date: '2021-05-01',
        software_start_date: '2021-06-01',
        billable_month: '2021-06',
        branch_type: 'Branch Office',
        status: 'active'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('already exists');
  });

  test('GET /api/audit-logs - Should record audit entries for create mutations', async () => {
    const res = await agent.get('/api/audit-logs?module=mfi');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
