const express = require('express');
const Joi = require('joi');
const moment = require('moment-timezone');
const { authenticateToken, requirePermission, pool, validate } = require('../middleware');

const router = express.Router();

const customerSchema = Joi.object({
    name: Joi.string().min(1).max(255).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().regex(/^\+?[\d\s-]{7,15}$/).optional(),
    company_name: Joi.string().max(255).optional(),
    is_commercial: Joi.boolean().optional(),
    source: Joi.string().max(255).optional()
});

const partialCustomerSchema = Joi.object({
    name: Joi.string().min(1).max(255),
    email: Joi.string().email(),
    phone: Joi.string().regex(/^\+?[\d\s-]{7,15}$/),
    company_name: Joi.string().max(255),
    is_commercial: Joi.boolean(),
    source: Joi.string().max(255)
}).min(1);

router.get('/', authenticateToken, requirePermission('view_customers'), (req, res) => {
    pool.query('SELECT id, name, email, phone, company_name, is_commercial, source, created_at FROM customers WHERE tenant_id = $1', [req.tenantId], (err, result) => {
        if (err) return res.status(500).send(`Error fetching customers: ${err.message}`);
        const rows = result.rows.map(row => {
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            return row;
        });
        res.json(rows);
    });
});

router.post('/', authenticateToken, requirePermission('edit_customers'), validate(customerSchema), (req, res) => {
    const { name, email, phone, company_name, is_commercial, source } = req.body;
    pool.query(
        'INSERT INTO customers (name, email, phone, company_name, is_commercial, source, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [name, email, phone, company_name, is_commercial, source, req.tenantId],
        (err, result) => {
            if (err) return res.status(500).send(`Error creating customer: ${err.message}`);
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.status(201).json(row);
        }
    );
});

router.put('/:id', authenticateToken, requirePermission('edit_customers'), validate(partialCustomerSchema), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid customer ID');
    const { name, email, phone, company_name, is_commercial, source } = req.body;
    pool.query(
        'UPDATE customers SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone), company_name = COALESCE($4, company_name), is_commercial = COALESCE($5, is_commercial), source = COALESCE($6, source) WHERE id = $7 AND tenant_id = $8 RETURNING *',
        [name, email, phone, company_name, is_commercial, source, id, req.tenantId],
        (err, result) => {
            if (err) return res.status(500).send(`Error updating customer: ${err.message}`);
            if (result.rowCount === 0) return res.status(404).send('Customer not found');
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.json(row);
        }
    );
});

router.delete('/:id', authenticateToken, requirePermission('edit_customers'), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid customer ID');
    pool.query(
        'DELETE FROM customers WHERE id = $1 AND tenant_id = $2 RETURNING *',
        [id, req.tenantId],
        (err, result) => {
            if (err) return res.status(500).send(`Error deleting customer: ${err.message}`);
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