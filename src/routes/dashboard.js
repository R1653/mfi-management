const express = require('express');
const router = express.Router();
const DashboardService = require('../services/dashboardService');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

/**
 * GET /api/dashboard
 * Return consolidated dashboard statistics, alert metrics, and chart series
 */
router.get('/', requireAuth, requirePermission('dashboard.view'), async (req, res) => {
  try {
    const data = await DashboardService.getDashboardData();
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard metrics.'
    });
  }
});

module.exports = router;
