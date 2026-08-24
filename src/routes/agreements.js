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

/**
 * GET /api/agreements/applicable
 * Public/Internal service endpoint for fee resolution by date
 */
router.get('/applicable', requireAuth, async (req, res) => {
  try {
    const { mfi_id, date } = req.query;

    if (!mfi_id) {
      return res.status(400).json({ success: false, message: 'mfi_id query parameter is required.' });
    }

    const applicable = await AgreementService.getApplicableAgreement(mfi_id, date);

    if (!applicable) {
      return res.status(404).json({
        success: false,
        message: 'No applicable agreement found for the specified MFI and date.'
      });
    }

    res.json({
      success: true,
      data: applicable
    });
  } catch (error) {
    console.error('Error resolving applicable agreement:', error);
    res.status(500).json({ success: false, message: 'Failed to resolve agreement fees.' });
  }
});

/**
 * GET /api/agreements/renewal-alerts
 * Expose expiring/upcoming renewal alerts
 */
router.get('/renewal-alerts', requireAuth, async (req, res) => {
  try {
    const alerts = await AgreementService.getRenewalAlerts();
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    console.error('Error getting renewal alerts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch renewal alerts.' });
  }
});

/**
 * GET /api/agreements
 * Paginated list of agreements with MFI filter, date range, search
 */
router.get('/', requireAuth, requirePermission('agreement.view'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      mfi_id = '',
      start_date = '',
      end_date = '',
      sortBy = 'agreement_date',
      sortOrder = 'desc'
    } = req.query;

    let query = db('mfi_agreements')
      .join('mfi', 'mfi_agreements.mfi_id', 'mfi.id')
      .leftJoin('users as creator', 'mfi_agreements.created_by', 'creator.id')
      .whereNull('mfi.deleted_at')
      .select(
        'mfi_agreements.*',
        'mfi.short_name as mfi_short_name',
        'mfi.full_name as mfi_full_name',
        'mfi.agreement_expire_date as mfi_expire_date',
        'creator.name as creator_name'
      );

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.andWhere(function() {
        this.where('mfi.short_name', 'like', s)
            .orWhere('mfi.full_name', 'like', s)
            .orWhere('mfi_agreements.remarks', 'like', s);
      });
    }

    if (mfi_id) {
      query = query.andWhere('mfi_agreements.mfi_id', mfi_id);
    }

    if (start_date) {
      query = query.andWhere('mfi_agreements.agreement_date', '>=', dayjs(start_date).format('YYYY-MM-DD'));
    }

    if (end_date) {
      query = query.andWhere('mfi_agreements.agreement_date', '<=', dayjs(end_date).format('YYYY-MM-DD'));
    }

    const validSortCols = ['id', 'agreement_date', 'license_fee_per_branch', 'om_fee_per_branch', 'created_at'];
    const col = validSortCols.includes(sortBy) ? `mfi_agreements.${sortBy}` : 'mfi_agreements.agreement_date';
    const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    query = query.orderBy(col, order);

    const result = await paginate(query, { page, limit });
    const today = dayjs().format('YYYY-MM-DD');

    const enrichedData = result.data.map((agr, index) => {
      const agrDate = dayjs(agr.agreement_date).format('YYYY-MM-DD');
      const isUpcoming = agrDate > today;
      const rawExpire = agr.agreement_expire_date || agr.mfi_expire_date || null;

      return {
        ...agr,
        sl: (result.pagination.page - 1) * result.pagination.limit + index + 1,
        license_fee_per_branch: parseFloat(agr.license_fee_per_branch),
        om_fee_per_branch: parseFloat(agr.om_fee_per_branch),
        agreement_date_formatted: agrDate,
        agreement_expire_date: rawExpire ? dayjs(rawExpire).format('YYYY-MM-DD') : null,
        created_at_formatted: dayjs(agr.created_at).format('YYYY-MM-DD HH:mm'),
        is_upcoming: isUpcoming
      };
    });

    res.json({
      success: true,
      data: enrichedData,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching agreements:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve agreements.' });
  }
});

/**
 * GET /api/agreements/export
 */
router.get('/export', requireAuth, requirePermission('report.export'), async (req, res) => {
  try {
    const { format = 'xlsx', search = '', mfi_id = '', start_date = '', end_date = '' } = req.query;

    let query = db('mfi_agreements')
      .join('mfi', 'mfi_agreements.mfi_id', 'mfi.id')
      .leftJoin('users as creator', 'mfi_agreements.created_by', 'creator.id')
      .whereNull('mfi.deleted_at')
      .select(
        'mfi_agreements.*',
        'mfi.short_name as mfi_short_name',
        'mfi.full_name as mfi_full_name',
        'creator.name as creator_name'
      )
      .orderBy('mfi_agreements.agreement_date', 'desc');

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.andWhere(function() {
        this.where('mfi.short_name', 'like', s).orWhere('mfi.full_name', 'like', s);
      });
    }
    if (mfi_id) query = query.andWhere('mfi_agreements.mfi_id', mfi_id);
    if (start_date) query = query.andWhere('mfi_agreements.agreement_date', '>=', dayjs(start_date).format('YYYY-MM-DD'));
    if (end_date) query = query.andWhere('mfi_agreements.agreement_date', '<=', dayjs(end_date).format('YYYY-MM-DD'));

    const agreements = await query;

    const data = agreements.map((a, idx) => ({
      sl: idx + 1,
      mfi: `${a.mfi_short_name} - ${a.mfi_full_name}`,
      agreement_date: dayjs(a.agreement_date).format('YYYY-MM-DD'),
      agreement_expire_date: a.agreement_expire_date ? dayjs(a.agreement_expire_date).format('YYYY-MM-DD') : 'N/A',
      license_fee: parseFloat(a.license_fee_per_branch),
      om_fee: parseFloat(a.om_fee_per_branch),
      remarks: a.remarks || 'N/A',
      created_by: a.creator_name || 'System',
      created_date: dayjs(a.created_at).format('YYYY-MM-DD')
    }));

    await AuditService.log({
      module: 'agreement',
      action: 'export',
      description: `Exported agreements history report in ${format.toUpperCase()} format`,
      req
    });

    const columns = [
      { header: 'SL', key: 'sl', width: 8 },
      { header: 'MFI', key: 'mfi', width: 28 },
      { header: 'Agreement / Renewal Date', key: 'agreement_date', width: 20 },
      { header: 'Agreement Expire Date', key: 'agreement_expire_date', width: 20 },
      { header: 'License Fee', key: 'license_fee', width: 18 },
      { header: 'O&M Fee', key: 'om_fee', width: 18 },
      { header: 'Remarks', key: 'remarks', width: 30 },
      { header: 'Created By', key: 'created_by', width: 18 },
      { header: 'Created Date', key: 'created_date', width: 15 }
    ];

    if (format === 'csv') {
      return ExportService.toCSV(res, 'agreement_history_report', data);
    } else if (format === 'pdf') {
      const headers = columns.map(c => c.header);
      const rows = data.map(r => [
        r.sl.toString(),
        r.mfi,
        r.agreement_date,
        r.license_fee.toLocaleString(),
        r.om_fee.toLocaleString(),
        r.remarks,
        r.created_by,
        r.created_date
      ]);
      return await ExportService.toPDF(res, 'agreement_history_report', 'MFI Agreement & Renewal History', headers, rows);
    } else {
      const buffer = await ExportService.toExcel({
        sheetName: 'Agreements',
        title: 'MFI Agreement & Renewal History Report',
        columns,
        data
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="agreement_history_report.xlsx"');
      return res.send(buffer);
    }
  } catch (error) {
    console.error('Agreement export error:', error);
    res.status(500).json({ success: false, message: 'Failed to export agreement data.' });
  }
});

/**
 * GET /api/agreements/:id
 */
router.get('/:id', requireAuth, requirePermission('agreement.view'), async (req, res) => {
  try {
    const { id } = req.params;

    const agreement = await db('mfi_agreements')
      .join('mfi', 'mfi_agreements.mfi_id', 'mfi.id')
      .leftJoin('users as creator', 'mfi_agreements.created_by', 'creator.id')
      .leftJoin('users as updater', 'mfi_agreements.updated_by', 'updater.id')
      .where('mfi_agreements.id', id)
      .select(
        'mfi_agreements.*',
        'mfi.short_name as mfi_short_name',
        'mfi.full_name as mfi_full_name',
        'mfi.agreement_expire_date as mfi_expire_date',
        'creator.name as creator_name',
        'updater.name as updater_name'
      )
      .first();

    if (!agreement) {
      return res.status(404).json({ success: false, message: 'Agreement record not found.' });
    }

    const rawExpire = agreement.agreement_expire_date || agreement.mfi_expire_date || null;

    res.json({
      success: true,
      data: {
        ...agreement,
        license_fee_per_branch: parseFloat(agreement.license_fee_per_branch),
        om_fee_per_branch: parseFloat(agreement.om_fee_per_branch),
        agreement_date_formatted: dayjs(agreement.agreement_date).format('YYYY-MM-DD'),
        agreement_expire_date: rawExpire ? dayjs(rawExpire).format('YYYY-MM-DD') : null
      }
    });
  } catch (error) {
    console.error('Error fetching agreement:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve agreement details.' });
  }
});

/**
 * POST /api/agreements
 * Add Renewal / Create Agreement
 * Rules: Never overwrite historical agreement records. Enforce date uniqueness per MFI.
 */
router.post('/', requireAuth, requirePermission('agreement.create'), async (req, res) => {
  try {
    const {
      mfi_id,
      agreement_date,
      agreement_expire_date = null,
      license_fee_per_branch,
      om_fee_per_branch,
      remarks = ''
    } = req.body;

    if (!mfi_id) {
      return res.status(400).json({ success: false, message: 'MFI selection is required.' });
    }

    const mfi = await db('mfi').where('id', mfi_id).whereNull('deleted_at').first();
    if (!mfi) {
      return res.status(400).json({ success: false, message: 'Selected MFI does not exist.' });
    }

    if (!agreement_date) {
      return res.status(400).json({ success: false, message: 'Agreement / Renewal Date is required.' });
    }

    const formattedDate = dayjs(agreement_date).format('YYYY-MM-DD');
    const formattedExpireDate = agreement_expire_date ? dayjs(agreement_expire_date).format('YYYY-MM-DD') : null;

    // Prevent duplicate agreement records for the same MFI and effective date
    const existing = await db('mfi_agreements')
      .where('mfi_id', mfi_id)
      .andWhere('agreement_date', formattedDate)
      .first();

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `An agreement already exists for ${mfi.short_name} on the selected date (${formattedDate}).`
      });
    }

    const licenseFeeNum = parseFloat(license_fee_per_branch);
    const omFeeNum = parseFloat(om_fee_per_branch);

    if (isNaN(licenseFeeNum) || licenseFeeNum < 0) {
      return res.status(400).json({ success: false, message: 'License Fee per branch cannot be negative.' });
    }

    if (isNaN(omFeeNum) || omFeeNum < 0) {
      return res.status(400).json({ success: false, message: 'O&M Fee per branch cannot be negative.' });
    }

    const userId = req.session.user.id;

    const [agreementId] = await db('mfi_agreements').insert({
      mfi_id,
      agreement_date: formattedDate,
      agreement_expire_date: formattedExpireDate,
      license_fee_per_branch: licenseFeeNum,
      om_fee_per_branch: omFeeNum,
      remarks: remarks ? remarks.trim() : null,
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date()
    });

    // Update parent MFI's agreement_expire_date if this agreement is latest
    const latestAgr = await db('mfi_agreements')
      .where('mfi_id', mfi_id)
      .orderBy('agreement_date', 'desc')
      .first();

    if (latestAgr && latestAgr.id === agreementId) {
      await db('mfi').where('id', mfi_id).update({
        agreement_expire_date: formattedExpireDate,
        updated_at: new Date()
      });
    }

    await AuditService.log({
      userId,
      module: 'agreement',
      action: 'renew',
      recordId: agreementId,
      newValue: { mfi_id, agreement_date: formattedDate, license_fee_per_branch: licenseFeeNum, om_fee_per_branch: omFeeNum },
      description: `Agreement renewal created for MFI '${mfi.short_name}' effective ${formattedDate} (License: BDT ${licenseFeeNum}, O&M: BDT ${omFeeNum}).`,
      req
    });

    res.status(201).json({
      success: true,
      message: 'Agreement / Renewal has been recorded successfully.',
      agreementId
    });
  } catch (error) {
    console.error('Error saving agreement:', error);
    res.status(500).json({ success: false, message: 'Unable to record agreement renewal.' });
  }
});

/**
 * PUT /api/agreements/:id
 * Edit existing agreement record (controlled with permission)
 */
router.put('/:id', requireAuth, requirePermission('agreement.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      agreement_date,
      agreement_expire_date,
      license_fee_per_branch,
      om_fee_per_branch,
      remarks
    } = req.body;

    const existing = await db('mfi_agreements').where('id', id).first();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Agreement not found.' });
    }

    const formattedDate = agreement_date ? dayjs(agreement_date).format('YYYY-MM-DD') : existing.agreement_date;
    const formattedExpireDate = agreement_expire_date !== undefined 
      ? (agreement_expire_date ? dayjs(agreement_expire_date).format('YYYY-MM-DD') : null)
      : existing.agreement_expire_date;

    // Check duplicate if date changed
    if (formattedDate !== existing.agreement_date) {
      const duplicate = await db('mfi_agreements')
        .where('mfi_id', existing.mfi_id)
        .where('agreement_date', formattedDate)
        .whereNot('id', id)
        .first();

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `An agreement already exists for this MFI on ${formattedDate}.`
        });
      }
    }

    const licenseFeeNum = license_fee_per_branch !== undefined ? parseFloat(license_fee_per_branch) : existing.license_fee_per_branch;
    const omFeeNum = om_fee_per_branch !== undefined ? parseFloat(om_fee_per_branch) : existing.om_fee_per_branch;

    if (isNaN(licenseFeeNum) || licenseFeeNum < 0) {
      return res.status(400).json({ success: false, message: 'License Fee per branch cannot be negative.' });
    }
    if (isNaN(omFeeNum) || omFeeNum < 0) {
      return res.status(400).json({ success: false, message: 'O&M Fee per branch cannot be negative.' });
    }

    const userId = req.session.user.id;
    const updatePayload = {
      agreement_date: formattedDate,
      agreement_expire_date: formattedExpireDate,
      license_fee_per_branch: licenseFeeNum,
      om_fee_per_branch: omFeeNum,
      remarks: remarks !== undefined ? (remarks ? remarks.trim() : null) : existing.remarks,
      updated_by: userId,
      updated_at: new Date()
    };

    await db('mfi_agreements').where('id', id).update(updatePayload);

    // Re-sync MFI to ALWAYS match the latest agreement's expire date
    const latestAgr = await db('mfi_agreements')
      .where('mfi_id', existing.mfi_id)
      .orderBy('agreement_date', 'desc')
      .orderBy('id', 'desc')
      .first();

    if (latestAgr) {
      await db('mfi').where('id', existing.mfi_id).update({
        agreement_expire_date: latestAgr.agreement_expire_date,
        updated_at: new Date()
      });
    }

    await AuditService.log({
      userId,
      module: 'agreement',
      action: 'update',
      recordId: id,
      oldValue: {
        agreement_date: existing.agreement_date,
        license_fee_per_branch: existing.license_fee_per_branch,
        om_fee_per_branch: existing.om_fee_per_branch
      },
      newValue: updatePayload,
      description: `Agreement #${id} revised.`,
      req
    });

    res.json({
      success: true,
      message: 'Agreement has been updated successfully.'
    });
  } catch (error) {
    console.error('Error updating agreement:', error);
    res.status(500).json({ success: false, message: 'Failed to update agreement.' });
  }
});

/**
 * DELETE /api/agreements/:id
 * Delete agreement (Super Admin / high-privilege only)
 */
router.delete('/:id', requireAuth, requirePermission('agreement.delete'), async (req, res) => {
  try {
    const { id } = req.params;

    const agreement = await db('mfi_agreements').where('id', id).first();
    if (!agreement) {
      return res.status(404).json({ success: false, message: 'Agreement not found.' });
    }

    // Check count of agreements for this MFI to avoid deleting the only initial record
    const countRow = await db('mfi_agreements').where('mfi_id', agreement.mfi_id).count('* as c').first();
    if (countRow?.c <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the only agreement record for an MFI. Edit the values instead.'
      });
    }

    await db('mfi_agreements').where('id', id).del();

    // Re-sync MFI to ALWAYS match the latest agreement after deletion
    const latestAgr = await db('mfi_agreements')
      .where('mfi_id', agreement.mfi_id)
      .orderBy('agreement_date', 'desc')
      .orderBy('id', 'desc')
      .first();

    if (latestAgr) {
      await db('mfi').where('id', agreement.mfi_id).update({
        agreement_expire_date: latestAgr.agreement_expire_date,
        updated_at: new Date()
      });
    }

    await AuditService.log({
      userId: req.session.user.id,
      module: 'agreement',
      action: 'delete',
      recordId: id,
      oldValue: {
        mfi_id: agreement.mfi_id,
        agreement_date: agreement.agreement_date,
        license_fee: agreement.license_fee_per_branch,
        om_fee: agreement.om_fee_per_branch
      },
      description: `Deleted agreement record #${id} dated ${agreement.agreement_date}`,
      req
    });

    res.json({
      success: true,
      message: 'Agreement record has been deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting agreement:', error);
    res.status(500).json({ success: false, message: 'Failed to delete agreement.' });
  }
});

module.exports = router;
