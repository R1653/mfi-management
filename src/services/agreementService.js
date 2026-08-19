const db = require('../config/database');
const dayjs = require('dayjs');

/**
 * Agreement Service
 * Core business logic for MFI Agreement and License/O&M Fee Resolution.
 * Future-proofed for downstream Billing & Invoicing modules.
 */
class AgreementService {
  /**
   * Determine applicable agreement and fee structure for an MFI on a specific transaction/billing date.
   * Rule: Latest agreement where agreement_date <= targetDate
   * 
   * @param {number} mfiId - MFI ID
   * @param {string|Date} [targetDate=null] - YYYY-MM-DD or Date object. Defaults to current date.
   * @returns {Promise<Object|null>} Applicable agreement record or null if none exists prior to targetDate
   */
  static async getApplicableAgreement(mfiId, targetDate = null) {
    if (!mfiId) throw new Error('mfiId is required for agreement resolution');

    const formattedDate = targetDate 
      ? dayjs(targetDate).format('YYYY-MM-DD')
      : dayjs().format('YYYY-MM-DD');

    const agreement = await db('mfi_agreements')
      .where('mfi_id', mfiId)
      .andWhere('agreement_date', '<=', formattedDate)
      .orderBy('agreement_date', 'desc')
      .first();

    if (!agreement) {
      return null;
    }

    return {
      ...agreement,
      license_fee_per_branch: parseFloat(agreement.license_fee_per_branch),
      om_fee_per_branch: parseFloat(agreement.om_fee_per_branch),
      effective_date: agreement.agreement_date
    };
  }

  /**
   * Get full agreement history for an MFI with status tags (Current, Upcoming, Historical)
   * 
   * @param {number} mfiId 
   * @param {string|Date} [referenceDate=null]
   * @returns {Promise<Array<Object>>}
   */
  static async getAgreementHistory(mfiId, referenceDate = null) {
    const today = referenceDate 
      ? dayjs(referenceDate).format('YYYY-MM-DD') 
      : dayjs().format('YYYY-MM-DD');

    const agreements = await db('mfi_agreements')
      .leftJoin('users as creator', 'mfi_agreements.created_by', 'creator.id')
      .where('mfi_agreements.mfi_id', mfiId)
      .select(
        'mfi_agreements.*',
        'creator.name as creator_name'
      )
      .orderBy('mfi_agreements.agreement_date', 'desc');

    const applicable = await this.getApplicableAgreement(mfiId, today);
    const applicableId = applicable ? applicable.id : null;

    return agreements.map(agr => {
      const agrDate = dayjs(agr.agreement_date).format('YYYY-MM-DD');
      const isUpcoming = agrDate > today;
      const isCurrent = agr.id === applicableId;
      const isHistorical = !isUpcoming && !isCurrent;

      return {
        ...agr,
        license_fee_per_branch: parseFloat(agr.license_fee_per_branch),
        om_fee_per_branch: parseFloat(agr.om_fee_per_branch),
        is_current: isCurrent,
        is_upcoming: isUpcoming,
        is_historical: isHistorical,
        status_label: isCurrent ? 'Active / Current' : isUpcoming ? 'Upcoming' : 'Historical'
      };
    });
  }

  /**
   * Get upcoming and expiring agreement alerts for Dashboard & Reports
   * 
   * @param {Object} options
   * @param {number} [options.days=90]
   */
  static async getRenewalAlerts(options = {}) {
    const today = dayjs().format('YYYY-MM-DD');
    const within30 = dayjs().add(30, 'day').format('YYYY-MM-DD');
    const within60 = dayjs().add(60, 'day').format('YYYY-MM-DD');
    const within90 = dayjs().add(90, 'day').format('YYYY-MM-DD');

    // Get all active MFIs
    const activeMfis = await db('mfi')
      .whereNull('deleted_at')
      .andWhere('status', 'active')
      .select('id', 'full_name', 'short_name');

    const alerts = {
      expired: [],
      within_30: [],
      within_60: [],
      within_90: [],
      all_upcoming: []
    };

    for (const mfi of activeMfis) {
      const agreements = await db('mfi_agreements')
        .where('mfi_id', mfi.id)
        .orderBy('agreement_date', 'desc');

      if (agreements.length === 0) {
        alerts.expired.push({
          mfi,
          reason: 'No agreement recorded',
          agreement: null
        });
        continue;
      }

      // Check upcoming renewals
      const upcoming = agreements.filter(a => a.agreement_date > today);
      const latestPast = agreements.find(a => a.agreement_date <= today);

      if (upcoming.length > 0) {
        for (const up of upcoming) {
          const upDate = dayjs(up.agreement_date).format('YYYY-MM-DD');
          const daysDiff = dayjs(upDate).diff(dayjs(today), 'day');

          const alertItem = {
            mfi,
            agreement: up,
            days_until_effective: daysDiff
          };

          alerts.all_upcoming.push(alertItem);
          if (daysDiff <= 30) alerts.within_30.push(alertItem);
          else if (daysDiff <= 60) alerts.within_60.push(alertItem);
          else if (daysDiff <= 90) alerts.within_90.push(alertItem);
        }
      } else if (latestPast) {
        // If the latest agreement was signed over 365 days ago, tag as renewal due
        const daysSinceLast = dayjs(today).diff(dayjs(latestPast.agreement_date), 'day');
        if (daysSinceLast >= 365) {
          alerts.expired.push({
            mfi,
            agreement: latestPast,
            days_overdue: daysSinceLast - 365
          });
        }
      }
    }

    return alerts;
  }
}

module.exports = AgreementService;
