/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function(knex) {
  // Clear existing operational tables
  await knex('audit_logs').del();
  await knex('mfi_agreements').del();
  await knex('branches').del();
  await knex('mfi').del();

  // 1. Insert MFIs
  await knex('mfi').insert([
    {
      id: 1,
      full_name: 'Social Services Society',
      short_name: 'SSS',
      establish_date: '1998-05-10',
      initial_agreement_date: '2020-01-01',
      initial_license_fee: 1200.00,
      initial_om_fee: 600.00,
      initial_branch_count: 25,
      status: 'active',
      created_by: 1,
      updated_by: 1,
      created_at: new Date('2020-01-01T09:00:00Z'),
      updated_at: new Date('2026-01-01T10:00:00Z')
    },
    {
      id: 2,
      full_name: 'Example Microfinance Foundation',
      short_name: 'EMF',
      establish_date: '2005-08-15',
      initial_agreement_date: '2021-07-01',
      initial_license_fee: 1000.00,
      initial_om_fee: 500.00,
      initial_branch_count: 15,
      status: 'active',
      created_by: 1,
      updated_by: 1,
      created_at: new Date('2021-07-01T09:00:00Z'),
      updated_at: new Date('2025-07-01T11:00:00Z')
    },
    {
      id: 3,
      full_name: 'Demo Development Society',
      short_name: 'DDS',
      establish_date: '2012-11-20',
      initial_agreement_date: '2023-01-01',
      initial_license_fee: 1100.00,
      initial_om_fee: 550.00,
      initial_branch_count: 8,
      status: 'active',
      created_by: 1,
      updated_by: 1,
      created_at: new Date('2023-01-01T09:00:00Z'),
      updated_at: new Date('2023-01-01T09:00:00Z')
    }
  ]);

  // 2. Insert Agreements
  // Notice: Historical fee changes over time!
  await knex('mfi_agreements').insert([
    // SSS Agreements
    {
      id: 1,
      mfi_id: 1,
      agreement_date: '2020-01-01',
      license_fee_per_branch: 1200.00,
      om_fee_per_branch: 600.00,
      remarks: 'Initial agreement signed for 25 branches.',
      created_by: 1,
      created_at: new Date('2020-01-01T09:30:00Z')
    },
    {
      id: 2,
      mfi_id: 1,
      agreement_date: '2022-01-01',
      license_fee_per_branch: 1500.00,
      om_fee_per_branch: 750.00,
      remarks: 'Bi-annual renewal with adjusted support rates.',
      created_by: 1,
      created_at: new Date('2022-01-01T10:00:00Z')
    },
    {
      id: 3,
      mfi_id: 1,
      agreement_date: '2024-01-01',
      license_fee_per_branch: 1800.00,
      om_fee_per_branch: 900.00,
      remarks: 'Revised agreement with cloud hosting and premium SLA.',
      created_by: 1,
      created_at: new Date('2024-01-01T11:00:00Z')
    },
    {
      id: 4,
      mfi_id: 1,
      agreement_date: '2026-01-01',
      license_fee_per_branch: 2200.00,
      om_fee_per_branch: 1100.00,
      remarks: 'Current agreement with 24/7 dedicated support desk.',
      created_by: 1,
      created_at: new Date('2026-01-01T08:00:00Z')
    },

    // EMF Agreements
    {
      id: 5,
      mfi_id: 2,
      agreement_date: '2021-07-01',
      license_fee_per_branch: 1000.00,
      om_fee_per_branch: 500.00,
      remarks: 'Initial agreement for EMF foundation pilot branches.',
      created_by: 1,
      created_at: new Date('2021-07-01T09:30:00Z')
    },
    {
      id: 6,
      mfi_id: 2,
      agreement_date: '2023-07-01',
      license_fee_per_branch: 1300.00,
      om_fee_per_branch: 650.00,
      remarks: 'First renewal with expanded branch quota.',
      created_by: 1,
      created_at: new Date('2023-07-01T10:15:00Z')
    },
    {
      id: 7,
      mfi_id: 2,
      agreement_date: '2025-07-01',
      license_fee_per_branch: 1600.00,
      om_fee_per_branch: 800.00,
      remarks: 'Agreement renewed for 2 years with mobile banking add-on.',
      created_by: 1,
      created_at: new Date('2025-07-01T10:30:00Z')
    },

    // DDS Agreements
    {
      id: 8,
      mfi_id: 3,
      agreement_date: '2023-01-01',
      license_fee_per_branch: 1100.00,
      om_fee_per_branch: 550.00,
      remarks: 'Initial agreement for Demo Development Society.',
      created_by: 1,
      created_at: new Date('2023-01-01T09:00:00Z')
    },
    {
      id: 9,
      mfi_id: 3,
      agreement_date: '2027-01-01',
      license_fee_per_branch: 1400.00,
      om_fee_per_branch: 700.00,
      remarks: 'Upcoming agreement scheduled for next year.',
      created_by: 1,
      created_at: new Date('2026-06-01T14:00:00Z')
    }
  ]);

  // 3. Insert Branches
  await knex('branches').insert([
    // SSS Branches
    {
      id: 1,
      mfi_id: 1,
      branch_name: 'Head Office Zone Dhaka',
      branch_code: '1001',
      branch_opening_date: '2020-01-15',
      software_start_date: '2020-02-01',
      billable_month: '2020-02',
      branch_type: 'Zone Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2020-01-15T10:00:00Z')
    },
    {
      id: 2,
      mfi_id: 1,
      branch_name: 'Tangail Sadar Area',
      branch_code: '1002',
      branch_opening_date: '2020-02-01',
      software_start_date: '2020-02-15',
      billable_month: '2020-02',
      branch_type: 'Area Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2020-02-01T10:00:00Z')
    },
    {
      id: 3,
      mfi_id: 1,
      branch_name: 'Mirzapur Branch',
      branch_code: '1003',
      branch_opening_date: '2020-03-01',
      software_start_date: '2020-03-15',
      billable_month: '2020-03',
      branch_type: 'Branch Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2020-03-01T10:00:00Z')
    },
    {
      id: 4,
      mfi_id: 1,
      branch_name: 'Kaliakair Branch',
      branch_code: '1004',
      branch_opening_date: '2020-04-10',
      software_start_date: '2020-05-01',
      billable_month: '2020-05',
      branch_type: 'Branch Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2020-04-10T10:00:00Z')
    },
    {
      id: 5,
      mfi_id: 1,
      branch_name: 'Gazipur Chowrasta Branch',
      branch_code: '1005',
      branch_opening_date: '2021-01-10',
      software_start_date: '2021-02-01',
      billable_month: '2021-02',
      branch_type: 'Branch Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2021-01-10T10:00:00Z')
    },
    {
      id: 6,
      mfi_id: 1,
      branch_name: 'Mymensingh Branch',
      branch_code: '1006',
      branch_opening_date: '2021-06-01',
      software_start_date: '2021-06-15',
      billable_month: '2021-06',
      branch_type: 'Branch Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2021-06-01T10:00:00Z')
    },
    {
      id: 7,
      mfi_id: 1,
      branch_name: 'Bogura Town Branch',
      branch_code: '1007',
      branch_opening_date: '2022-01-05',
      software_start_date: '2022-01-20',
      billable_month: '2022-01',
      branch_type: 'Branch Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2022-01-05T10:00:00Z')
    },
    {
      id: 8,
      mfi_id: 1,
      branch_name: 'Rajshahi Central Branch',
      branch_code: '1008',
      branch_opening_date: '2022-08-01',
      software_start_date: '2022-08-15',
      billable_month: '2022-08',
      branch_type: 'Branch Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2022-08-01T10:00:00Z')
    },
    {
      id: 9,
      mfi_id: 1,
      branch_name: 'Rangpur City Branch',
      branch_code: '1009',
      branch_opening_date: '2023-03-01',
      software_start_date: '2023-03-15',
      billable_month: '2023-03',
      branch_type: 'Branch Office',
      status: 'inactive',
      created_by: 1,
      created_at: new Date('2023-03-01T10:00:00Z')
    },
    {
      id: 10,
      mfi_id: 1,
      branch_name: 'Sylhet Sadar Branch',
      branch_code: '1010',
      branch_opening_date: '2024-02-15',
      software_start_date: '2024-03-01',
      billable_month: '2024-03',
      branch_type: 'Branch Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2024-02-15T10:00:00Z')
    },

    // EMF Branches
    {
      id: 11,
      mfi_id: 2,
      branch_name: 'EMF Principal Office',
      branch_code: '2001',
      branch_opening_date: '2021-07-10',
      software_start_date: '2021-08-01',
      billable_month: '2021-08',
      branch_type: 'Zone Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2021-07-10T10:00:00Z')
    },
    {
      id: 12,
      mfi_id: 2,
      branch_name: 'Chattogram Port Area',
      branch_code: '2002',
      branch_opening_date: '2021-09-01',
      software_start_date: '2021-09-15',
      billable_month: '2021-09',
      branch_type: 'Area Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2021-09-01T10:00:00Z')
    },
    {
      id: 13,
      mfi_id: 2,
      branch_name: 'Agrabad Commercial Branch',
      branch_code: '2003',
      branch_opening_date: '2022-02-01',
      software_start_date: '2022-02-15',
      billable_month: '2022-02',
      branch_type: 'Branch Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2022-02-01T10:00:00Z')
    },
    {
      id: 14,
      mfi_id: 2,
      branch_name: 'Coxs Bazar Town Branch',
      branch_code: '2004',
      branch_opening_date: '2022-11-01',
      software_start_date: '2022-11-15',
      billable_month: '2022-11',
      branch_type: 'Branch Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2022-11-01T10:00:00Z')
    },
    {
      id: 15,
      mfi_id: 2,
      branch_name: 'Feni Sadar Branch',
      branch_code: '2005',
      branch_opening_date: '2023-05-10',
      software_start_date: '2023-06-01',
      billable_month: '2023-06',
      branch_type: 'Branch Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2023-05-10T10:00:00Z')
    },

    // DDS Branches
    {
      id: 16,
      mfi_id: 3,
      branch_name: 'DDS Central Operations',
      branch_code: '3001',
      branch_opening_date: '2023-01-10',
      software_start_date: '2023-02-01',
      billable_month: '2023-02',
      branch_type: 'Zone Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2023-01-10T10:00:00Z')
    },
    {
      id: 17,
      mfi_id: 3,
      branch_name: 'Khulna Sadar Branch',
      branch_code: '3002',
      branch_opening_date: '2023-04-01',
      software_start_date: '2023-04-15',
      billable_month: '2023-04',
      branch_type: 'Branch Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2023-04-01T10:00:00Z')
    },
    {
      id: 18,
      mfi_id: 3,
      branch_name: 'Jashore Town Branch',
      branch_code: '3003',
      branch_opening_date: '2023-09-15',
      software_start_date: '2023-10-01',
      billable_month: '2023-10',
      branch_type: 'Branch Office',
      status: 'active',
      created_by: 1,
      created_at: new Date('2023-09-15T10:00:00Z')
    },
    {
      id: 19,
      mfi_id: 3,
      branch_name: 'Kushtia Branch',
      branch_code: '3004',
      branch_opening_date: '2024-01-10',
      software_start_date: '2024-02-01',
      billable_month: '2024-02',
      branch_type: 'Branch Office',
      status: 'inactive',
      created_by: 1,
      created_at: new Date('2024-01-10T10:00:00Z')
    }
  ]);

  // 4. Initial Audit Logs
  await knex('audit_logs').insert([
    {
      id: 1,
      user_id: 1,
      module: 'auth',
      action: 'login',
      record_id: 1,
      old_value: null,
      new_value: JSON.stringify({ login_id: 'superadmin', ip: '127.0.0.1' }),
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      description: 'Super Administrator logged into the system',
      created_at: new Date('2026-08-18T10:00:00Z')
    },
    {
      id: 2,
      user_id: 1,
      module: 'mfi',
      action: 'create',
      record_id: 1,
      old_value: null,
      new_value: JSON.stringify({ short_name: 'SSS', full_name: 'Social Services Society' }),
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      description: 'Created MFI: Social Services Society (SSS)',
      created_at: new Date('2026-08-18T10:05:00Z')
    },
    {
      id: 3,
      user_id: 1,
      module: 'agreement',
      action: 'renew',
      record_id: 4,
      old_value: JSON.stringify({ agreement_date: '2024-01-01', license_fee: 1800, om_fee: 900 }),
      new_value: JSON.stringify({ agreement_date: '2026-01-01', license_fee: 2200, om_fee: 1100 }),
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      description: 'Renewed agreement for SSS with updated license fee 2200 BDT and O&M fee 1100 BDT',
      created_at: new Date('2026-08-18T10:10:00Z')
    }
  ]);
};
