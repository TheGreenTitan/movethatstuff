///var/www/movethatstuff/backend/routes/customerRoutes.js//
const express = require('express');
const Joi = require('joi');
const moment = require('moment-timezone');
const { authenticateToken, requirePermission, pool, validate } = require('../middleware');
const logger = require('../logger'); // Import logger for error handling
const router = express.Router();

const customerSchema = Joi.object({
    name: Joi.string().min(1).max(255).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().regex(/^\+?[\d\s-]{7,15}$/).optional(),
    company_name: Joi.string().max(255).optional(),
    source: Joi.string().optional() // Source as name string
});

const partialCustomerSchema = Joi.object({
    name: Joi.string().min(1).max(255),
    email: Joi.string().email(),
    phone: Joi.string().regex(/^\+?[\d\s-]{7,15}$/),
    company_name: Joi.string().max(255),
    source: Joi.string()
}).min(1);

router.get('/', authenticateToken, requirePermission('view_customers'), (req, res) => {
    pool.query('SELECT c.id, c.name, c.email, c.phone, c.company_name, s.name AS source, c.created_at FROM customers c LEFT JOIN sources s ON c.source_id = s.id WHERE c.tenant_id = $1', [req.tenantId], (err, result) => {
        if (err) {
            logger.error(`Error fetching customers: ${err.message} - Stack: ${err.stack}`);
            return res.status(500).send(`Error fetching customers: ${err.message}`);
        }
        const rows = result.rows.map(row => {
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            return row;
        });
        res.json(rows);
    });
});

router.get('/:id', authenticateToken, requirePermission('view_customers'), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid customer ID');
    pool.query('SELECT c.id, c.name, c.email, c.phone, c.company_name, s.name AS source, c.created_at FROM customers c LEFT JOIN sources s ON c.source_id = s.id WHERE c.id = $1 AND c.tenant_id = $2', [id, req.tenantId], (err, result) => {
        if (err) {
            logger.error(`Error fetching customer: ${err.message} - Stack: ${err.stack}`);
            return res.status(500).send(`Error fetching customer: ${err.message}`);
        }
        if (result.rowCount === 0) return res.status(404).send('Customer not found');
        const row = result.rows[0];
        if (row.created_at) {
            row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
        }
        res.json(row);
    });
});

router.post('/', authenticateToken, requirePermission('edit_customers'), validate(customerSchema), async (req, res) => {
    const { name, email, phone, company_name, source } = req.body;
    try {
        let source_id = null;
        if (source) {
            const sourceResult = await pool.query('SELECT id FROM sources WHERE name ILIKE $1 AND tenant_id = $2', [source, req.tenantId]);
            if (sourceResult.rows.length === 0) {
                return res.status(400).send('Invalid source');
            }
            source_id = sourceResult.rows[0].id;
        }
        const result = await pool.query(
            'INSERT INTO customers (name, email, phone, company_name, source_id, tenant_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, email, phone, company_name, source_id, req.tenantId]
        );
        const row = result.rows[0];
        if (row.created_at) {
            row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
        }
        res.status(201).json(row);
    } catch (err) {
        logger.error(`Error creating customer: ${err.message} - Stack: ${err.stack}`);
        res.status(500).send(`Error creating customer: ${err.message}`);
    }
});

router.put('/:id', authenticateToken, requirePermission('edit_customers'), validate(partialCustomerSchema), async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid customer ID');
    const { name, email, phone, company_name, source } = req.body;
    try {
        let source_id = null;
        if (source) {
            const sourceResult = await pool.query('SELECT id FROM sources WHERE name ILIKE $1 AND tenant_id = $2', [source, req.tenantId]);
            if (sourceResult.rows.length === 0) {
                return res.status(400).send('Invalid source');
            }
            source_id = sourceResult.rows[0].id;
        }
        const result = await pool.query(
            'UPDATE customers SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone), company_name = COALESCE($4, company_name), source_id = COALESCE($5, source_id) WHERE id = $6 AND tenant_id = $7 RETURNING *',
            [name, email, phone, company_name, source_id, id, req.tenantId]
        );
        if (result.rowCount === 0) return res.status(404).send('Customer not found');
        const row = result.rows[0];
        if (row.created_at) {
            row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
        }
        res.json(row);
    } catch (err) {
        logger.error(`Error updating customer: ${err.message} - Stack: ${err.stack}`);
        res.status(500).send(`Error updating customer: ${err.message}`);
    }
});

router.delete('/:id', authenticateToken, requirePermission('edit_customers'), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid customer ID');
    pool.query(
        'DELETE FROM customers WHERE id = $1 AND tenant_id = $2 RETURNING *',
        [id, req.tenantId],
        (err, result) => {
            if (err) {
                logger.error(`Error deleting customer: ${err.message} - Stack: ${err.stack}`);
                return res.status(500).send(`Error deleting customer: ${err.message}`);
            }
            if (result.rowCount === 0) return res.status(404).send('Customer not found');
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.status(200).json({ message: 'Customer deleted', data: row });
        }
    );
});

module.exports = router;