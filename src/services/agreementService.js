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
      .join('mfi', 'mfi_agreements.mfi_id', 'mfi.id')
      .where('mfi_agreements.mfi_id', mfiId)
      .andWhere('mfi_agreements.agreement_date', '<=', formattedDate)
      .select('mfi_agreements.*', 'mfi.agreement_expire_date as mfi_expire_date')
      .orderBy('mfi_agreements.agreement_date', 'desc')
      .orderBy('mfi_agreements.id', 'desc')
      .first();

    if (!agreement) {
      return null;
    }

    const rawExpire = agreement.agreement_expire_date || agreement.mfi_expire_date || null;

    return {
      ...agreement,
      license_fee_per_branch: parseFloat(agreement.license_fee_per_branch),
      om_fee_per_branch: parseFloat(agreement.om_fee_per_branch),
      effective_date: agreement.agreement_date,
      agreement_expire_date: rawExpire ? dayjs(rawExpire).format('YYYY-MM-DD') : null
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

    const mfiRecord = await db('mfi').where('id', mfiId).first();

    const agreements = await db('mfi_agreements')
      .leftJoin('users as creator', 'mfi_agreements.created_by', 'creator.id')
      .where('mfi_agreements.mfi_id', mfiId)
      .select(
        'mfi_agreements.*',
        'creator.name as creator_name'
      )
      .orderBy('mfi_agreements.agreement_date', 'desc')
      .orderBy('mfi_agreements.id', 'desc');

    const applicable = await this.getApplicableAgreement(mfiId, today);
    const applicableId = applicable ? applicable.id : null;

    return agreements.map(agr => {
      const agrDate = dayjs(agr.agreement_date).format('YYYY-MM-DD');
      const isUpcoming = agrDate > today;
      const isCurrent = agr.id === applicableId;
      const isHistorical = !isUpcoming && !isCurrent;
      const rawExpire = agr.agreement_expire_date || (mfiRecord ? mfiRecord.agreement_expire_date : null);

      return {
        ...agr,
        license_fee_per_branch: parseFloat(agr.license_fee_per_branch),
        om_fee_per_branch: parseFloat(agr.om_fee_per_branch),
        agreement_expire_date: rawExpire ? dayjs(rawExpire).format('YYYY-MM-DD') : null,
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

    // Get all active MFIs
    const activeMfis = await db('mfi')
      .whereNull('deleted_at')
      .andWhere('status', 'active')
      .select('id', 'full_name', 'short_name', 'agreement_expire_date');

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

      const latestPast = agreements.find(a => a.agreement_date <= today) || agreements[0];
      const expireDateRaw = (latestPast && latestPast.agreement_expire_date) || mfi.agreement_expire_date;

      if (expireDateRaw) {
        const expireDate = dayjs(expireDateRaw).format('YYYY-MM-DD');
        if (expireDate <= today) {
          const daysOverdue = dayjs(today).diff(dayjs(expireDate), 'day');
          alerts.expired.push({
            mfi,
            agreement: latestPast || null,
            agreement_expire_date: expireDate,
            days_overdue: daysOverdue,
            reason: `Agreement expired on ${expireDate}`
          });
        } else {
          const daysDiff = dayjs(expireDate).diff(dayjs(today), 'day');
          const alertItem = {
            mfi,
            agreement: latestPast || null,
            agreement_expire_date: expireDate,
            days_until_effective: daysDiff
          };
          alerts.all_upcoming.push(alertItem);
          if (daysDiff <= 30) alerts.within_30.push(alertItem);
          else if (daysDiff <= 60) alerts.within_60.push(alertItem);
          else if (daysDiff <= 90) alerts.within_90.push(alertItem);
        }
      } else {
        // Fallback for legacy records without an explicit expire date
        if (agreements.length === 0) {
          alerts.expired.push({
            mfi,
            reason: 'No agreement recorded',
            agreement: null
          });
          continue;
        }

        const upcoming = agreements.filter(a => a.agreement_date > today);

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
          const daysSinceLast = dayjs(today).diff(dayjs(latestPast.agreement_date), 'day');
          if (daysSinceLast >= 365) {
            alerts.expired.push({
              mfi,
              agreement: latestPast,
              days_overdue: daysSinceLast - 365,
              reason: 'Over 1 year since last agreement'
            });
          }
        }
      }
    }

    return alerts;
  }
}

module.exports = AgreementService;
