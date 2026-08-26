const express = require('express');
const router = express.Router();
const db = require('../config/database');
const AgreementService = require('../services/agreementService');
const ExportService = require('../services/exportService');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const dayjs = require('dayjs');

/**
 * Helper function to generate MFI master report data with filters
 */
async function generateMfiReportData(queryParams) {
  const {
    search = '',
    status = '',
    team_member_id = '',
    team_leader_id = '',
    is_head_office_billable = ''
  } = queryParams;

  const today = dayjs().format('YYYY-MM-DD');

  let query = db('mfi')
    .leftJoin('teams', 'mfi.team_id', 'teams.id')
    .leftJoin('team_members', 'mfi.team_member_id', 'team_members.id')
    .whereNull('mfi.deleted_at');

  if (search.trim()) {
    const s = `%${search.trim()}%`;
    query = query.andWhere(function() {
      this.where('mfi.full_name', 'like', s)
          .orWhere('mfi.short_name', 'like', s);
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

  const mfis = await query.orderBy('mfi.short_name', 'asc').select('mfi.*');
  const mfiIds = mfis.map(m => m.id);

  // Batch query 1: Batch fetch all applicable agreements
  const applicableMap = await AgreementService.getApplicableAgreementsForMfis(mfiIds, today);

  // Batch query 2: Batch fetch branch stats grouped by mfi_id
  const statsRows = mfiIds.length > 0 ? await db('branches')
    .whereIn('mfi_id', mfiIds)
    .whereNull('deleted_at')
    .groupBy('mfi_id')
    .select(
      'mfi_id',
      db.raw('COUNT(*) as total'),
      db.raw("SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active"),
      db.raw("SUM(CASE WHEN branch_type = 'Branch Office' THEN 1 ELSE 0 END) as branch_offices"),
      db.raw("SUM(CASE WHEN branch_type = 'Area Office' THEN 1 ELSE 0 END) as area_offices"),
      db.raw("SUM(CASE WHEN branch_type = 'Zone Office' THEN 1 ELSE 0 END) as zone_offices")
    ) : [];
  const statsMap = new Map(statsRows.map(r => [r.mfi_id, r]));

  const reportData = mfis.map((mfi, idx) => {
    const applicable = applicableMap.get(mfi.id);
    const branchStats = statsMap.get(mfi.id);

    const activeBranches = parseInt(branchStats?.active || 0, 10);
    const licenseFee = applicable ? applicable.license_fee_per_branch : parseFloat(mfi.initial_license_fee || 0);
    const omFee = applicable ? applicable.om_fee_per_branch : parseFloat(mfi.initial_om_fee || 0);

    // Estimated Monthly Total Fee
    const monthlyTotal = (licenseFee + omFee) * activeBranches;

    return {
      sl: idx + 1,
      id: mfi.id,
      short_name: mfi.short_name,
      full_name: mfi.full_name,
      establish_date: dayjs(mfi.establish_date).format('YYYY-MM-DD'),
      initial_agreement_date: dayjs(mfi.initial_agreement_date).format('YYYY-MM-DD'),
      total_branches: parseInt(branchStats?.total || 0, 10),
      active_branches: activeBranches,
      branch_offices: parseInt(branchStats?.branch_offices || 0, 10),
      area_offices: parseInt(branchStats?.area_offices || 0, 10),
      zone_offices: parseInt(branchStats?.zone_offices || 0, 10),
      current_license_fee: licenseFee,
      current_om_fee: omFee,
      monthly_projected_total: monthlyTotal,
      status: mfi.status
    };
  });

  return reportData;

  return reportData;
}

/**
 * GET /api/reports/mfi
 * Consolidated MFI Report with active branches, current fees, and initial metrics
 */
router.get('/mfi', requireAuth, requirePermission('report.view'), async (req, res) => {
  try {
    const reportData = await generateMfiReportData(req.query);
    res.json({
      success: true,
      data: reportData,
      generated_at: new Date()
    });
  } catch (error) {
    console.error('Error generating MFI report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate MFI report.' });
  }
});

/**
 * GET /api/reports/mfi/export
 * Export MFI Master Report as Excel, CSV, or PDF
 */
router.get('/mfi/export', requireAuth, requirePermission('report.export'), async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();
    const data = await generateMfiReportData(req.query);
    const filename = 'mfi_master_report';

    const columns = [
      { header: 'SL', key: 'sl', width: 8 },
      { header: 'MFI Full Name', key: 'full_name', width: 32 },
      { header: 'Short Code', key: 'short_name', width: 14 },
      { header: 'Establish Date', key: 'establish_date', width: 15 },
      { header: 'Active Branches', key: 'active_branches', width: 16 },
      { header: 'License Fee', key: 'current_license_fee', width: 18 },
      { header: 'O&M Fee', key: 'current_om_fee', width: 18 },
      { header: 'Projected Monthly Total', key: 'monthly_projected_total', width: 24 }
    ];

    if (format === 'csv') {
      const csvRows = data.map(r => ({
        'SL': r.sl,
        'MFI Full Name': r.full_name,
        'Short Code': r.short_name,
        'Establish Date': r.establish_date,
        'Active Branches': r.active_branches,
        'License Fee': r.current_license_fee,
        'O&M Fee': r.current_om_fee,
        'Projected Monthly Total': r.monthly_projected_total
      }));
      return ExportService.toCSV(res, filename, csvRows);
    } else if (format === 'pdf') {
      const headers = columns.map(c => c.header);
      const rows = data.map(r => [
        r.sl.toString(),
        r.full_name,
        r.short_name,
        r.establish_date,
        r.active_branches.toString(),
        r.current_license_fee.toLocaleString(),
        r.current_om_fee.toLocaleString(),
        r.monthly_projected_total.toLocaleString()
      ]);
      return await ExportService.toPDF(res, filename, 'Microfinance Institutions Master Report', headers, rows);
    } else {
      const buffer = await ExportService.toExcel({
        sheetName: 'MFI Master Report',
        title: 'Microfinance Institutions Master Report',
        columns,
        data
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.send(buffer);
    }
  } catch (error) {
    console.error('Error exporting MFI report:', error);
    res.status(500).json({ success: false, message: 'Failed to export MFI report.' });
  }
});

/**
 * Helper function to generate O & M bill report data
 */
async function generateOmBillReportData(queryParams) {
  const {
    search,
    mfi_id,
    team_id,
    team_member_id,
    reporting_month,
    min_branches,
    max_branches
  } = queryParams;

  const targetReportingMonth = reporting_month && /^\d{4}-\d{2}$/.test(reporting_month)
    ? reporting_month
    : dayjs().format('YYYY-MM');

  const lastMonth = dayjs(`${targetReportingMonth}-01`).subtract(1, 'month').format('YYYY-MM');

  // Base query for MFI with team member info
  let query = db('mfi')
    .leftJoin('team_members', 'mfi.team_member_id', 'team_members.id')
    .leftJoin('teams', 'mfi.team_id', 'teams.id')
    .whereNull('mfi.deleted_at')
    .select(
      'mfi.id',
      'mfi.short_name',
      'mfi.full_name',
      'mfi.is_head_office_billable',
      'mfi.team_id',
      'mfi.team_member_id',
      'team_members.member_name as team_member_name',
      'teams.team_name'
    );

  if (mfi_id) {
    query = query.where('mfi.id', mfi_id);
  }
  if (team_id) {
    query = query.where('mfi.team_id', team_id);
  }
  if (team_member_id) {
    query = query.where('mfi.team_member_id', team_member_id);
  }
  if (search) {
    const term = `%${search.trim()}%`;
    query = query.where(function() {
      this.where('mfi.short_name', 'like', term)
        .orWhere('mfi.full_name', 'like', term)
        .orWhere('team_members.member_name', 'like', term);
    });
  }

  const mfis = await query.orderBy('mfi.short_name', 'asc');
  const mfiIds = mfis.map(m => m.id);

  // Batch query: Fetch all branch offices for matching MFIs in ONE single query
  const allBranches = mfiIds.length > 0 ? await db('branches')
    .whereIn('mfi_id', mfiIds)
    .where('branch_type', 'Branch Office')
    .whereNull('deleted_at')
    .select('mfi_id', 'branch_name', 'branch_code', 'billable_month') : [];

  const branchGroupMap = new Map();
  allBranches.forEach(b => {
    if (!branchGroupMap.has(b.mfi_id)) branchGroupMap.set(b.mfi_id, []);
    branchGroupMap.get(b.mfi_id).push(b);
  });

  let reportRows = mfis.map((mfi) => {
    const branches = branchGroupMap.get(mfi.id) || [];

    let lastMonthCount = 0;
    let newBillableCount = 0;
    const newBillableNames = [];

    branches.forEach(b => {
      if (b.billable_month <= lastMonth) {
        lastMonthCount++;
      } else if (b.billable_month === targetReportingMonth) {
        newBillableCount++;
        newBillableNames.push(`${b.branch_name} (${b.branch_code})`);
      }
    });

    const totalOmBillCurrentMonth = lastMonthCount + newBillableCount;
    const isHoBillable = Boolean(mfi.is_head_office_billable);
    const headOfficeBillableStr = isHoBillable ? 'Yes' : 'No';
    const totalBranchWithHo = totalOmBillCurrentMonth + (isHoBillable ? 1 : 0);

    return {
      mfi_id: mfi.id,
      short_name: mfi.short_name,
      full_name: mfi.full_name,
      team_member_name: mfi.team_member_name || 'N/A',
      team_name: mfi.team_name || 'N/A',
      last_month_billable_branches: lastMonthCount,
      new_billable_branches: newBillableCount,
      new_billable_branch_names: newBillableNames.length > 0 ? newBillableNames.join(', ') : '—',
      total_om_bill_current_month: totalOmBillCurrentMonth,
      head_office_billable: headOfficeBillableStr,
      total_branch_with_ho: totalBranchWithHo
    };
  });

  // Apply branch range filters (min_branches / max_branches against total_branch_with_ho)
  if (min_branches !== undefined && min_branches !== null && min_branches !== '') {
    const minVal = parseInt(min_branches, 10);
    if (!isNaN(minVal)) {
      reportRows = reportRows.filter(r => r.total_branch_with_ho >= minVal);
    }
  }
  if (max_branches !== undefined && max_branches !== null && max_branches !== '') {
    const maxVal = parseInt(max_branches, 10);
    if (!isNaN(maxVal)) {
      reportRows = reportRows.filter(r => r.total_branch_with_ho <= maxVal);
    }
  }

  // Add serial number (SL)
  const rowsWithSl = reportRows.map((row, idx) => ({
    sl: idx + 1,
    ...row
  }));

  // Summary Totals
  const summary = {
    total_mfis: rowsWithSl.length,
    total_last_month_branches: rowsWithSl.reduce((sum, r) => sum + r.last_month_billable_branches, 0),
    total_new_billable_branches: rowsWithSl.reduce((sum, r) => sum + r.new_billable_branches, 0),
    total_om_bill_current_month: rowsWithSl.reduce((sum, r) => sum + r.total_om_bill_current_month, 0),
    total_ho_billable: rowsWithSl.reduce((sum, r) => sum + (r.head_office_billable === 'Yes' ? 1 : 0), 0),
    total_branch_with_ho: rowsWithSl.reduce((sum, r) => sum + r.total_branch_with_ho, 0)
  };

  return {
    reporting_month: targetReportingMonth,
    last_month: lastMonth,
    summary,
    rows: rowsWithSl
  };
}

/**
 * GET /api/reports/renewal-due
 * Agreement Renewal Due & Expiry Report API Endpoint
 */
router.get('/renewal-due', requireAuth, requirePermission('report.view'), async (req, res) => {
  try {
    const alerts = await AgreementService.getRenewalAlerts();
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Error fetching renewal due alerts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch renewal due alerts.' });
  }
});

/**
 * GET /api/reports/om-bill
 * O & M Bill Report API Endpoint
 */
router.get('/om-bill', requireAuth, requirePermission('report.view'), async (req, res) => {
  try {
    const data = await generateOmBillReportData(req.query);
    res.json({
      success: true,
      data,
      generated_at: new Date()
    });
  } catch (error) {
    console.error('Error generating O & M bill report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate O & M bill report.' });
  }
});

/**
 * GET /api/reports/om-bill/export
 * Export O & M Bill Report as Excel or CSV
 */
router.get('/om-bill/export', requireAuth, requirePermission('report.export'), async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();
    const result = await generateOmBillReportData(req.query);
    const filename = `OM_Bill_Report_${result.reporting_month}`;

    const columns = [
      { header: 'SL', key: 'sl', width: 8 },
      { header: 'MFI Short Name', key: 'short_name', width: 20 },
      { header: 'Team Member Name', key: 'team_member_name', width: 25 },
      { header: 'Total O&M Billing Branch (Last Month)', key: 'last_month_billable_branches', width: 35 },
      { header: 'New Billable Branch (Reporting Month)', key: 'new_billable_branches', width: 35 },
      { header: 'Name & ID of New Billable Branches', key: 'new_billable_branch_names', width: 45 },
      { header: 'Total O&M Bill (Current Month)', key: 'total_om_bill_current_month', width: 30 },
      { header: 'Head office Billable', key: 'head_office_billable', width: 20 },
      { header: 'Total Branch (With HO)', key: 'total_branch_with_ho', width: 25 }
    ];

    if (format === 'csv') {
      const csvRows = result.rows.map(r => ({
        'SL': r.sl,
        'MFI Short Name': r.short_name,
        'Team Member Name': r.team_member_name,
        'Total O&M Billing Branch (Last Month)': r.last_month_billable_branches,
        'New Billable Branch (Reporting Month)': r.new_billable_branches,
        'Name & ID of New Billable Branches': r.new_billable_branch_names,
        'Total O&M Bill (Current Month)': r.total_om_bill_current_month,
        'Head office Billable': r.head_office_billable,
        'Total Branch (With HO)': r.total_branch_with_ho
      }));
      return ExportService.toCSV(res, filename, csvRows);
    }

    const buffer = await ExportService.toExcel({
      sheetName: 'O&M Bill Report',
      title: `O & M Bill Report — ${result.reporting_month}`,
      columns,
      data: result.rows
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting O & M bill report:', error);
    res.status(500).json({ success: false, message: 'Failed to export O & M bill report.' });
  }
});

/**
 * Helper function to generate Licence bill report data with filters
 */
async function generateLicenceBillReportData(queryParams) {
  const {
    search = '',
    mfi_id = '',
    team_id = '',
    team_member_id = '',
    reporting_month = ''
  } = queryParams;

  const targetReportingMonth = reporting_month && /^\d{4}-\d{2}$/.test(reporting_month)
    ? reporting_month
    : dayjs().format('YYYY-MM');

  const lastMonth = dayjs(`${targetReportingMonth}-01`).subtract(1, 'month').format('YYYY-MM');

  let query = db('mfi')
    .leftJoin('team_members', 'mfi.team_member_id', 'team_members.id')
    .leftJoin('teams', 'mfi.team_id', 'teams.id')
    .whereNull('mfi.deleted_at')
    .select(
      'mfi.id',
      'mfi.short_name',
      'mfi.full_name',
      'mfi.team_id',
      'mfi.team_member_id',
      'team_members.member_name as team_member_name',
      'teams.team_name'
    );

  if (mfi_id) {
    query = query.where('mfi.id', mfi_id);
  }
  if (team_id) {
    query = query.where('mfi.team_id', team_id);
  }
  if (team_member_id) {
    query = query.where('mfi.team_member_id', team_member_id);
  }
  if (search) {
    const term = `%${search.trim()}%`;
    query = query.where(function() {
      this.where('mfi.short_name', 'like', term)
        .orWhere('mfi.full_name', 'like', term)
        .orWhere('team_members.member_name', 'like', term);
    });
  }

  const mfis = await query.orderBy('mfi.short_name', 'asc');
  const mfiIds = mfis.map(m => m.id);

  // Batch query: Fetch all branch offices for matching MFIs in ONE single query
  const allBranches = mfiIds.length > 0 ? await db('branches')
    .whereIn('mfi_id', mfiIds)
    .where('branch_type', 'Branch Office')
    .whereNull('deleted_at')
    .select('mfi_id', 'branch_name', 'branch_code', 'branch_opening_date', 'created_at') : [];

  const branchGroupMap = new Map();
  allBranches.forEach(b => {
    if (!branchGroupMap.has(b.mfi_id)) branchGroupMap.set(b.mfi_id, []);
    branchGroupMap.get(b.mfi_id).push(b);
  });

  let reportRows = mfis.map((mfi) => {
    const branches = branchGroupMap.get(mfi.id) || [];

    let lastMonthCount = 0;
    let newLicenceCount = 0;
    const newLicenceNames = [];

    branches.forEach(b => {
      const dateStr = b.created_at
        ? dayjs(b.created_at).format('YYYY-MM-DD')
        : (b.branch_opening_date ? dayjs(b.branch_opening_date).format('YYYY-MM-DD') : '');
      const createdMonth = dateStr ? dateStr.substring(0, 7) : '';

      if (createdMonth && createdMonth < targetReportingMonth) {
        lastMonthCount++;
      } else if (createdMonth === targetReportingMonth) {
        newLicenceCount++;
        newLicenceNames.push(`${b.branch_name} (${b.branch_code})`);
      }
    });

    const totalLicenceBilled = lastMonthCount + newLicenceCount;

    return {
      mfi_id: mfi.id,
      short_name: mfi.short_name,
      full_name: mfi.full_name,
      team_member_name: mfi.team_member_name || 'N/A',
      team_name: mfi.team_name || 'N/A',
      last_month_licence_branches: lastMonthCount,
      new_licence_branches: newLicenceCount,
      new_licence_branch_names: newLicenceNames.length > 0 ? newLicenceNames.join(', ') : '—',
      total_licence_billed: totalLicenceBilled
    };
  });

  const rowsWithSl = reportRows.map((row, idx) => ({
    sl: idx + 1,
    ...row
  }));

  const summary = {
    total_mfis: rowsWithSl.length,
    total_last_month_licence_branches: rowsWithSl.reduce((sum, r) => sum + r.last_month_licence_branches, 0),
    total_new_licence_branches: rowsWithSl.reduce((sum, r) => sum + r.new_licence_branches, 0),
    total_licence_billed: rowsWithSl.reduce((sum, r) => sum + r.total_licence_billed, 0)
  };

  return {
    reporting_month: targetReportingMonth,
    last_month: lastMonth,
    summary,
    rows: rowsWithSl
  };
}

/**
 * GET /api/reports/licence-bill
 * Licence Bill Report API Endpoint
 */
router.get('/licence-bill', requireAuth, requirePermission('report.view'), async (req, res) => {
  try {
    const data = await generateLicenceBillReportData(req.query);
    res.json({
      success: true,
      data,
      generated_at: new Date()
    });
  } catch (error) {
    console.error('Error generating Licence bill report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate Licence bill report.' });
  }
});

/**
 * GET /api/reports/licence-bill/export
 * Export Licence Bill Report as Excel or CSV
 */
router.get('/licence-bill/export', requireAuth, requirePermission('report.export'), async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();
    const result = await generateLicenceBillReportData(req.query);
    const filename = `Licence_Bill_Report_${result.reporting_month}`;

    const columns = [
      { header: 'SL', key: 'sl', width: 8 },
      { header: 'MFI Short Name', key: 'short_name', width: 20 },
      { header: 'Team Member Name', key: 'team_member_name', width: 25 },
      { header: 'Total Licence Billing Branch (Last Month)', key: 'last_month_licence_branches', width: 35 },
      { header: 'New Licence Billable Branch (Reporting Month)', key: 'new_licence_branches', width: 35 },
      { header: 'Name & ID of New Licence Billable Branches', key: 'new_licence_branch_names', width: 45 },
      { header: 'Total Total Licence Billed as of Current Month', key: 'total_licence_billed', width: 35 }
    ];

    if (format === 'csv') {
      const csvRows = result.rows.map(r => ({
        'SL': r.sl,
        'MFI Short Name': r.short_name,
        'Team Member Name': r.team_member_name,
        'Total Licence Billing Branch (Last Month)': r.last_month_licence_branches,
        'New Licence Billable Branch (Reporting Month)': r.new_licence_branches,
        'Name & ID of New Licence Billable Branches': r.new_licence_branch_names,
        'Total Total Licence Billed as of Current Month': r.total_licence_billed
      }));
      return ExportService.toCSV(res, filename, csvRows);
    }

    const buffer = await ExportService.toExcel({
      sheetName: 'Licence Bill Report',
      title: `Licence Bill Report — ${result.reporting_month}`,
      columns,
      data: result.rows
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting Licence bill report:', error);
    res.status(500).json({ success: false, message: 'Failed to export Licence bill report.' });
  }
});

module.exports = router;
