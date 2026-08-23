/**
 * billableMonth.js
 * Computes the billable month for a branch based on:
 *   - software_start_date
 *   - om_grace_period_months from the parent MFI
 *
 * Business Rules:
 *   1. If the day of software_start_date is <= 15  → that month counts as a full month (base = that month)
 *   2. If the day of software_start_date is  > 15  → that partial month is skipped (base = next month)
 *   3. billable_month = base month + om_grace_period_months
 *
 * Example:
 *   software_start_date = 2025-02-01, grace = 3  →  base = Feb 2025  →  billable = 2025-05
 *   software_start_date = 2026-03-16, grace = 3  →  base = Apr 2026  →  billable = 2026-07
 *   software_start_date = 2026-03-15, grace = 3  →  base = Mar 2026  →  billable = 2026-06
 *
 * @param {string|Date} softwareStartDate  - The software start date (YYYY-MM-DD or Date object)
 * @param {number|null} gracePeriodMonths  - Integer months (can be 0, positive, negative, or null)
 * @returns {string}  Billable month in YYYY-MM format
 */
function computeBillableMonth(softwareStartDate, gracePeriodMonths) {
  const dayjs = require('dayjs');

  const start = dayjs(softwareStartDate);
  const day = start.date(); // day of month (1–31)

  // Step 1: Determine base month
  // If day > 15 → skip this partial month → base = 1st of next month
  // If day <= 15 → this month counts → base = 1st of this month
  const base = day > 15 ? start.add(1, 'month').startOf('month') : start.startOf('month');

  // Step 2: Add grace period (default 0 if null/undefined)
  const grace = (gracePeriodMonths !== null && gracePeriodMonths !== undefined)
    ? parseInt(gracePeriodMonths, 10)
    : 0;

  const billable = base.add(grace, 'month');

  return billable.format('YYYY-MM');
}

module.exports = { computeBillableMonth };
