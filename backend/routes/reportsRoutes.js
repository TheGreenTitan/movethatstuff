///var/www/movethatstuff/backend/routes/reportsRoutes.js//
const express = require('express');
const moment = require('moment-timezone');
const { authenticateToken, requirePermission, pool } = require('../middleware');
const logger = require('../logger');  // Import logger for error handling

const router = express.Router();

router.get('/estimates', authenticateToken, requirePermission('view_reports'), (req, res) => {
    pool.query(
        `SELECT DATE_TRUNC('month', created_at) AS month,
                COUNT(id) AS estimate_count,
                SUM(total_cost) AS total_revenue
         FROM estimates
         WHERE tenant_id = $1
         GROUP BY month
         ORDER BY month DESC`,
        [req.tenantId],
        (err, result) => {
            if (err) {
                logger.error(`Error generating estimate report: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error generating estimate report: ${err.message}`);
            }
            const rows = result.rows.map(row => {
                if (row.month) {
                    row.month = moment.utc(row.month).tz(req.tenantTimezone).format('YYYY-MM');
                }
                row.estimate_count = parseInt(row.estimate_count, 10);
                row.total_revenue = parseFloat(row.total_revenue || '0').toFixed(2);
                return row;
            });
            res.json(rows);
        }
    );
});

module.exports = router;