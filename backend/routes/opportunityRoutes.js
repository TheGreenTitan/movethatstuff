const express = require('express');
const Joi = require('joi');
const { authenticateToken, requirePermission, pool, validate, secretKey, moment, transporter } = require('../middleware');
const jwt = require('jsonwebtoken');

const router = express.Router();

const opportunitySchema = Joi.object({
    customer_id: Joi.number().integer().positive().required(),
    move_date: Joi.date().iso().required(),
    move_type: Joi.string().valid('house', 'apartment', 'commercial', 'storage').required(),
    move_service: Joi.string().valid('moving', 'packing', 'moving and packing', 'storage', 'other').required(),
    origin_address: Joi.string().max(255).optional(),
    destination_address: Joi.string().max(255).optional(),
    origin_stairs: Joi.boolean().optional(),
    dest_stairs: Joi.boolean().optional(),
    notes: Joi.string().optional()
});

const partialOpportunitySchema = Joi.object({
    customer_id: Joi.number().integer().positive(),
    move_date: Joi.date().iso(),
    move_type: Joi.string().valid('house', 'apartment', 'commercial', 'storage'),
    move_service: Joi.string().valid('moving', 'packing', 'moving and packing', 'storage', 'other'),
    origin_address: Joi.string().max(255),
    destination_address: Joi.string().max(255),
    origin_stairs: Joi.boolean(),
    dest_stairs: Joi.boolean(),
    notes: Joi.string()
}).min(1);

router.get('/', authenticateToken, requirePermission('view_opportunities'), (req, res) => {
    pool.query(
        'SELECT id, customer_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes, created_at FROM opportunities WHERE customer_id IN (SELECT id FROM customers WHERE tenant_id = $1)',
        [req.tenantId],
        (err, result) => {
            if (err) return res.status(500).send(`Error fetching opportunities: ${err.message}`);
            const rows = result.rows.map(row => {
                if (row.created_at) {
                    row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
                }
                if (row.move_date) {
                    row.move_date = moment.utc(row.move_date).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
                }
                return row;
            });
            res.json(rows);
        }
    );
});

router.post('/', authenticateToken, requirePermission('edit_opportunities'), validate(opportunitySchema), async (req, res) => {
    const { customer_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO opportunities (customer_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [customer_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes]
        );
        const row = result.rows[0];
        if (row.created_at) {
            row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
        }
        if (row.move_date) {
            row.move_date = moment.utc(row.move_date).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
        }
        // Check tenant communications enabled and send email
        const tenantRes = await pool.query('SELECT enable_communications FROM tenants WHERE id = $1', [req.tenantId]);
        if (tenantRes.rows[0].enable_communications) {
            const customerRes = await pool.query('SELECT email FROM customers WHERE id = $1 AND tenant_id = $2', [customer_id, req.tenantId]);
            if (customerRes.rowCount > 0) {
                const email = customerRes.rows[0].email;
                // Generate view link (short-lived token)
                const viewToken = jwt.sign({ opportunity_id: row.id, type: 'customer_view' }, secretKey, { expiresIn: '24h' });
                const viewLink = `https://crm.movethatstuff.com/portal/opportunities/${row.id}?token=${viewToken}`;
                await transporter.sendMail({
                    from: process.env.SENDER_EMAIL,
                    to: email,
                    subject: 'New Moving Opportunity Created',
                    text: `A new opportunity for your move on ${moment.utc(move_date).tz(req.tenantTimezone).format('YYYY-MM-DD')} has been created. View details: ${viewLink}`
                });
            }
        }
        res.status(201).json(row);
    } catch (err) {
        res.status(500).send(`Error creating opportunity: ${err.message}`);
    }
});

router.put('/:id', authenticateToken, requirePermission('edit_opportunities'), validate(partialOpportunitySchema), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid opportunity ID');
    const { customer_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes } = req.body;
    pool.query(
        'UPDATE opportunities SET customer_id = COALESCE($1, customer_id), move_date = COALESCE($2, move_date), move_type = COALESCE($3, move_type), move_service = COALESCE($4, move_service), origin_address = COALESCE($5, origin_address), destination_address = COALESCE($6, destination_address), origin_stairs = COALESCE($7, origin_stairs), dest_stairs = COALESCE($8, dest_stairs), notes = COALESCE($9, notes) WHERE id = $10 RETURNING *',
        [customer_id, move_date, move_type, move_service, origin_address, destination_address, origin_stairs, dest_stairs, notes, id],
        (err, result) => {
            if (err) return res.status(500).send(`Error updating opportunity: ${err.message}`);
            if (result.rowCount === 0) return res.status(404).send('Opportunity not found');
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.move_date) {
                row.move_date = moment.utc(row.move_date).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.json(row);
        }
    );
});

router.delete('/:id', authenticateToken, requirePermission('edit_opportunities'), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid opportunity ID');
    pool.query(
        'DELETE FROM opportunities WHERE id = $1 RETURNING *',
        [id],
        (err, result) => {
            if (err) return res.status(500).send(`Error deleting opportunity: ${err.message}`);
            if (result.rowCount === 0) return res.status(404).send('Opportunity not found');
            const row = result.rows[0];
            if (row.created_at) {
                row.created_at = moment.utc(row.created_at).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            if (row.move_date) {
                row.move_date = moment.utc(row.move_date).tz(req.tenantTimezone).format('YYYY-MM-DDTHH:mm:ssZ');
            }
            res.status(200).json({ message: 'Opportunity deleted', data: row });
        }
    );
});

module.exports = router;