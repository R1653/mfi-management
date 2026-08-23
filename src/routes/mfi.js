const express = require('express');
const router = express.Router();
const db = require('../config/database');
const AgreementService = require('../services/agreementService');
const AuditService = require('../services/auditService');
const ExportService = require('../services/exportService');
const { paginate } = require('../utils/pagination');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const dayjs = require('dayjs');
const { computeBillableMonth } = require('../utils/billableMonth');

/**
 * GET /api/mfis/autocomplete
 * Searchable autocomplete endpoint (first 3 letters, short name, or full name)
 */
router.get('/autocomplete', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();

    let query = db('mfi')
      .whereNull('deleted_at')
      .select('id', 'short_name', 'full_name', 'status', 'om_grace_period_months')
      .orderBy('short_name', 'asc')
      .limit(20);

    if (q) {
      query = query.andWhere(function() {
        this.where('short_name', 'like', `%${q}%`)
            .orWhere('full_name', 'like', `%${q}%`);
      });
    }

    const results = await query;
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({ success: false, message: 'Failed to search MFIs.' });
  }
});

/**
 * GET /api/mfis/filter-options
 * Returns assigned team members and assigned team leaders for MFI list filter dropdowns
 */
router.get('/filter-options', requireAuth, async (req, res) => {
  try {
    // 1. All team members who are assigned to at least one active/non-deleted MFI
    const assignedMembers = await db('mfi')
      .join('team_members', 'mfi.team_member_id', 'team_members.id')
      .whereNull('mfi.deleted_at')
      .whereNull('team_members.deleted_at')
      .select('team_members.id', 'team_members.member_name', 'team_members.member_code')
      .distinct()
      .orderBy('team_members.member_name', 'asc');

    // 2. All team leaders who lead a team assigned to at least one MFI
    const teamLeaderQuery = await db('mfi')
      .join('teams', 'mfi.team_id', 'teams.id')
      .join('team_members', function() {
        this.on('team_members.team_id', '=', 'teams.id')
            .andOn('team_members.is_team_leader', '=', db.raw('1'));
      })
      .whereNull('mfi.deleted_at')
      .whereNull('teams.deleted_at')
      .whereNull('team_members.deleted_at')
      .select('team_members.id', 'team_members.member_name', 'team_members.member_code')
      .distinct();

    // Also include any assigned team_member_id if they are a leader
    const directLeaderQuery = await db('mfi')
      .join('team_members', 'mfi.team_member_id', 'team_members.id')
      .where('team_members.is_team_leader', 1)
      .whereNull('mfi.deleted_at')
      .whereNull('team_members.deleted_at')
      .select('team_members.id', 'team_members.member_name', 'team_members.member_code')
      .distinct();

    const leadersMap = new Map();
    [...teamLeaderQuery, ...directLeaderQuery].forEach(leader => {
      leadersMap.set(leader.id, leader);
    });
    const assignedLeaders = Array.from(leadersMap.values()).sort((a, b) => a.member_name.localeCompare(b.member_name));

    res.json({
      success: true,
      data: {
        assignedMembers,
        assignedLeaders
      }
    });
  } catch (error) {
    console.error('Error fetching MFI filter options:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve filter options.' });
  }
});

/**
 * GET /api/mfis
 * Paginated, searchable, filterable list of MFIs with current resolved fees
 */
router.get('/', requireAuth, requirePermission('mfi.view'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      team_member_id = '',
      team_leader_id = '',
      is_head_office_billable = '',
      sortBy = 'id',
      sortOrder = 'desc'
    } = req.query;

    let query = db('mfi')
      .leftJoin('teams', 'mfi.team_id', 'teams.id')
      .leftJoin('team_members', 'mfi.team_member_id', 'team_members.id')
      .whereNull('mfi.deleted_at')
      .select(
        'mfi.*',
        'teams.team_name',
        'teams.team_code',
        'team_members.member_name as team_member_name',
        'team_members.member_code as team_member_code'
      );

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.andWhere(function() {
        this.where('full_name', 'like', s)
            .orWhere('short_name', 'like', s);
      });
    }

    if (status) {
      query = query.andWhere('mfi.status', status);
    }

    if (team_member_id) {
      query = query.andWhere('mfi.team_member_id', team_member_id);
    }

    if (team_leader_id) {
      const leaderTeamRows = await db('team_members')
        .where('id', team_leader_id)
        .where('is_team_leader', 1)
        .whereNull('deleted_at')
        .select('team_id');
      const leaderTeamIds = leaderTeamRows.map(r => r.team_id).filter(Boolean);

      query = query.andWhere(function() {
        if (leaderTeamIds.length > 0) {
          this.whereIn('mfi.team_id', leaderTeamIds)
              .orWhere('mfi.team_member_id', team_leader_id);
        } else {
          this.where('mfi.team_member_id', team_leader_id);
        }
      });
    }

    if (is_head_office_billable === 'yes' || is_head_office_billable === '1') {
      query = query.andWhere('mfi.is_head_office_billable', 1);
    } else if (is_head_office_billable === 'no' || is_head_office_billable === '0') {
      query = query.andWhere('mfi.is_head_office_billable', 0);
    }

    // Allowed sort columns
    const validSortCols = ['id', 'full_name', 'short_name', 'establish_date', 'initial_agreement_date', 'status'];
    const col = validSortCols.includes(sortBy) ? sortBy : 'id';
    const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    query = query.orderBy(col, order);

    const result = await paginate(query, { page, limit });
    const today = dayjs().format('YYYY-MM-DD');

    // Enrich each MFI record with current applicable fee and live branch counts
    const enrichedData = await Promise.all(result.data.map(async (mfi, index) => {
      const applicableAgreement = await AgreementService.getApplicableAgreement(mfi.id, today);
      const branchCountRow = await db('branches')
        .where('mfi_id', mfi.id)
        .whereNull('deleted_at')
        .count('id as count')
        .first();

      return {
        ...mfi,
        sl: (result.pagination.page - 1) * result.pagination.limit + index + 1,
        current_license_fee: applicableAgreement ? applicableAgreement.license_fee_per_branch : parseFloat(mfi.initial_license_fee),
        current_om_fee: applicableAgreement ? applicableAgreement.om_fee_per_branch : parseFloat(mfi.initial_om_fee),
        current_fee_effective_date: applicableAgreement ? applicableAgreement.agreement_date : mfi.initial_agreement_date,
        total_branches: parseInt(branchCountRow?.count || 0, 10)
      };
    }));

    res.json({
      success: true,
      data: enrichedData,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching MFI list:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve MFIs.' });
  }
});

/**
 * GET /api/mfis/export
 * Export MFI list as Excel, CSV, or PDF
 */
router.get('/export', requireAuth, requirePermission('report.export'), async (req, res) => {
  try {
    const { format = 'xlsx', search = '', status = '' } = req.query;

    let query = db('mfi').whereNull('deleted_at').orderBy('id', 'asc');
    if (search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.andWhere(function() {
        this.where('full_name', 'like', s).orWhere('short_name', 'like', s);
      });
    }
    if (status) query = query.andWhere('status', status);

    const mfis = await query;
    const today = dayjs().format('YYYY-MM-DD');

    const enriched = await Promise.all(mfis.map(async (mfi, idx) => {
      const fee = await AgreementService.getApplicableAgreement(mfi.id, today);
      const branchCount = await db('branches').where('mfi_id', mfi.id).whereNull('deleted_at').count('* as c').first();
      return {
        sl: idx + 1,
        full_name: mfi.full_name,
        short_name: mfi.short_name,
        establish_date: dayjs(mfi.establish_date).format('YYYY-MM-DD'),
        initial_agreement_date: dayjs(mfi.initial_agreement_date).format('YYYY-MM-DD'),
        branches: branchCount?.c || 0,
        license_fee: fee ? fee.license_fee_per_branch : parseFloat(mfi.initial_license_fee),
        om_fee: fee ? fee.om_fee_per_branch : parseFloat(mfi.initial_om_fee),
        status: mfi.status.toUpperCase()
      };
    }));

    await AuditService.log({
      module: 'mfi',
      action: 'export',
      description: `Exported MFI directory in ${format.toUpperCase()} format`,
      req
    });

    const columns = [
      { header: 'SL', key: 'sl', width: 8 },
      { header: 'MFI Full Name', key: 'full_name', width: 32 },
      { header: 'Short Name', key: 'short_name', width: 14 },
      { header: 'Establish Date', key: 'establish_date', width: 15 },
      { header: 'Initial Agreement', key: 'initial_agreement_date', width: 16 },
      { header: 'Branches', key: 'branches', width: 10 },
      { header: 'License Fee', key: 'license_fee', width: 18 },
      { header: 'O&M Fee', key: 'om_fee', width: 18 },
      { header: 'Status', key: 'status', width: 12 }
    ];

    if (format === 'csv') {
      return ExportService.toCSV(res, 'mfi_directory_report', enriched);
    } else if (format === 'pdf') {
      const headers = columns.map(c => c.header);
      const rows = enriched.map(r => [
        r.sl.toString(),
        r.full_name,
        r.short_name,
        r.establish_date,
        r.initial_agreement_date,
        r.branches.toString(),
        r.license_fee.toLocaleString(),
        r.om_fee.toLocaleString(),
        r.status
      ]);
      return await ExportService.toPDF(res, 'mfi_directory_report', 'Microfinance Institutions (MFI) Directory', headers, rows);
    } else {
      // Excel default
      const buffer = await ExportService.toExcel({
        sheetName: 'MFI Directory',
        title: 'Microfinance Institutions (MFI) Directory Report',
        columns,
        data: enriched
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="mfi_directory_report.xlsx"');
      return res.send(buffer);
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Failed to export MFI data.' });
  }
});

/**
 * GET /api/mfis/:id
 * Detailed MFI Profile view (Basic Info, Current Fee, Branch Summary, Agreement History, Branch List)
 */
router.get('/:id', requireAuth, requirePermission('mfi.view'), async (req, res) => {
  try {
    const { id } = req.params;

    const mfi = await db('mfi')
      .where('mfi.id', id)
      .whereNull('mfi.deleted_at')
      .leftJoin('teams', 'mfi.team_id', 'teams.id')
      .leftJoin('team_members', 'mfi.team_member_id', 'team_members.id')
      .leftJoin('users as creator', 'mfi.created_by', 'creator.id')
      .leftJoin('users as updater', 'mfi.updated_by', 'updater.id')
      .select(
        'mfi.*',
        'teams.team_name',
        'teams.team_code',
        'team_members.member_name as team_member_name',
        'team_members.member_code as team_member_code',
        'creator.name as creator_name',
        'updater.name as updater_name'
      )
      .first();

    if (!mfi) {
      return res.status(404).json({
        success: false,
        message: 'MFI record not found.'
      });
    }

    const today = dayjs().format('YYYY-MM-DD');

    // 1. Current Fee
    const currentFee = await AgreementService.getApplicableAgreement(id, today);

    // 2. Branch Summary
    const branchStats = await db('branches')
      .where('mfi_id', id)
      .whereNull('deleted_at')
      .select(
        db.raw('COUNT(*) as total'),
        db.raw("SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active"),
        db.raw("SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive"),
        db.raw("SUM(CASE WHEN branch_type = 'Branch Office' THEN 1 ELSE 0 END) as branch_offices"),
        db.raw("SUM(CASE WHEN branch_type = 'Area Office' THEN 1 ELSE 0 END) as area_offices"),
        db.raw("SUM(CASE WHEN branch_type = 'Zone Office' THEN 1 ELSE 0 END) as zone_offices")
      )
      .first();

    // 3. Agreement History with Status Identification
    const agreementHistory = await AgreementService.getAgreementHistory(id, today);

    // 4. Branch List
    const branches = await db('branches')
      .where('mfi_id', id)
      .whereNull('deleted_at')
      .orderBy('branch_code', 'asc');

    res.json({
      success: true,
      data: {
        mfi,
        currentFee: currentFee || {
          license_fee_per_branch: parseFloat(mfi.initial_license_fee),
          om_fee_per_branch: parseFloat(mfi.initial_om_fee),
          agreement_date: mfi.initial_agreement_date
        },
        branchSummary: {
          total: parseInt(branchStats.total || 0, 10),
          active: parseInt(branchStats.active || 0, 10),
          inactive: parseInt(branchStats.inactive || 0, 10),
          branch_offices: parseInt(branchStats.branch_offices || 0, 10),
          area_offices: parseInt(branchStats.area_offices || 0, 10),
          zone_offices: parseInt(branchStats.zone_offices || 0, 10)
        },
        agreementHistory,
        branches
      }
    });
  } catch (error) {
    console.error('Error fetching MFI profile:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve MFI details.' });
  }
});

/**
 * POST /api/mfis
 * Create a new MFI & auto-generate initial agreement record
 */
router.post('/', requireAuth, requirePermission('mfi.create'), async (req, res) => {
  const trx = await db.transaction();
  try {
    const {
      full_name,
      short_name,
      establish_date,
      initial_agreement_date,
      initial_license_fee = 0,
      initial_om_fee = 0,
      initial_branch_count = 0,
      is_head_office_billable = false,
      om_grace_period_months = null,
      team_id = null,
      team_member_id = null,
      status = 'active'
    } = req.body;

    // Validation
    if (!full_name || !full_name.trim()) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: 'MFI Full Name is required.' });
    }

    if (!short_name || !short_name.trim()) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: 'MFI Short Name is required.' });
    }

    const cleanShortName = short_name.trim().toUpperCase();

    // Check uniqueness
    const existing = await trx('mfi')
      .where('short_name', cleanShortName)
      .whereNull('deleted_at')
      .first();

    if (existing) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: 'MFI Short Name already exists.' });
    }

    if (!establish_date) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: 'MFI Establish Date is required.' });
    }

    if (!initial_agreement_date) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: 'Initial Agreement Date is required.' });
    }

    const licenseFeeNum = parseFloat(initial_license_fee);
    const omFeeNum = parseFloat(initial_om_fee);
    const branchCountNum = parseInt(initial_branch_count, 10);

    if (isNaN(licenseFeeNum) || licenseFeeNum < 0) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: 'License Fee cannot be negative.' });
    }

    if (isNaN(omFeeNum) || omFeeNum < 0) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: 'O&M Fee cannot be negative.' });
    }

    if (isNaN(branchCountNum) || branchCountNum < 0) {
      await trx.rollback();
      return res.status(400).json({ success: false, message: 'Initial Branch Count cannot be negative.' });
    }

    const isHeadOfficeBillable = (
      is_head_office_billable === true ||
      is_head_office_billable === 1 ||
      is_head_office_billable === '1' ||
      is_head_office_billable === 'yes' ||
      is_head_office_billable === 'true'
    );

    const userId = req.session.user.id;

    // Parse grace period: must be an integer (positive or negative) or null
    let omGracePeriodMonths = null;
    if (om_grace_period_months !== null && om_grace_period_months !== '' && om_grace_period_months !== undefined) {
      const parsed = parseInt(om_grace_period_months, 10);
      if (!isNaN(parsed)) omGracePeriodMonths = parsed;
    }

    // 1. Insert MFI
    const [mfiId] = await trx('mfi').insert({
      full_name: full_name.trim(),
      short_name: cleanShortName,
      establish_date: dayjs(establish_date).format('YYYY-MM-DD'),
      initial_agreement_date: dayjs(initial_agreement_date).format('YYYY-MM-DD'),
      initial_license_fee: licenseFeeNum,
      initial_om_fee: omFeeNum,
      initial_branch_count: branchCountNum,
      is_head_office_billable: isHeadOfficeBillable ? 1 : 0,
      om_grace_period_months: omGracePeriodMonths,
      team_id: team_id ? parseInt(team_id, 10) : null,
      team_member_id: team_member_id ? parseInt(team_member_id, 10) : null,
      status: status === 'inactive' ? 'inactive' : 'active',
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date()
    });

    // 2. Automatically create initial agreement record for future billing accuracy!
    await trx('mfi_agreements').insert({
      mfi_id: mfiId,
      agreement_date: dayjs(initial_agreement_date).format('YYYY-MM-DD'),
      license_fee_per_branch: licenseFeeNum,
      om_fee_per_branch: omFeeNum,
      remarks: 'Initial agreement created during MFI registration.',
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date()
    });

    // 3. If Head Office is billable, create Head Office branch record
    if (isHeadOfficeBillable) {
      const hoBillableMonth = computeBillableMonth(initial_agreement_date, omGracePeriodMonths);
      await trx('branches').insert({
        mfi_id: mfiId,
        branch_name: `${cleanShortName} Head Office`,
        branch_code: 'HO-01',
        branch_opening_date: dayjs(establish_date).format('YYYY-MM-DD'),
        software_start_date: dayjs(initial_agreement_date).format('YYYY-MM-DD'),
        billable_month: hoBillableMonth,
        branch_type: 'Branch Office',
        status: 'active',
        created_by: userId,
        updated_by: userId,
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    await trx.commit();

    // Audit Log
    await AuditService.log({
      userId,
      module: 'mfi',
      action: 'create',
      recordId: mfiId,
      newValue: {
        full_name,
        short_name: cleanShortName,
        initial_license_fee: licenseFeeNum,
        initial_om_fee: omFeeNum,
        is_head_office_billable: isHeadOfficeBillable
      },
      description: `MFI '${full_name.trim()}' (${cleanShortName}) created with initial agreement. Head office billable: ${isHeadOfficeBillable ? 'Yes' : 'No'}.`,
      req
    });

    res.status(201).json({
      success: true,
      message: 'MFI has been created successfully.',
      mfiId,
      data: { id: mfiId }
    });
  } catch (error) {
    await trx.rollback();
    console.error('Error creating MFI:', error);
    // Detect SQLite UNIQUE constraint violation on short_name
    if (error.code === 'SQLITE_CONSTRAINT' || (error.message && error.message.includes('UNIQUE'))) {
      return res.status(400).json({ success: false, message: 'MFI Short Name already exists. Please use a unique Short Name.' });
    }
    res.status(500).json({ success: false, message: 'Unable to save MFI. An unexpected error occurred.' });
  }
});

/**
 * PUT /api/mfis/:id
 * Update MFI basic information
 */
router.put('/:id', requireAuth, requirePermission('mfi.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      full_name,
      short_name,
      establish_date,
      is_head_office_billable,
      om_grace_period_months,
      team_id,
      team_member_id,
      status
    } = req.body;

    const existing = await db('mfi')
      .where('id', id)
      .whereNull('deleted_at')
      .first();

    if (!existing) {
      return res.status(404).json({ success: false, message: 'MFI record not found.' });
    }

    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ success: false, message: 'MFI Full Name is required.' });
    }

    if (!short_name || !short_name.trim()) {
      return res.status(400).json({ success: false, message: 'MFI Short Name is required.' });
    }

    const cleanShortName = short_name.trim().toUpperCase();

    // Check duplicate short name on other MFIs
    const duplicate = await db('mfi')
      .where('short_name', cleanShortName)
      .whereNot('id', id)
      .whereNull('deleted_at')
      .first();

    if (duplicate) {
      return res.status(400).json({ success: false, message: 'MFI Short Name already exists.' });
    }

    const userId = req.session.user.id;
    const updatePayload = {
      full_name: full_name.trim(),
      short_name: cleanShortName,
      updated_by: userId,
      updated_at: new Date()
    };

    if (establish_date) {
      updatePayload.establish_date = dayjs(establish_date).format('YYYY-MM-DD');
    }

    if (is_head_office_billable !== undefined) {
      const isHeadOfficeBillable = (
        is_head_office_billable === true ||
        is_head_office_billable === 1 ||
        is_head_office_billable === '1' ||
        is_head_office_billable === 'yes' ||
        is_head_office_billable === 'true'
      );
      updatePayload.is_head_office_billable = isHeadOfficeBillable ? 1 : 0;

      if (isHeadOfficeBillable && !existing.is_head_office_billable) {
        const existingHO = await db('branches')
          .where('mfi_id', id)
          .where('branch_code', 'HO-01')
          .whereNull('deleted_at')
          .first();
        if (!existingHO) {
          const hoSoftwareStart = existing.initial_agreement_date;
          const hoGrace = updatePayload.om_grace_period_months !== undefined
            ? updatePayload.om_grace_period_months
            : existing.om_grace_period_months;
          const hoBillableMonth = computeBillableMonth(hoSoftwareStart, hoGrace);
          await db('branches').insert({
            mfi_id: id,
            branch_name: `${cleanShortName} Head Office`,
            branch_code: 'HO-01',
            branch_opening_date: dayjs(existing.establish_date).format('YYYY-MM-DD'),
            software_start_date: dayjs(existing.initial_agreement_date).format('YYYY-MM-DD'),
            billable_month: hoBillableMonth,
            branch_type: 'Branch Office',
            status: 'active',
            created_by: userId,
            updated_by: userId,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      }
    }

    if (team_id !== undefined) {
      updatePayload.team_id = team_id ? parseInt(team_id, 10) : null;
    }

    if (team_member_id !== undefined) {
      updatePayload.team_member_id = team_member_id ? parseInt(team_member_id, 10) : null;
    }

    if (status && ['active', 'inactive'].includes(status)) {
      updatePayload.status = status;
    }

    // Grace period for O&M: allow 0, positive, or negative integers; null clears the field
    if (om_grace_period_months !== undefined) {
      if (om_grace_period_months === null || om_grace_period_months === '') {
        updatePayload.om_grace_period_months = null;
      } else {
        const parsed = parseInt(om_grace_period_months, 10);
        if (!isNaN(parsed)) updatePayload.om_grace_period_months = parsed;
      }
    }

    await db('mfi').where('id', id).update(updatePayload);

    await AuditService.log({
      userId,
      module: 'mfi',
      action: 'update',
      recordId: id,
      oldValue: { full_name: existing.full_name, short_name: existing.short_name, status: existing.status },
      newValue: updatePayload,
      description: `MFI #${id} '${cleanShortName}' details updated.`,
      req
    });

    res.json({
      success: true,
      message: 'MFI has been updated successfully.'
    });
  } catch (error) {
    console.error('Error updating MFI:', error);
    if (error.code === 'SQLITE_CONSTRAINT' || (error.message && error.message.includes('UNIQUE'))) {
      return res.status(400).json({ success: false, message: 'MFI Short Name already exists. Please use a unique Short Name.' });
    }
    res.status(500).json({ success: false, message: 'Unable to update MFI. An unexpected error occurred.' });
  }
});

/**
 * PATCH /api/mfis/:id/status
 * Activate or Deactivate an MFI
 */
router.patch('/:id/status', requireAuth, requirePermission('mfi.status'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const mfi = await db('mfi').where('id', id).whereNull('deleted_at').first();
    if (!mfi) {
      return res.status(404).json({ success: false, message: 'MFI not found.' });
    }

    await db('mfi').where('id', id).update({
      status,
      updated_by: req.session.user.id,
      updated_at: new Date()
    });

    await AuditService.log({
      userId: req.session.user.id,
      module: 'mfi',
      action: status === 'active' ? 'activate' : 'deactivate',
      recordId: id,
      oldValue: { status: mfi.status },
      newValue: { status },
      description: `Changed status of MFI '${mfi.short_name}' to ${status}.`,
      req
    });

    res.json({
      success: true,
      message: `MFI '${mfi.short_name}' has been ${status === 'active' ? 'activated' : 'deactivated'} successfully.`
    });
  } catch (error) {
    console.error('Status change error:', error);
    res.status(500).json({ success: false, message: 'Failed to update status.' });
  }
});

/**
 * DELETE /api/mfis/:id
 * Soft delete MFI record (Super Admin or mfi.delete permission)
 * Blocked if the MFI still has any non-deleted branch records.
 */
router.delete('/:id', requireAuth, requirePermission('mfi.delete'), async (req, res) => {
  try {
    const { id } = req.params;

    const mfi = await db('mfi').where('id', id).whereNull('deleted_at').first();
    if (!mfi) {
      return res.status(404).json({ success: false, message: 'MFI not found.' });
    }

    // Block deletion if the MFI still has active branches
    const branchCountRow = await db('branches')
      .where('mfi_id', id)
      .whereNull('deleted_at')
      .count('id as count')
      .first();

    const branchCount = parseInt(branchCountRow?.count || 0, 10);

    if (branchCount > 0) {
      return res.status(409).json({
        success: false,
        message: `This MFI has ${branchCount} branch office${branchCount > 1 ? 's' : ''}. Please delete all branches first before removing the MFI.`,
        branchCount
      });
    }

    await db('mfi').where('id', id).update({
      deleted_at: new Date(),
      updated_by: req.session.user.id,
      updated_at: new Date()
    });

    await AuditService.log({
      userId: req.session.user.id,
      module: 'mfi',
      action: 'delete',
      recordId: id,
      oldValue: { full_name: mfi.full_name, short_name: mfi.short_name },
      description: `Soft-deleted MFI '${mfi.short_name}' (ID: ${id})`,
      req
    });

    res.json({
      success: true,
      message: 'MFI has been removed successfully.'
    });
  } catch (error) {
    console.error('Error deleting MFI:', error);
    res.status(500).json({ success: false, message: 'Failed to delete MFI.' });
  }
});

module.exports = router;
