const express = require('express');
const router = express.Router();
const db = require('../config/database');
const AuditService = require('../services/auditService');
const ExportService = require('../services/exportService');
const { paginate } = require('../utils/pagination');
const { requireAuth } = require('../middleware/auth');
const dayjs = require('dayjs');

/**
 * GET /api/teams/assigned
 * Teams that have at least one MFI assigned (for Branch List filter dropdown)
 */
router.get('/assigned', requireAuth, async (req, res) => {
  try {
    const teams = await db('teams')
      .join('mfi', 'mfi.team_id', 'teams.id')
      .whereNull('teams.deleted_at')
      .whereNull('mfi.deleted_at')
      .select('teams.id', 'teams.team_name', 'teams.team_code')
      .groupBy('teams.id', 'teams.team_name', 'teams.team_code')
      .orderBy('teams.team_name', 'asc');

    res.json({ success: true, data: teams });
  } catch (error) {
    console.error('Error fetching assigned teams:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve assigned teams.' });
  }
});

/**
 * GET /api/teams/members/assigned
 * Team members who have at least one MFI assigned to them (for Branch List filter dropdown).
 * When selected, all branches of every MFI assigned to that member are returned by the branch filter.
 */
router.get('/members/assigned', requireAuth, async (req, res) => {
  try {
    const members = await db('team_members')
      .join('mfi', 'mfi.team_member_id', 'team_members.id')
      .whereNull('team_members.deleted_at')
      .whereNull('mfi.deleted_at')
      .select('team_members.id', 'team_members.member_name', 'team_members.member_code')
      .groupBy('team_members.id', 'team_members.member_name', 'team_members.member_code')
      .orderBy('team_members.member_name', 'asc');

    res.json({ success: true, data: members });
  } catch (error) {
    console.error('Error fetching assigned team members:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve assigned team members.' });
  }
});

/**
 * GET /api/teams/all
 * Lightweight list of active teams for dropdown selectors
 */
router.get('/all', requireAuth, async (req, res) => {
  try {
    const teams = await db('teams')
      .whereNull('deleted_at')
      .where('status', 'active')
      .select('id', 'team_name', 'team_code')
      .orderBy('team_name', 'asc');

    res.json({
      success: true,
      data: teams
    });
  } catch (error) {
    console.error('Error fetching all teams:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve teams list.' });
  }
});

/**
 * GET /api/teams
 * Paginated, searchable, filterable list of teams with member counts & leaders
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      sortBy = 'id',
      sortOrder = 'desc'
    } = req.query;

    let query = db('teams')
      .whereNull('deleted_at')
      .select('teams.*');

    if (search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.andWhere(function() {
        this.where('team_name', 'like', s)
            .orWhere('team_code', 'like', s)
            .orWhere('remarks', 'like', s);
      });
    }

    if (status) {
      query = query.andWhere('status', status);
    }

    const validSortCols = ['id', 'team_name', 'team_code', 'status', 'created_at'];
    const col = validSortCols.includes(sortBy) ? sortBy : 'id';
    const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    query = query.orderBy(col, order);

    const result = await paginate(query, { page, limit });

    // Enrich each team with total members and leader name
    const enrichedData = await Promise.all(result.data.map(async (team, index) => {
      const memberCount = await db('team_members')
        .where('team_id', team.id)
        .whereNull('deleted_at')
        .count('id as count')
        .first();

      const leader = await db('team_members')
        .where('team_id', team.id)
        .where('is_team_leader', 1)
        .whereNull('deleted_at')
        .first();

      return {
        ...team,
        sl: (result.pagination.page - 1) * result.pagination.limit + index + 1,
        total_members: parseInt(memberCount?.count || 0, 10),
        leader_name: leader ? leader.member_name : '—',
        leader_code: leader ? leader.member_code : null
      };
    }));

    res.json({
      success: true,
      data: enrichedData,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve teams.' });
  }
});

/**
 * GET /api/teams/export
 * Export teams list
 */
router.get('/export', requireAuth, async (req, res) => {
  try {
    const { format = 'xlsx', search = '', status = '' } = req.query;

    let query = db('teams').whereNull('deleted_at').orderBy('id', 'asc');
    if (search.trim()) {
      const s = `%${search.trim()}%`;
      query = query.andWhere(function() {
        this.where('team_name', 'like', s).orWhere('team_code', 'like', s);
      });
    }
    if (status) query = query.andWhere('status', status);

    const teams = await query;
    const enriched = await Promise.all(teams.map(async (team, idx) => {
      const count = await db('team_members').where('team_id', team.id).whereNull('deleted_at').count('* as c').first();
      const leader = await db('team_members').where('team_id', team.id).where('is_team_leader', 1).whereNull('deleted_at').first();
      return {
        sl: idx + 1,
        team_name: team.team_name,
        team_code: team.team_code,
        leader: leader ? leader.member_name : '—',
        members: count?.c || 0,
        remarks: team.remarks || '—',
        status: team.status.toUpperCase()
      };
    }));

    await AuditService.log({
      module: 'team',
      action: 'export',
      description: `Exported Team directory in ${format.toUpperCase()} format`,
      req
    });

    const columns = [
      { header: 'SL', key: 'sl', width: 8 },
      { header: 'Team Name', key: 'team_name', width: 30 },
      { header: 'Team ID', key: 'team_code', width: 16 },
      { header: 'Team Leader', key: 'leader', width: 24 },
      { header: 'Members Count', key: 'members', width: 16 },
      { header: 'Remarks', key: 'remarks', width: 30 },
      { header: 'Status', key: 'status', width: 14 }
    ];

    if (format === 'csv') {
      return ExportService.toCSV(res, 'teams_directory_report', enriched);
    } else if (format === 'pdf') {
      const headers = columns.map(c => c.header);
      const rows = enriched.map(r => [
        r.sl.toString(),
        r.team_name,
        r.team_code,
        r.leader,
        r.members.toString(),
        r.remarks,
        r.status
      ]);
      return await ExportService.toPDF(res, 'teams_directory_report', 'Team Management Directory', headers, rows);
    } else {
      const buffer = await ExportService.toExcel({
        sheetName: 'Teams',
        title: 'Team Management Directory Report',
        columns,
        data: enriched
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="teams_directory_report.xlsx"');
      return res.send(buffer);
    }
  } catch (error) {
    console.error('Teams export error:', error);
    res.status(500).json({ success: false, message: 'Failed to export team data.' });
  }
});

/**
 * GET /api/teams/:id
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const team = await db('teams')
      .where('id', id)
      .whereNull('deleted_at')
      .first();

    if (!team) {
      return res.status(404).json({ success: false, message: 'Team record not found.' });
    }

    const members = await db('team_members')
      .where('team_id', id)
      .whereNull('deleted_at')
      .orderBy('is_team_leader', 'desc')
      .orderBy('member_name', 'asc');

    res.json({
      success: true,
      data: {
        ...team,
        members
      }
    });
  } catch (error) {
    console.error('Error fetching team details:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve team details.' });
  }
});

/**
 * POST /api/teams
 * Create a new team (team_name, team_code, remarks)
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      team_name,
      team_code,
      remarks,
      status = 'active'
    } = req.body;

    if (!team_name || !team_name.trim()) {
      return res.status(400).json({ success: false, message: 'Name of team is required.' });
    }

    if (!team_code || !team_code.trim()) {
      return res.status(400).json({ success: false, message: 'Team ID is required.' });
    }

    const cleanCode = team_code.trim().toUpperCase();

    // Check duplicate code
    const existing = await db('teams')
      .where('team_code', cleanCode)
      .whereNull('deleted_at')
      .first();

    if (existing) {
      return res.status(400).json({ success: false, message: `Team ID '${cleanCode}' already exists.` });
    }

    const userId = req.session.user.id;

    const [teamId] = await db('teams').insert({
      team_name: team_name.trim(),
      team_code: cleanCode,
      remarks: remarks ? remarks.trim() : null,
      status: status === 'inactive' ? 'inactive' : 'active',
      created_by: userId,
      updated_by: userId,
      created_at: new Date(),
      updated_at: new Date()
    });

    await AuditService.log({
      userId,
      module: 'team',
      action: 'create',
      recordId: teamId,
      newValue: { team_name: team_name.trim(), team_code: cleanCode, remarks },
      description: `Created Team '${team_name.trim()}' (ID: ${cleanCode})`,
      req
    });

    res.status(201).json({
      success: true,
      message: 'Team has been created successfully.',
      teamId,
      data: { id: teamId }
    });
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ success: false, message: 'Unable to save team information.' });
  }
});

/**
 * PUT /api/teams/:id
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      team_name,
      team_code,
      remarks,
      status
    } = req.body;

    const existing = await db('teams').where('id', id).whereNull('deleted_at').first();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    if (!team_name || !team_name.trim()) {
      return res.status(400).json({ success: false, message: 'Name of team is required.' });
    }

    if (!team_code || !team_code.trim()) {
      return res.status(400).json({ success: false, message: 'Team ID is required.' });
    }

    const cleanCode = team_code.trim().toUpperCase();

    // Check duplicate code
    const duplicate = await db('teams')
      .where('team_code', cleanCode)
      .whereNot('id', id)
      .whereNull('deleted_at')
      .first();

    if (duplicate) {
      return res.status(400).json({ success: false, message: `Team ID '${cleanCode}' is already in use.` });
    }

    const userId = req.session.user.id;
    const updatePayload = {
      team_name: team_name.trim(),
      team_code: cleanCode,
      remarks: remarks ? remarks.trim() : null,
      updated_by: userId,
      updated_at: new Date()
    };

    if (status && ['active', 'inactive'].includes(status)) {
      updatePayload.status = status;
    }

    await db('teams').where('id', id).update(updatePayload);

    await AuditService.log({
      userId,
      module: 'team',
      action: 'update',
      recordId: id,
      oldValue: { team_name: existing.team_name, team_code: existing.team_code, remarks: existing.remarks, status: existing.status },
      newValue: updatePayload,
      description: `Updated Team #${id} '${cleanCode}'`,
      req
    });

    res.json({
      success: true,
      message: 'Team has been updated successfully.'
    });
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({ success: false, message: 'Unable to update team.' });
  }
});

/**
 * PATCH /api/teams/:id/status
 */
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const team = await db('teams').where('id', id).whereNull('deleted_at').first();
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    await db('teams').where('id', id).update({
      status,
      updated_by: req.session.user.id,
      updated_at: new Date()
    });

    await AuditService.log({
      userId: req.session.user.id,
      module: 'team',
      action: status === 'active' ? 'activate' : 'deactivate',
      recordId: id,
      oldValue: { status: team.status },
      newValue: { status },
      description: `Changed status of Team '${team.team_name}' to ${status}.`,
      req
    });

    res.json({
      success: true,
      message: `Team '${team.team_name}' has been ${status === 'active' ? 'activated' : 'deactivated'} successfully.`
    });
  } catch (error) {
    console.error('Team status change error:', error);
    res.status(500).json({ success: false, message: 'Failed to update team status.' });
  }
});

/**
 * DELETE /api/teams/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const team = await db('teams').where('id', id).whereNull('deleted_at').first();
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    await db('teams').where('id', id).update({
      deleted_at: new Date(),
      updated_by: req.session.user.id,
      updated_at: new Date()
    });

    await AuditService.log({
      userId: req.session.user.id,
      module: 'team',
      action: 'delete',
      recordId: id,
      oldValue: { team_name: team.team_name, team_code: team.team_code },
      description: `Soft-deleted Team '${team.team_name}' (ID: ${id})`,
      req
    });

    res.json({
      success: true,
      message: 'Team has been removed successfully.'
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ success: false, message: 'Failed to delete team.' });
  }
});

module.exports = router;
