const express = require('express');
const router = express.Router();
const db = require('../config/database');
const AgreementService = require('../services/agreementService');
const ExportService = require('../services/exportService');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const dayjs = require('dayjs');

/**
 * GET /api/reports/mfi
 * Consolidated MFI Report with active branches, current fees, and initial metrics
 */
router.get('/mfi', requireAuth, requirePermission('report.view'), async (req, res) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');

    const mfis = await db('mfi')
      .whereNull('deleted_at')
      .orderBy('short_name', 'asc');

    const reportData = await Promise.all(mfis.map(async (mfi, idx) => {
      const applicable = await AgreementService.getApplicableAgreement(mfi.id, today);
      const branchStats = await db('branches')
        .where('mfi_id', mfi.id)
        .whereNull('deleted_at')
        .select(
          db.raw('COUNT(*) as total'),
          db.raw("SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active"),
          db.raw("SUM(CASE WHEN branch_type = 'Branch Office' THEN 1 ELSE 0 END) as branch_offices"),
          db.raw("SUM(CASE WHEN branch_type = 'Area Office' THEN 1 ELSE 0 END) as area_offices"),
          db.raw("SUM(CASE WHEN branch_type = 'Zone Office' THEN 1 ELSE 0 END) as zone_offices")
        )
        .first();

      const activeBranches = parseInt(branchStats?.active || 0, 10);
      const licenseFee = applicable ? applicable.license_fee_per_branch : parseFloat(mfi.initial_license_fee);
      const omFee = applicable ? applicable.om_fee_per_branch : parseFloat(mfi.initial_om_fee);

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
    }));

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
 * GET /api/reports/renewal-due
 * Report showing expired agreements and agreements due for renewal
 */
router.get('/renewal-due', requireAuth, requirePermission('report.view'), async (req, res) => {
  try {
    const alerts = await AgreementService.getRenewalAlerts();
    res.json({
      success: true,
      data: alerts,
      generated_at: new Date()
    });
  } catch (error) {
    console.error('Error generating renewal due report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate renewal due report.' });
  }
});

module.exports = router;
