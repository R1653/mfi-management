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
 * GET /api/team-members/by-team/:teamId
 * Returns active members of a specific team (for cascading dropdown in MFI entry)
 */
router.get('/by-team/:teamId', requireAuth, async (req, res) => {
  try {
    const { teamId } = req.params;

    const members = await db('team_members')
      .where('team_id', teamId)
      .where('status', 'active')
      .whereNull('deleted_at')
      .select('id', 'member_name', 'member_code', 'is_team_leader')
      .orderBy('is_team_leader', 'desc')
      .orderBy('member_name', 'asc');

    res.json({
      success: true,
      data: members
    });
  } catch (error) {
    console.error('Error fetching members by team:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve team members.' });
  }
});

/**
 * GET /api/team-members
 * Paginated list of team members
 */
router.get('/', requireAuth, requirePermission('team_member.view'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      team_id = '',
      status = '',
      sortBy = 'id',
      sortOrder = 'desc'
    } = req.query;

    let query = db('team_members')
      .leftJoin('teams', 'team_members.team_id', 'teams.id')
      .whereNull('team_members.deleted_at')
      .select(
        'team_members.*',
        'teams.team_name',
        'teams.team_code'
      );

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.andWhere(function() {
        this.where('team_members.member_name', 'like', s)
            .orWhere('team_members.member_code', 'like', s)
            .orWhere('teams.team_name', 'like', s)
            .orWhere('teams.team_code', 'like', s);
      });
    }

    if (team_id) {
      query = query.andWhere('team_members.team_id', team_id);
    }

    if (status) {
      query = query.andWhere('team_members.status', status);
    }

    const validSortCols = ['id', 'member_name', 'member_code', 'is_team_leader', 'status', 'created_at'];
    const col = validSortCols.includes(sortBy) ? `team_members.${sortBy}` : 'team_members.id';
    const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    query = query.orderBy(col, order);

    const result = await paginate(query, { page, limit });

    const enrichedData = result.data.map((member, index) => ({
      ...member,
      sl: (result.pagination.page - 1) * result.pagination.limit + index + 1,
      is_team_leader: !!member.is_team_leader
    }));

    res.json({
      success: true,
      data: enrichedData,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve team members.' });
  }
});

/**
 * GET /api/team-members/export
 */
router.get('/export', requireAuth, requirePermission('report.export'), async (req, res) => {
  try {
    const { format = 'xlsx', search = '', team_id = '', status = '' } = req.query;

    let query = db('team_members')
      .leftJoin('teams', 'team_members.team_id', 'teams.id')
      .whereNull('team_members.deleted_at')
      .select(
        'team_members.*',
        'teams.team_name',
        'teams.team_code'
      )
      .orderBy('team_members.id', 'asc');

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.andWhere(function() {
        this.where('team_members.member_name', 'like', s)
            .orWhere('team_members.member_code', 'like', s)
            .orWhere('teams.team_name', 'like', s);
      });
    }
    if (team_id) query = query.andWhere('team_members.team_id', team_id);
    if (status) query = query.andWhere('team_members.status', status);

    const members = await query;
    const data = members.map((m, idx) => ({
      sl: idx + 1,
      member_name: m.member_name,
      member_code: m.member_code,
      team_name: m.team_name ? `${m.team_name} (${m.team_code})` : 'Unassigned',
      role: m.is_team_leader ? 'Team Leader' : 'Team Member',
      status: m.status.toUpperCase()
    }));

    await AuditService.log({
      module: 'team_member',
      action: 'export',
      description: `Exported Team Members directory in ${format.toUpperCase()} format`,
      req
    });

    const columns = [
      { header: 'SL', key: 'sl', width: 8 },
      { header: 'Team Member Name', key: 'member_name', width: 28 },
      { header: 'Member ID', key: 'member_code', width: 18 },
      { header: 'Team Name', key: 'team_name', width: 30 },
      { header: 'Role', key: 'role', width: 16 },
      { header: 'Status', key: 'status', width: 12 }
    ];

    if (format === 'csv') {
      return ExportService.toCSV(res, 'team_members_report', data);
    } else if (format === 'pdf') {
      const headers = columns.map(c => c.header);
      const rows = data.map(r => [
        r.sl.toString(),
        r.member_name,
        r.member_code,
        r.team_name,
        r.role,
        r.status
      ]);
      return await ExportService.toPDF(res, 'team_members_report', 'Team Members Directory', headers, rows);
    } else {
      const buffer = await ExportService.toExcel({
        sheetName: 'Team Members',
        title: 'Team Members Directory Report',
        columns,
        data
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="team_members_report.xlsx"');
      return res.send(buffer);
    }
  } catch (error) {
    console.error('Team members export error:', error);
    res.status(500).json({ success: false, message: 'Failed to export team members.' });
  }
});

/**
 * GET /api/team-members/:id
 */
router.get('/:id', requireAuth, requirePermission('team_member.view'), async (req, res) => {
  try {
    const { id } = req.params;

    const member = await db('team_members')
      .leftJoin('teams', 'team_members.team_id', 'teams.id')
      .where('team_members.id', id)
      .whereNull('team_members.deleted_at')
      .select(
        'team_members.*',
        'teams.team_name',
        'teams.team_code'
      )
      .first();

    if (!member) {
      return res.status(404).json({ success: false, message: 'Team member not found.' });
    }

    res.json({
      success: true,
      data: {
        ...member,
        is_team_leader: !!member.is_team_leader
      }
    });
  } catch (error) {
    console.error('Error fetching team member:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve member details.' });
  }
});

/**
 * POST /api/team-members
 */
router.post('/', requireAuth, requirePermission('team_member.create'), async (req, res) => {
  try {
    const {
      member_name,
      member_code,
      team_id,
      is_team_leader = false,
      remarks,
      status = 'active'
    } = req.body;

    if (!member_name || !member_name.trim()) {
      return res.status(400).json({ success: false, message: 'Team member Name is required.' });
    }

    if (!member_code || !member_code.trim()) {
      return res.status(400).json({ success: false, message: 'Team Member ID is required.' });
    }

    if (!team_id) {
      return res.status(400).json({ success: false, message: 'Team Name selection is required.' });
    }

    const team = await db('teams').where('id', team_id).whereNull('deleted_at').first();
    if (!team) {
      return res.status(400).json({ success: false, message: 'Selected team does not exist.' });
    }

    const cleanCode = member_code.trim().toUpperCase();

    // Check duplicate member_code
    const existing = await db('team_members')
      .where('member_code', cleanCode)
      .whereNull('deleted_at')
      .first();

    if (existing) {
      return res.status(400).json({ success: false, message: `Team Member ID '${cleanCode}' already exists.` });
    }

    const isLeader = (
      is_team_leader === true ||
      is_team_leader === 1 ||
      is_team_leader === '1' ||
      is_team_leader === 'yes' ||
      is_team_leader === 'true'
    );

    const userId = req.session.user.id;

    const [memberId] = await db('team_members').insert({
      member_name: member_name.trim(),
      member_code: cleanCode,
      team_id,
      is_team_leader: isLeader ? 1 : 0,
      remarks: remarks ? remarks.trim() : null,
      status: status === 'inactive' ? 'inactive' : 'active',
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date()
    });

    await AuditService.log({
      userId,
      module: 'team_member',
      action: 'create',
      recordId: memberId,
      newValue: { member_name: member_name.trim(), member_code: cleanCode, team_id, is_team_leader: isLeader },
      description: `Created Team Member '${member_name.trim()}' (${cleanCode}) in team '${team.team_name}'. Leader: ${isLeader ? 'Yes' : 'No'}`,
      req
    });

    res.status(201).json({
      success: true,
      message: 'Team member has been created successfully.',
      memberId,
      data: { id: memberId }
    });
  } catch (error) {
    console.error('Error creating team member:', error);
    res.status(500).json({ success: false, message: 'Unable to save team member.' });
  }
});

/**
 * PUT /api/team-members/:id
 */
router.put('/:id', requireAuth, requirePermission('team_member.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      member_name,
      member_code,
      team_id,
      is_team_leader,
      remarks,
      status
    } = req.body;

    const existing = await db('team_members').where('id', id).whereNull('deleted_at').first();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Team member not found.' });
    }

    if (!member_name || !member_name.trim()) {
      return res.status(400).json({ success: false, message: 'Team member Name is required.' });
    }

    if (!member_code || !member_code.trim()) {
      return res.status(400).json({ success: false, message: 'Team Member ID is required.' });
    }

    if (!team_id) {
      return res.status(400).json({ success: false, message: 'Team Name selection is required.' });
    }

    const cleanCode = member_code.trim().toUpperCase();

    // Check duplicate code
    const duplicate = await db('team_members')
      .where('member_code', cleanCode)
      .whereNot('id', id)
      .whereNull('deleted_at')
      .first();

    if (duplicate) {
      return res.status(400).json({ success: false, message: `Team Member ID '${cleanCode}' is already in use.` });
    }

    const isLeader = (
      is_team_leader === true ||
      is_team_leader === 1 ||
      is_team_leader === '1' ||
      is_team_leader === 'yes' ||
      is_team_leader === 'true'
    );

    const userId = req.session.user.id;
    const updatePayload = {
      member_name: member_name.trim(),
      member_code: cleanCode,
      team_id,
      is_team_leader: isLeader ? 1 : 0,
      remarks: remarks ? remarks.trim() : null,
      updated_by: userId,
      updated_at: new Date()
    };

    if (status && ['active', 'inactive'].includes(status)) {
      updatePayload.status = status;
    }

    await db('team_members').where('id', id).update(updatePayload);

    await AuditService.log({
      userId,
      module: 'team_member',
      action: 'update',
      recordId: id,
      oldValue: { member_name: existing.member_name, member_code: existing.member_code, team_id: existing.team_id },
      newValue: updatePayload,
      description: `Updated Team Member #${id} '${cleanCode}'`,
      req
    });

    res.json({
      success: true,
      message: 'Team member has been updated successfully.'
    });
  } catch (error) {
    console.error('Error updating team member:', error);
    res.status(500).json({ success: false, message: 'Unable to update team member.' });
  }
});

/**
 * PATCH /api/team-members/:id/status
 */
router.patch('/:id/status', requireAuth, requirePermission('team_member.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const member = await db('team_members').where('id', id).whereNull('deleted_at').first();
    if (!member) {
      return res.status(404).json({ success: false, message: 'Team member not found.' });
    }

    await db('team_members').where('id', id).update({
      status,
      updated_by: req.session.user.id,
      updated_at: new Date()
    });

    await AuditService.log({
      userId: req.session.user.id,
      module: 'team_member',
      action: status === 'active' ? 'activate' : 'deactivate',
      recordId: id,
      oldValue: { status: member.status },
      newValue: { status },
      description: `Changed status of Team Member '${member.member_name}' to ${status}.`,
      req
    });

    res.json({
      success: true,
      message: `Team Member '${member.member_name}' has been ${status === 'active' ? 'activated' : 'deactivated'} successfully.`
    });
  } catch (error) {
    console.error('Member status change error:', error);
    res.status(500).json({ success: false, message: 'Failed to update status.' });
  }
});

/**
 * DELETE /api/team-members/:id
 */
router.delete('/:id', requireAuth, requirePermission('team_member.delete'), async (req, res) => {
  try {
    const { id } = req.params;

    const member = await db('team_members').where('id', id).whereNull('deleted_at').first();
    if (!member) {
      return res.status(404).json({ success: false, message: 'Team member not found.' });
    }

    await db('team_members').where('id', id).update({
      deleted_at: new Date(),
      updated_by: req.session.user.id,
      updated_at: new Date()
    });

    await AuditService.log({
      userId: req.session.user.id,
      module: 'team_member',
      action: 'delete',
      recordId: id,
      oldValue: { member_name: member.member_name, member_code: member.member_code },
      description: `Soft-deleted Team Member '${member.member_name}' (ID: ${id})`,
      req
    });

    res.json({
      success: true,
      message: 'Team member has been removed successfully.'
    });
  } catch (error) {
    console.error('Error deleting team member:', error);
    res.status(500).json({ success: false, message: 'Failed to delete team member.' });
  }
});

module.exports = router;
