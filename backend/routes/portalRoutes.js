///var/www/movethatstuff/backend/routes/portalRoutes.js//
const express = require('express');
const jwt = require('jsonwebtoken');
const moment = require('moment-timezone');
const { pool, secretKey } = require('../middleware');
const logger = require('../logger');

const router = express.Router();

// Middleware to verify customer view token (no RBAC, public with token)
const verifyCustomerToken = (req, res, next) => {
    const token = req.query.token;
    if (!token) return res.status(401).send('Access denied. No token provided.');
    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) return res.status(403).send('Invalid or expired token.');
        if (decoded.type !== 'customer_view') return res.status(403).send('Invalid token type.');
        req.decoded = decoded;
        // Fetch tenant_id from estimate/opportunity for timezone (simplified, assume UTC if not found)
        next();
    });
};

// GET /portal/estimates/:id - View estimate (JSON stub)
router.get('/estimates/:id', verifyCustomerToken, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id !== req.decoded.estimate_id) return res.status(400).send('Invalid estimate ID');
    pool.query(
        `SELECT e.*, t.timezone
         FROM estimates e
         JOIN opportunities o ON e.opportunity_id = o.id
         JOIN customers c ON o.customer_id = c.id
         JOIN tenants t ON c.tenant_id = t.id
         WHERE e.id = $1`,
        [id],
        (err, result) => {
            if (err) {
                logger.error(`Error fetching estimate: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error fetching estimate: ${err.message}`);
            }
            if (result.rowCount === 0) return res.status(404).send('Estimate not found');
            const row = result.rows[0];
            const timezone = row.timezone || 'UTC';
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(timezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.move_date) {
                row.move_date = moment.utc(row.move_date).tz(timezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.json(row);
        }
    );
});

// GET /portal/opportunities/:id - View opportunity (JSON stub)
router.get('/opportunities/:id', verifyCustomerToken, (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id !== req.decoded.opportunity_id) return res.status(400).send('Invalid opportunity ID');
    pool.query(
        `SELECT o.*, t.timezone
         FROM opportunities o
         JOIN customers c ON o.customer_id = c.id
         JOIN tenants t ON c.tenant_id = t.id
         WHERE o.id = $1`,
        [id],
        (err, result) => {
            if (err) {
                logger.error(`Error fetching opportunity: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error fetching opportunity: ${err.message}`);
            }
            if (result.rowCount === 0) return res.status(404).send('Opportunity not found');
            const row = result.rows[0];
            const timezone = row.timezone || 'UTC';
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(timezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.move_date) {
                row.move_date = moment.utc(row.move_date).tz(timezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.json(row);
        }
    );
});

module.exports = router;