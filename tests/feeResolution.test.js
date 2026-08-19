const db = require('../src/config/database');
const AgreementService = require('../src/services/agreementService');

describe('Agreement & Fee Resolution Engine (Single Source of Truth)', () => {
  let testMfiId;

  beforeAll(async () => {
    // Clean up or seed if necessary
    const [id] = await db('mfi').insert({
      full_name: 'Fee Resolution Test MFI',
      short_name: 'FRT',
      establish_date: '2020-01-01',
      initial_agreement_date: '2020-01-01',
      initial_license_fee: 1000.00,
      initial_om_fee: 500.00,
      initial_branch_count: 5,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    });
    testMfiId = id;

    // Add Agreement 1: Initial Agreement 2020-01-01
    await db('mfi_agreements').insert({
      mfi_id: testMfiId,
      agreement_date: '2020-01-01',
      license_fee_per_branch: 1000.00,
      om_fee_per_branch: 500.00,
      remarks: 'Initial Term',
      created_at: new Date(),
      updated_at: new Date()
    });

    // Add Agreement 2: Renewal 2022-01-01 (Rate hike)
    await db('mfi_agreements').insert({
      mfi_id: testMfiId,
      agreement_date: '2022-01-01',
      license_fee_per_branch: 1200.00,
      om_fee_per_branch: 600.00,
      remarks: '2022 Rate Adjustment',
      created_at: new Date(),
      updated_at: new Date()
    });

    // Add Agreement 3: Renewal 2024-01-01 (Current Term)
    await db('mfi_agreements').insert({
      mfi_id: testMfiId,
      agreement_date: '2024-01-01',
      license_fee_per_branch: 1500.00,
      om_fee_per_branch: 750.00,
      remarks: '2024 Renewal Term',
      created_at: new Date(),
      updated_at: new Date()
    });

    // Add Agreement 4: Future Renewal 2027-01-01
    await db('mfi_agreements').insert({
      mfi_id: testMfiId,
      agreement_date: '2027-01-01',
      license_fee_per_branch: 2000.00,
      om_fee_per_branch: 1000.00,
      remarks: 'Future Rate Term',
      created_at: new Date(),
      updated_at: new Date()
    });
  });

  afterAll(async () => {
    if (testMfiId) {
      await db('mfi_agreements').where('mfi_id', testMfiId).del();
      await db('mfi').where('id', testMfiId).del();
    }
  });

  test('Should resolve 2020 rates for invoice date in 2021 (before second renewal)', async () => {
    const fee = await AgreementService.getApplicableAgreement(testMfiId, '2021-06-15');
    expect(fee).toBeDefined();
    expect(fee.license_fee_per_branch).toBe(1000.00);
    expect(fee.om_fee_per_branch).toBe(500.00);
  });

  test('Should resolve 2022 rates for invoice date in 2023', async () => {
    const fee = await AgreementService.getApplicableAgreement(testMfiId, '2023-11-30');
    expect(fee).toBeDefined();
    expect(fee.license_fee_per_branch).toBe(1200.00);
    expect(fee.om_fee_per_branch).toBe(600.00);
  });

  test('Should resolve 2024 rates for current 2026 dates without picking future 2027 agreement', async () => {
    const fee = await AgreementService.getApplicableAgreement(testMfiId, '2026-08-18');
    expect(fee).toBeDefined();
    expect(fee.license_fee_per_branch).toBe(1500.00);
    expect(fee.om_fee_per_branch).toBe(750.00);
  });

  test('Should resolve 2027 rates when querying a future date in 2027', async () => {
    const fee = await AgreementService.getApplicableAgreement(testMfiId, '2027-02-01');
    expect(fee).toBeDefined();
    expect(fee.license_fee_per_branch).toBe(2000.00);
    expect(fee.om_fee_per_branch).toBe(1000.00);
  });

  test('Should return agreement history with proper active / upcoming / historical status tags', async () => {
    const history = await AgreementService.getAgreementHistory(testMfiId, '2026-08-18');
    expect(history.length).toBe(4);

    // Oldest first or newest first: history is ordered by agreement_date DESC
    const futureAgr = history.find(h => h.agreement_date === '2027-01-01');
    const currentAgr = history.find(h => h.agreement_date === '2024-01-01');
    const histAgr = history.find(h => h.agreement_date === '2022-01-01');

    expect(futureAgr.is_upcoming).toBe(true);
    expect(currentAgr.is_current).toBe(true);
    expect(histAgr.is_historical).toBe(true);
  });
});
