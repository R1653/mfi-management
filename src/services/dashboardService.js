const db = require('../config/database');
const AgreementService = require('./agreementService');
const dayjs = require('dayjs');

class DashboardService {
  /**
   * Fetch all aggregated metrics, card statistics, and 7 chart datasets
   * @returns {Promise<Object>}
   */
  static async getDashboardData() {
    const today = dayjs().format('YYYY-MM-DD');

    // 1. MFI Counts
    const mfiCounts = await db('mfi')
      .whereNull('deleted_at')
      .select(
        db.raw('COUNT(*) as total'),
        db.raw("SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active"),
        db.raw("SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive")
      )
      .first();

    // 2. Branch Counts & Types
    const branchCounts = await db('branches')
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

    // 3. Agreements Expiring / Alerts
    const renewalAlerts = await AgreementService.getRenewalAlerts();
    const expiringSoonCount = (renewalAlerts.within_30?.length || 0) + 
                              (renewalAlerts.within_60?.length || 0) + 
                              (renewalAlerts.within_90?.length || 0);

    // 4. MFI-wise Branch Count
    const mfiBranchCounts = await db('mfi')
      .leftJoin('branches', function() {
        this.on('mfi.id', '=', 'branches.mfi_id')
            .andOnNull('branches.deleted_at');
      })
      .whereNull('mfi.deleted_at')
      .groupBy('mfi.id', 'mfi.short_name', 'mfi.full_name')
      .select(
        'mfi.id',
        'mfi.short_name',
        'mfi.full_name',
        db.raw('COUNT(branches.id) as branch_count')
      )
      .orderBy('branch_count', 'desc');

    // 5. Current Fees per MFI (using AgreementService getApplicableAgreement for each MFI!)
    const activeMfis = await db('mfi')
      .whereNull('deleted_at')
      .select('id', 'short_name', 'full_name', 'status');

    const mfiFeesList = [];
    for (const mfi of activeMfis) {
      const applicable = await AgreementService.getApplicableAgreement(mfi.id, today);
      mfiFeesList.push({
        id: mfi.id,
        short_name: mfi.short_name,
        full_name: mfi.full_name,
        license_fee: applicable ? applicable.license_fee_per_branch : 0,
        om_fee: applicable ? applicable.om_fee_per_branch : 0
      });
    }

    // 6. Agreement Renewal Trend by Year
    const agreementTrend = await db('mfi_agreements')
      .select(
        db.raw("strftime('%Y', agreement_date) as year"),
        db.raw('COUNT(*) as count'),
        db.raw('AVG(license_fee_per_branch) as avg_license_fee'),
        db.raw('AVG(om_fee_per_branch) as avg_om_fee')
      )
      .groupBy('year')
      .orderBy('year', 'asc');

    // Recent activities (from audit_logs)
    const recentActivities = await db('audit_logs')
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .select(
        'audit_logs.*',
        'users.name as user_name'
      )
      .orderBy('audit_logs.created_at', 'desc')
      .limit(6);

    const safeFormat = (val, fmt = 'YYYY-MM-DD hh:mm A') => {
      if (!val) return '—';
      const d = dayjs(val);
      return d.isValid() ? d.format(fmt) : String(val);
    };

    const enrichedRecent = recentActivities.map(a => ({
      ...a,
      created_at_formatted: safeFormat(a.created_at),
      created_at: a.created_at instanceof Date ? a.created_at.toISOString() : String(a.created_at)
    }));

    return {
      cards: {
        total_mfi: parseInt(mfiCounts.total || 0, 10),
        active_mfi: parseInt(mfiCounts.active || 0, 10),
        inactive_mfi: parseInt(mfiCounts.inactive || 0, 10),
        total_branches: parseInt(branchCounts.total || 0, 10),
        active_branches: parseInt(branchCounts.active || 0, 10),
        inactive_branches: parseInt(branchCounts.inactive || 0, 10),
        branch_offices: parseInt(branchCounts.branch_offices || 0, 10),
        area_offices: parseInt(branchCounts.area_offices || 0, 10),
        zone_offices: parseInt(branchCounts.zone_offices || 0, 10),
        expiring_soon: expiringSoonCount,
        expired_count: renewalAlerts.expired.length
      },
      charts: {
        // Chart 1: MFI Active vs Inactive
        mfi_status: {
          labels: ['Active MFIs', 'Inactive MFIs'],
          data: [parseInt(mfiCounts.active || 0, 10), parseInt(mfiCounts.inactive || 0, 10)]
        },
        // Chart 2: Branch Active vs Inactive
        branch_status: {
          labels: ['Active Branches', 'Inactive Branches'],
          data: [parseInt(branchCounts.active || 0, 10), parseInt(branchCounts.inactive || 0, 10)]
        },
        // Chart 3: Branch Type Distribution
        branch_types: {
          labels: ['Branch Offices', 'Area Offices', 'Zone Offices'],
          data: [
            parseInt(branchCounts.branch_offices || 0, 10),
            parseInt(branchCounts.area_offices || 0, 10),
            parseInt(branchCounts.zone_offices || 0, 10)
          ]
        },
        // Chart 4: MFI-wise Branch Count
        mfi_branch_counts: {
          labels: mfiBranchCounts.map(m => m.short_name),
          data: mfiBranchCounts.map(m => parseInt(m.branch_count, 10))
        },
        // Chart 5: Agreement Renewal Trend
        renewal_trend: {
          labels: agreementTrend.map(t => t.year || 'Unknown'),
          data: agreementTrend.map(t => parseInt(t.count, 10)),
          avg_license: agreementTrend.map(t => parseFloat(t.avg_license_fee || 0)),
          avg_om: agreementTrend.map(t => parseFloat(t.avg_om_fee || 0))
        },
        // Chart 6 & 7: MFI-wise License & O&M Fee
        mfi_fees: {
          labels: mfiFeesList.map(m => m.short_name),
          license_fees: mfiFeesList.map(m => m.license_fee),
          om_fees: mfiFeesList.map(m => m.om_fee)
        }
      },
      recent_activities: enrichedRecent,
      renewal_alerts: renewalAlerts
    };
  }
}

module.exports = DashboardService;
