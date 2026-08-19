const express = require('express');
const router = express.Router();
const db = require('../config/database');
const AuditService = require('../services/auditService');
const ExportService = require('../services/exportService');
const { paginate } = require('../utils/pagination');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const dayjs = require('dayjs');

/**
 * GET /api/branches
 * Paginated, searchable, filterable list of branches
 */
router.get('/', requireAuth, requirePermission('branch.view'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      mfi_id = '',
      branch_type = '',
      status = '',
      sortBy = 'id',
      sortOrder = 'desc'
    } = req.query;

    let query = db('branches')
      .join('mfi', 'branches.mfi_id', 'mfi.id')
      .whereNull('branches.deleted_at')
      .whereNull('mfi.deleted_at')
      .select(
        'branches.*',
        'mfi.short_name as mfi_short_name',
        'mfi.full_name as mfi_full_name'
      );

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.andWhere(function() {
        this.where('branches.branch_name', 'like', s)
            .orWhere('branches.branch_code', 'like', s)
            .orWhere('mfi.short_name', 'like', s)
            .orWhere('mfi.full_name', 'like', s);
      });
    }

    if (mfi_id) {
      query = query.andWhere('branches.mfi_id', mfi_id);
    }

    if (branch_type) {
      query = query.andWhere('branches.branch_type', branch_type);
    }

    if (status) {
      query = query.andWhere('branches.status', status);
    }

    const validSortCols = ['id', 'branch_name', 'branch_code', 'branch_opening_date', 'software_start_date', 'billable_month', 'branch_type', 'status'];
    const col = validSortCols.includes(sortBy) ? `branches.${sortBy}` : 'branches.id';
    const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    query = query.orderBy(col, order);

    const result = await paginate(query, { page, limit });

    // Format dates & add SL
    const enrichedData = result.data.map((branch, index) => ({
      ...branch,
      sl: (result.pagination.page - 1) * result.pagination.limit + index + 1,
      branch_opening_date_formatted: dayjs(branch.branch_opening_date).format('YYYY-MM-DD'),
      software_start_date_formatted: dayjs(branch.software_start_date).format('YYYY-MM-DD')
    }));

    res.json({
      success: true,
      data: enrichedData,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve branches.' });
  }
});

/**
 * GET /api/branches/export
 * Export branch records as Excel, CSV, or PDF
 */
router.get('/export', requireAuth, requirePermission('report.export'), async (req, res) => {
  try {
    const { format = 'xlsx', search = '', mfi_id = '', branch_type = '', status = '' } = req.query;

    let query = db('branches')
      .join('mfi', 'branches.mfi_id', 'mfi.id')
      .whereNull('branches.deleted_at')
      .whereNull('mfi.deleted_at')
      .select(
        'branches.*',
        'mfi.short_name as mfi_short_name',
        'mfi.full_name as mfi_full_name'
      )
      .orderBy('branches.mfi_id', 'asc')
      .orderBy('branches.branch_code', 'asc');

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.andWhere(function() {
        this.where('branches.branch_name', 'like', s)
            .orWhere('branches.branch_code', 'like', s)
            .orWhere('mfi.short_name', 'like', s);
      });
    }
    if (mfi_id) query = query.andWhere('branches.mfi_id', mfi_id);
    if (branch_type) query = query.andWhere('branches.branch_type', branch_type);
    if (status) query = query.andWhere('branches.status', status);

    const branches = await query;

    const data = branches.map((b, idx) => ({
      sl: idx + 1,
      mfi: `${b.mfi_short_name} - ${b.mfi_full_name}`,
      branch_name: b.branch_name,
      branch_code: b.branch_code,
      branch_opening_date: dayjs(b.branch_opening_date).format('YYYY-MM-DD'),
      software_start_date: dayjs(b.software_start_date).format('YYYY-MM-DD'),
      billable_month: b.billable_month,
      branch_type: b.branch_type,
      status: b.status.toUpperCase()
    }));

    await AuditService.log({
      module: 'branch',
      action: 'export',
      description: `Exported branches report in ${format.toUpperCase()} format`,
      req
    });

    const columns = [
      { header: 'SL', key: 'sl', width: 8 },
      { header: 'MFI', key: 'mfi', width: 28 },
      { header: 'Branch Name', key: 'branch_name', width: 26 },
      { header: 'Branch Code', key: 'branch_code', width: 14 },
      { header: 'Opening Date', key: 'branch_opening_date', width: 15 },
      { header: 'Software Start', key: 'software_start_date', width: 15 },
      { header: 'Billable Month', key: 'billable_month', width: 16 },
      { header: 'Branch Type', key: 'branch_type', width: 16 },
      { header: 'Status', key: 'status', width: 12 }
    ];

    if (format === 'csv') {
      return ExportService.toCSV(res, 'branches_directory_report', data);
    } else if (format === 'pdf') {
      const headers = columns.map(c => c.header);
      const rows = data.map(r => [
        r.sl.toString(),
        r.mfi,
        r.branch_name,
        r.branch_code,
        r.branch_opening_date,
        r.software_start_date,
        r.billable_month,
        r.branch_type,
        r.status
      ]);
      return await ExportService.toPDF(res, 'branches_directory_report', 'MFI Branches Master Directory', headers, rows);
    } else {
      const buffer = await ExportService.toExcel({
        sheetName: 'Branches',
        title: 'MFI Branches Master Directory Report',
        columns,
        data
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="branches_directory_report.xlsx"');
      return res.send(buffer);
    }
  } catch (error) {
    console.error('Branch export error:', error);
    res.status(500).json({ success: false, message: 'Failed to export branch data.' });
  }
});

/**
 * GET /api/branches/:id
 */
router.get('/:id', requireAuth, requirePermission('branch.view'), async (req, res) => {
  try {
    const { id } = req.params;

    const branch = await db('branches')
      .join('mfi', 'branches.mfi_id', 'mfi.id')
      .leftJoin('users as creator', 'branches.created_by', 'creator.id')
      .leftJoin('users as updater', 'branches.updated_by', 'updater.id')
      .where('branches.id', id)
      .whereNull('branches.deleted_at')
      .select(
        'branches.*',
        'mfi.short_name as mfi_short_name',
        'mfi.full_name as mfi_full_name',
        'creator.name as creator_name',
        'updater.name as updater_name'
      )
      .first();

    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found.' });
    }

    res.json({
      success: true,
      data: branch
    });
  } catch (error) {
    console.error('Error fetching branch:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve branch details.' });
  }
});

/**
 * POST /api/branches
 * Create a new branch with validation & unique code per MFI
 */
router.post('/', requireAuth, requirePermission('branch.create'), async (req, res) => {
  try {
    const {
      mfi_id,
      branch_name,
      branch_code,
      branch_opening_date,
      software_start_date,
      billable_month,
      branch_type = 'Branch Office',
      status = 'active'
    } = req.body;

    // Validation
    if (!mfi_id) {
      return res.status(400).json({ success: false, message: 'MFI selection is required.' });
    }

    const mfi = await db('mfi').where('id', mfi_id).whereNull('deleted_at').first();
    if (!mfi) {
      return res.status(400).json({ success: false, message: 'Selected MFI does not exist.' });
    }

    if (!branch_name || !branch_name.trim()) {
      return res.status(400).json({ success: false, message: 'Branch Name is required.' });
    }

    if (!branch_code || !branch_code.toString().trim()) {
      return res.status(400).json({ success: false, message: 'Branch Code is required.' });
    }

    const cleanCode = branch_code.toString().trim();

    // Check branch_code uniqueness within the selected MFI
    const existing = await db('branches')
      .where('mfi_id', mfi_id)
      .where('branch_code', cleanCode)
      .whereNull('deleted_at')
      .first();

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Branch Code '${cleanCode}' already exists for MFI '${mfi.short_name}'.`
      });
    }

    if (!branch_opening_date) {
      return res.status(400).json({ success: false, message: 'Branch Opening Date is required.' });
    }

    if (!software_start_date) {
      return res.status(400).json({ success: false, message: 'Software Start Date is required.' });
    }

    if (!billable_month || !/^\d{4}-\d{2}$/.test(billable_month.trim())) {
      return res.status(400).json({ success: false, message: 'Billable Month is required in YYYY-MM format.' });
    }

    const validTypes = ['Branch Office', 'Area Office', 'Zone Office'];
    if (!validTypes.includes(branch_type)) {
      return res.status(400).json({ success: false, message: 'Invalid branch type.' });
    }

    const userId = req.session.user.id;

    const [branchId] = await db('branches').insert({
      mfi_id,
      branch_name: branch_name.trim(),
      branch_code: cleanCode,
      branch_opening_date: dayjs(branch_opening_date).format('YYYY-MM-DD'),
      software_start_date: dayjs(software_start_date).format('YYYY-MM-DD'),
      billable_month: billable_month.trim(),
      branch_type,
      status: status === 'inactive' ? 'inactive' : 'active',
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date()
    });

    await AuditService.log({
      userId,
      module: 'branch',
      action: 'create',
      recordId: branchId,
      newValue: { mfi_id, branch_name: branch_name.trim(), branch_code: cleanCode, branch_type },
      description: `Branch '${branch_name.trim()}' (Code: ${cleanCode}) created under MFI '${mfi.short_name}'.`,
      req
    });

    res.status(201).json({
      success: true,
      message: 'Branch has been created successfully.',
      branchId
    });
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({ success: false, message: 'Unable to save branch. Please check the entered information.' });
  }
});

/**
 * PUT /api/branches/:id
 * Update branch details
 */
router.put('/:id', requireAuth, requirePermission('branch.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      branch_name,
      branch_code,
      branch_opening_date,
      software_start_date,
      billable_month,
      branch_type,
      status
    } = req.body;

    const existing = await db('branches')
      .where('id', id)
      .whereNull('deleted_at')
      .first();

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Branch not found.' });
    }

    if (!branch_name || !branch_name.trim()) {
      return res.status(400).json({ success: false, message: 'Branch Name is required.' });
    }

    if (!branch_code || !branch_code.toString().trim()) {
      return res.status(400).json({ success: false, message: 'Branch Code is required.' });
    }

    const cleanCode = branch_code.toString().trim();

    // Check duplicate code within same MFI excluding this branch
    const duplicate = await db('branches')
      .where('mfi_id', existing.mfi_id)
      .where('branch_code', cleanCode)
      .whereNot('id', id)
      .whereNull('deleted_at')
      .first();

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: `Branch Code '${cleanCode}' is already in use by another branch in this MFI.`
      });
    }

    const userId = req.session.user.id;
    const updatePayload = {
      branch_name: branch_name.trim(),
      branch_code: cleanCode,
      updated_by: userId,
      updated_at: new Date()
    };

    if (branch_opening_date) updatePayload.branch_opening_date = dayjs(branch_opening_date).format('YYYY-MM-DD');
    if (software_start_date) updatePayload.software_start_date = dayjs(software_start_date).format('YYYY-MM-DD');
    if (billable_month) updatePayload.billable_month = billable_month.trim();
    if (branch_type) updatePayload.branch_type = branch_type;
    if (status && ['active', 'inactive'].includes(status)) updatePayload.status = status;

    await db('branches').where('id', id).update(updatePayload);

    await AuditService.log({
      userId,
      module: 'branch',
      action: 'update',
      recordId: id,
      oldValue: { branch_name: existing.branch_name, branch_code: existing.branch_code, status: existing.status },
      newValue: updatePayload,
      description: `Branch #${id} '${cleanCode}' updated.`,
      req
    });

    res.json({
      success: true,
      message: 'Branch has been updated successfully.'
    });
  } catch (error) {
    console.error('Error updating branch:', error);
    res.status(500).json({ success: false, message: 'Failed to update branch.' });
  }
});

/**
 * PATCH /api/branches/:id/status
 */
router.patch('/:id/status', requireAuth, requirePermission('branch.status'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const branch = await db('branches').where('id', id).whereNull('deleted_at').first();
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found.' });
    }

    await db('branches').where('id', id).update({
      status,
      updated_by: req.session.user.id,
      updated_at: new Date()
    });

    await AuditService.log({
      userId: req.session.user.id,
      module: 'branch',
      action: status === 'active' ? 'activate' : 'deactivate',
      recordId: id,
      oldValue: { status: branch.status },
      newValue: { status },
      description: `Changed status of branch '${branch.branch_name}' (${branch.branch_code}) to ${status}.`,
      req
    });

    res.json({
      success: true,
      message: `Branch '${branch.branch_name}' has been ${status === 'active' ? 'activated' : 'deactivated'} successfully.`
    });
  } catch (error) {
    console.error('Status change error:', error);
    res.status(500).json({ success: false, message: 'Failed to update branch status.' });
  }
});

/**
 * DELETE /api/branches/:id
 * Soft delete branch
 */
router.delete('/:id', requireAuth, requirePermission('branch.delete'), async (req, res) => {
  try {
    const { id } = req.params;

    const branch = await db('branches').where('id', id).whereNull('deleted_at').first();
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found.' });
    }

    await db('branches').where('id', id).update({
      deleted_at: new Date(),
      updated_by: req.session.user.id,
      updated_at: new Date()
    });

    await AuditService.log({
      userId: req.session.user.id,
      module: 'branch',
      action: 'delete',
      recordId: id,
      oldValue: { branch_name: branch.branch_name, branch_code: branch.branch_code },
      description: `Soft-deleted branch '${branch.branch_name}' (ID: ${id})`,
      req
    });

    res.json({
      success: true,
      message: 'Branch has been removed successfully.'
    });
  } catch (error) {
    console.error('Error deleting branch:', error);
    res.status(500).json({ success: false, message: 'Failed to delete branch.' });
  }
});

module.exports = router;
