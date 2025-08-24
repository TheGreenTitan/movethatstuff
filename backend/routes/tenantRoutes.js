const express = require('express');
const Joi = require('joi');
const { authenticateToken, requirePermission, pool, validate } = require('../middleware');

const router = express.Router();

const tenantSchema = Joi.object({
    name: Joi.string().min(1).max(255).required(),
    timezone: Joi.string().max(50).required(),
    google_maps_api_key: Joi.string().max(255).optional()
});

const partialTenantSchema = Joi.object({
    name: Joi.string().min(1).max(255),
    timezone: Joi.string().max(50),
    google_maps_api_key: Joi.string().max(255)
}).min(1);

router.get('/', authenticateToken, requirePermission('manage_tenants'), (req, res) => {
    pool.query('SELECT * FROM tenants', (err, result) => {
        if (err) return res.status(500).send(`Error fetching tenants: ${err.message}`);
        res.json(result.rows);
    });
});

router.post('/', authenticateToken, requirePermission('manage_tenants'), validate(tenantSchema), (req, res) => {
    const { name, timezone, google_maps_api_key } = req.body;
    pool.query(
        'INSERT INTO tenants (name, timezone, google_maps_api_key) VALUES ($1, $2, $3) RETURNING *',
        [name, timezone, google_maps_api_key],
        (err, result) => {
            if (err) return res.status(500).send(`Error creating tenant: ${err.message}`);
            res.status(201).json(result.rows[0]);
        }
    );
});

router.put('/:id', authenticateToken, requirePermission('manage_tenants'), validate(partialTenantSchema), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid tenant ID');
    const { name, timezone, google_maps_api_key } = req.body;
    pool.query(
        'UPDATE tenants SET name = COALESCE($1, name), timezone = COALESCE($2, timezone), google_maps_api_key = COALESCE($3, google_maps_api_key) WHERE id = $4 RETURNING *',
        [name, timezone, google_maps_api_key, id],
        (err, result) => {
            if (err) return res.status(500).send(`Error updating tenant: ${err.message}`);
            if (result.rowCount === 0) return res.status(404).send('Tenant not found');
            res.json(result.rows[0]);
        }
    );
});

router.delete('/:id', authenticateToken, requirePermission('manage_tenants'), (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).send('Invalid tenant ID');
    pool.query(
        'DELETE FROM tenants WHERE id = $1 RETURNING *',
        [id],
        (err, result) => {
            if (err) return res.status(500).send(`Error deleting tenant: ${err.message}`);
            if (result.rowCount === 0) return res.status(404).send('Tenant not found');
            res.status(200).json({ message: 'Tenant deleted', data: result.rows[0] });
        }
    );
});

module.exports = router;