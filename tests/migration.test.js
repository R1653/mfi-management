const request = require('supertest');
const app = require('../app');
const db = require('../src/config/database');

describe('Data Migration Module API Tests', () => {
  let agent;
  let testMfiId;

  beforeAll(async () => {
    agent = request.agent(app);
    // Login as Super Admin
    await agent.post('/api/auth/login').send({
      login_id: 'superadmin',
      password: 'Admin@1234'
    });
  });

  afterAll(async () => {
    // Cleanup imported test records
    await db('branches').where('branch_code', 'TESTMIG001').del();
    await db('mfi_agreements').whereIn('mfi_id', function() {
      this.select('id').from('mfi').whereIn('short_name', ['MIGTEST1', 'MIGTEST2']);
    }).del();
    await db('mfi').whereIn('short_name', ['MIGTEST1', 'MIGTEST2']).del();
    await db.destroy();
  });

  test('GET /api/migration/template/mfi - Download Excel & CSV templates', async () => {
    const resXlsx = await agent.get('/api/migration/template/mfi?format=xlsx');
    expect(resXlsx.status).toBe(200);
    expect(resXlsx.header['content-type']).toContain('spreadsheetml');

    const resCsv = await agent.get('/api/migration/template/mfi?format=csv');
    expect(resCsv.status).toBe(200);
    expect(resCsv.header['content-type']).toContain('text/csv');
  });

  test('GET /api/migration/template/branch - Download Excel & CSV templates', async () => {
    const resXlsx = await agent.get('/api/migration/template/branch?format=xlsx');
    expect(resXlsx.status).toBe(200);
    expect(resXlsx.header['content-type']).toContain('spreadsheetml');

    const resCsv = await agent.get('/api/migration/template/branch?format=csv');
    expect(resCsv.status).toBe(200);
    expect(resCsv.header['content-type']).toContain('text/csv');
  });

  test('POST /api/migration/validate/mfi - Validate valid and invalid MFI rows', async () => {
    const res = await agent
      .post('/api/migration/validate/mfi')
      .send({
        rows: [
          {
            full_name: 'Migration Test MFI One',
            short_name: 'MIGTEST1',
            initial_agreement_date: '2024-01-01',
            initial_license_fee: 1000,
            initial_om_fee: 500
          },
          {
            full_name: '', // Invalid: missing full name
            short_name: 'MIGTEST1', // Invalid: duplicate short name in payload
            initial_agreement_date: 'invalid-date' // Invalid date format
          }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBe(2);
    expect(res.body.validCount).toBe(1);
    expect(res.body.invalidCount).toBe(1);
    expect(res.body.rows[0].isValid).toBe(true);
    expect(res.body.rows[1].isValid).toBe(false);
    expect(res.body.rows[1].errors.length).toBeGreaterThan(0);
  });

  test('POST /api/migration/import/mfi - Import valid MFI rows with agreement', async () => {
    const validateRes = await agent
      .post('/api/migration/validate/mfi')
      .send({
        rows: [
          {
            full_name: 'Migration Test MFI One',
            short_name: 'MIGTEST1',
            initial_agreement_date: '2024-01-01',
            initial_license_fee: 1200,
            initial_om_fee: 600,
            initial_branch_count: 5,
            om_grace_period_months: 3
          }
        ]
      });

    const validRows = validateRes.body.rows.filter(r => r.isValid);

    const importRes = await agent
      .post('/api/migration/import/mfi')
      .send({ rows: validRows });

    expect(importRes.status).toBe(200);
    expect(importRes.body.success).toBe(true);
    expect(importRes.body.count).toBe(1);

    // Verify DB insertion
    const createdMfi = await db('mfi').where('short_name', 'MIGTEST1').first();
    expect(createdMfi).toBeDefined();
    expect(createdMfi.full_name).toBe('Migration Test MFI One');
    testMfiId = createdMfi.id;

    // Verify agreement creation
    const agreement = await db('mfi_agreements').where('mfi_id', testMfiId).first();
    expect(agreement).toBeDefined();
    expect(agreement.license_fee_per_branch).toBe(1200);
  });

  test('POST /api/migration/validate/branch - Validate Branch rows', async () => {
    const res = await agent
      .post('/api/migration/validate/branch')
      .send({
        rows: [
          {
            mfi_short_name: 'MIGTEST1',
            branch_name: 'Test Migration Branch',
            branch_code: 'TESTMIG001',
            software_start_date: '2024-03-10',
            branch_type: 'Branch Office'
          }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.validCount).toBe(1);
    // Billable month auto computed (2024-03-10 <= 15th -> 2024-03 + 3 months grace -> 2024-06)
    expect(res.body.rows[0].data.billable_month).toBe('2024-06');
  });

  test('POST /api/migration/import/branch - Import valid Branch rows', async () => {
    const validateRes = await agent
      .post('/api/migration/validate/branch')
      .send({
        rows: [
          {
            mfi_short_name: 'MIGTEST1',
            branch_name: 'Test Migration Branch',
            branch_code: 'TESTMIG001',
            software_start_date: '2024-03-10',
            branch_type: 'Branch Office'
          }
        ]
      });

    const validRows = validateRes.body.rows.filter(r => r.isValid);

    const importRes = await agent
      .post('/api/migration/import/branch')
      .send({ rows: validRows });

    expect(importRes.status).toBe(200);
    expect(importRes.body.success).toBe(true);
    expect(importRes.body.count).toBe(1);

    // Verify DB branch record
    const branch = await db('branches').where('branch_code', 'TESTMIG001').first();
    expect(branch).toBeDefined();
    expect(branch.branch_name).toBe('Test Migration Branch');
    expect(branch.billable_month).toBe('2024-06');
  });
});
