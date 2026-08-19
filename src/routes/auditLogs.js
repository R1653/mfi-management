const express = require('express');
const router = express.Router();
const db = require('../config/database');
const ExportService = require('../services/exportService');
const { paginate } = require('../utils/pagination');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const dayjs = require('dayjs');

/**
 * GET /api/audit-logs
 * Paginated, filterable audit trail logs
 */
router.get('/', requireAuth, requirePermission('audit.view'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 15,
      search = '',
      module = '',
      action = '',
      user_id = '',
      start_date = '',
      end_date = ''
    } = req.query;

    let query = db('audit_logs')
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .select(
        'audit_logs.*',
        'users.name as user_name',
        'users.login_id as user_login_id'
      )
      .orderBy('audit_logs.created_at', 'desc');

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.andWhere(function() {
        this.where('audit_logs.description', 'like', s)
            .orWhere('users.name', 'like', s)
            .orWhere('users.login_id', 'like', s)
            .orWhere('audit_logs.ip_address', 'like', s);
      });
    }

    if (module) {
      query = query.andWhere('audit_logs.module', module);
    }

    if (action) {
      query = query.andWhere('audit_logs.action', action);
    }

    if (user_id) {
      query = query.andWhere('audit_logs.user_id', user_id);
    }

    if (start_date) {
      query = query.andWhere('audit_logs.created_at', '>=', dayjs(start_date).startOf('day').toDate());
    }

    if (end_date) {
      query = query.andWhere('audit_logs.created_at', '<=', dayjs(end_date).endOf('day').toDate());
    }

    const result = await paginate(query, { page, limit });

    const safeFormat = (val, fmt = 'YYYY-MM-DD HH:mm:ss') => {
      if (!val) return '—';
      const d = dayjs(val);
      return d.isValid() ? d.format(fmt) : String(val);
    };

    const enriched = result.data.map((log, idx) => ({
      ...log,
      sl: (result.pagination.page - 1) * result.pagination.limit + idx + 1,
      created_at_formatted: safeFormat(log.created_at, 'YYYY-MM-DD HH:mm:ss'),
      date_formatted: safeFormat(log.created_at, 'YYYY-MM-DD'),
      time_formatted: safeFormat(log.created_at, 'HH:mm:ss')
    }));

    res.json({
      success: true,
      data: enriched,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve audit trail.' });
  }
});

/**
 * GET /api/audit-logs/export
 */
router.get('/export', requireAuth, requirePermission('report.export'), async (req, res) => {
  try {
    const { format = 'xlsx', search = '', module = '', action = '', start_date = '', end_date = '' } = req.query;

    let query = db('audit_logs')
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .select(
        'audit_logs.*',
        'users.name as user_name',
        'users.login_id as user_login_id'
      )
      .orderBy('audit_logs.created_at', 'desc')
      .limit(1000);

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.andWhere(function() {
        this.where('audit_logs.description', 'like', s)
            .orWhere('users.name', 'like', s)
            .orWhere('users.login_id', 'like', s);
      });
    }
    if (module) query = query.andWhere('audit_logs.module', module);
    if (action) query = query.andWhere('audit_logs.action', action);
    if (start_date) query = query.andWhere('audit_logs.created_at', '>=', dayjs(start_date).startOf('day').toDate());
    if (end_date) query = query.andWhere('audit_logs.created_at', '<=', dayjs(end_date).endOf('day').toDate());

    const logs = await query;

    const data = logs.map((l, idx) => ({
      sl: idx + 1,
      user: l.user_name ? `${l.user_name} (${l.user_login_id})` : 'System',
      date: dayjs(l.created_at).format('YYYY-MM-DD'),
      time: dayjs(l.created_at).format('HH:mm:ss'),
      module: l.module.toUpperCase(),
      action: l.action.toUpperCase(),
      record_id: l.record_id || 'N/A',
      ip_address: l.ip_address || '127.0.0.1',
      description: l.description || ''
    }));

    const columns = [
      { header: 'SL', key: 'sl', width: 8 },
      { header: 'User', key: 'user', width: 24 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Time', key: 'time', width: 12 },
      { header: 'Module', key: 'module', width: 14 },
      { header: 'Action', key: 'action', width: 16 },
      { header: 'Record ID', key: 'record_id', width: 12 },
      { header: 'IP Address', key: 'ip_address', width: 16 },
      { header: 'Description', key: 'description', width: 40 }
    ];

    if (format === 'csv') {
      return ExportService.toCSV(res, 'audit_trail_log', data);
    } else if (format === 'pdf') {
      const headers = columns.map(c => c.header);
      const rows = data.map(r => [
        r.sl.toString(),
        r.user,
        r.date,
        r.time,
        r.module,
        r.action,
        r.record_id.toString(),
        r.ip_address,
        r.description
      ]);
      return await ExportService.toPDF(res, 'audit_trail_log', 'System User Audit Trail', headers, rows);
    } else {
      const buffer = await ExportService.toExcel({
        sheetName: 'Audit Logs',
        title: 'System User Audit Trail Report',
        columns,
        data
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="audit_trail_report.xlsx"');
      return res.send(buffer);
    }
  } catch (error) {
    console.error('Audit log export error:', error);
    res.status(500).json({ success: false, message: 'Failed to export audit logs.' });
  }
});

module.exports = router;
